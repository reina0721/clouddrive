// Package service 实现私有文件目录用例，身份归属在每个操作内校验。
package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"io"
	"mime"
	"net/http"
	"path"
	"strings"
	"time"
)

const (
	DefaultMaxFileBytes      int64 = model.MaxFileContentBytes
	DefaultQuotaBytes        int64 = 1 << 30
	DefaultConcurrentUploads       = 2
	DefaultMaxTextBytes      int64 = 1 << 20
	DefaultMaxArchiveBytes   int64 = 64 << 20
	DefaultMaxBatchEntries         = 500
	DefaultMaxThumbnailBytes int64 = 2 << 20
	DefaultMaxMediaBytes     int64 = 32 << 20
	DefaultMaxGalleryEntries       = 12
	cleanupTimeout                 = 5 * time.Second
)

type Policy struct {
	MaxFileBytes           int64
	QuotaBytes             int64
	ConcurrentUploads      int
	MaxTextBytes           int64
	MaxArchiveBytes        int64
	MaxBatchEntries        int
	MaxThumbnailBytes      int64
	MaxMediaBytes          int64
	MaxGalleryEntries      int
	SearchTreeEntries      int
	ShortcutLimit          int
	AnnotationMaxBytes     int
	AnnotationBatchEntries int
	HistoryEnabled         bool
	HistoryPerFile         int
	HistoryPerOwner        int
}

func DefaultPolicy() Policy {
	return Policy{MaxFileBytes: DefaultMaxFileBytes, QuotaBytes: DefaultQuotaBytes, ConcurrentUploads: DefaultConcurrentUploads, MaxTextBytes: DefaultMaxTextBytes, MaxArchiveBytes: DefaultMaxArchiveBytes, MaxBatchEntries: DefaultMaxBatchEntries, MaxThumbnailBytes: DefaultMaxThumbnailBytes, MaxMediaBytes: DefaultMaxMediaBytes, MaxGalleryEntries: DefaultMaxGalleryEntries, ShortcutLimit: DefaultShortcutLimit, SearchTreeEntries: DefaultSearchTreeEntries, AnnotationMaxBytes: model.MaxAnnotationBytes, AnnotationBatchEntries: DefaultAnnotationBatchEntries, HistoryEnabled: true, HistoryPerFile: model.MaxFileHistory, HistoryPerOwner: model.MaxOwnerHistory}
}
func (p Policy) Validate() error {
	if p.HistoryPerFile < 1 || p.HistoryPerFile > model.MaxFileHistory || p.HistoryPerOwner < 1 || p.HistoryPerOwner > model.MaxOwnerHistory {
		return fmt.Errorf("invalid file history budgets")
	}
	if p.AnnotationMaxBytes < 1 || p.AnnotationMaxBytes > model.MaxAnnotationBytes || p.AnnotationBatchEntries < 1 || p.AnnotationBatchEntries > DefaultAnnotationBatchEntries {
		return fmt.Errorf("invalid file annotation budgets")
	}
	if p.SearchTreeEntries < 1 || p.SearchTreeEntries > DefaultSearchTreeEntries {
		return fmt.Errorf("invalid file search tree limit")
	}
	if p.ShortcutLimit < 1 || p.ShortcutLimit > DefaultShortcutLimit {
		return fmt.Errorf("invalid file shortcut limit")
	}
	if p.MaxFileBytes < 1 || p.MaxFileBytes > DefaultMaxFileBytes || p.QuotaBytes < p.MaxFileBytes || p.ConcurrentUploads < 1 || p.ConcurrentUploads > DefaultConcurrentUploads {
		return fmt.Errorf("invalid files budgets")
	}
	if p.MaxTextBytes < 1 || p.MaxTextBytes > DefaultMaxTextBytes || p.MaxArchiveBytes < 1 || p.MaxArchiveBytes > DefaultMaxArchiveBytes || p.MaxBatchEntries < 1 || p.MaxBatchEntries > DefaultMaxBatchEntries {
		return fmt.Errorf("invalid files operation budgets")
	}
	if p.MaxMediaBytes < 1 || p.MaxMediaBytes > DefaultMaxMediaBytes || p.MaxThumbnailBytes < 1 || p.MaxThumbnailBytes > DefaultMaxThumbnailBytes || p.MaxGalleryEntries < 1 || p.MaxGalleryEntries > DefaultMaxGalleryEntries {
		return fmt.Errorf("invalid file media budgets")
	}
	return nil
}

type Repository interface {
	Read(context.Context, string) ([]model.Entry, error)
	ReadBounded(context.Context, string, int) ([]model.Entry, error)
	Change(context.Context, string, func([]model.Entry) (model.Entry, error)) (model.Entry, error)
	ChangeMany(context.Context, string, func([]model.Entry) ([]model.Entry, error)) ([]model.Entry, error)
	ChangeManyBounded(context.Context, string, int, func([]model.Entry) ([]model.Entry, error)) ([]model.Entry, error)
	RecordCleanup(context.Context, string, string) error
}
type Content interface {
	Put(context.Context, string, []byte, string) error
	Delete(context.Context, string) error
	WithReader(context.Context, string, func(io.ReadSeeker, int64) error) error
}
type NameNormalizer interface{ Normalize(string) string }
type Service struct {
	repo    Repository
	content Content
	clock   clock.Clock
	ids     idgen.Generator
	policy  Policy
	slots   chan struct{}
	names   NameNormalizer
}

func New(repository Repository, content Content, clock clock.Clock, ids idgen.Generator, names NameNormalizer, policy Policy) (*Service, error) {
	if repository == nil || content == nil || clock == nil || ids == nil || names == nil {
		return nil, fmt.Errorf("files dependencies incomplete")
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	return &Service{repo: repository, content: content, clock: clock, ids: ids, policy: policy, slots: make(chan struct{}, policy.ConcurrentUploads), names: names}, nil
}

func (s *Service) normalizedName(name string) (string, error) {
	if err := model.ValidateName(name); err != nil {
		return "", err
	}
	return strings.ToLower(s.names.Normalize(name)), nil
}

func (s *Service) read(ctx context.Context, owner string) ([]model.Entry, error) {
	if owner == "" {
		return nil, model.ErrMissing
	}
	return s.repo.Read(ctx, owner)
}
func (s *Service) Folder(ctx context.Context, owner, parent, name string) (model.Entry, error) {
	normalized, err := s.normalizedName(name)
	if err != nil {
		return model.Entry{}, err
	}
	id, err := s.ids.New()
	if err != nil {
		return model.Entry{}, err
	}
	now := s.clock.Now().UTC()
	return s.repo.Change(ctx, owner, func(entries []model.Entry) (model.Entry, error) {
		if owner == "" {
			return model.Entry{}, model.ErrMissing
		}
		if err := model.Parent(entries, parent); err != nil {
			return model.Entry{}, err
		}
		if err := model.Available(entries, "", parent, normalized); err != nil {
			return model.Entry{}, err
		}
		return model.Entry{ID: id, OwnerID: owner, ParentID: parent, Name: name, NormalizedName: normalized, Kind: model.Folder, CreatedAt: now, UpdatedAt: now, ContentRevision: 1}, nil
	})
}

// AcquireUpload 在读取请求体之前限流，释放函数只属于当前请求。
func (s *Service) AcquireUpload(ctx context.Context) (func(), error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	select {
	case s.slots <- struct{}{}:
		return func() { <-s.slots }, nil
	default:
		return nil, model.ErrBusy
	}
}
func (s *Service) MaxFileBytes() int64 { return s.policy.MaxFileBytes }
func (s *Service) createSmallContent(ctx context.Context, owner, parent, name, key string, content []byte) (model.Entry, error) {
	normalized, err := s.normalizedName(name)
	if err != nil {
		return model.Entry{}, err
	}
	if int64(len(content)) > s.policy.MaxFileBytes {
		return model.Entry{}, model.ErrTooLarge
	}
	if len(key) < 16 || len(key) > 128 {
		return model.Entry{}, model.ErrInvalid
	}
	digest := sha256.Sum256(content)
	hash := hex.EncodeToString(digest[:])
	entries, err := s.read(ctx, owner)
	if err != nil {
		return model.Entry{}, err
	}
	if entry, ok, err := previousUpload(entries, key, parent, normalized, hash); ok || err != nil {
		return entry, err
	}
	if err := model.Parent(entries, parent); err != nil {
		return model.Entry{}, err
	}
	if err := model.Available(entries, "", parent, normalized); err != nil {
		return model.Entry{}, err
	}
	if model.Used(entries)+int64(len(content)) > s.policy.QuotaBytes {
		return model.Entry{}, model.ErrQuota
	}
	id, err := s.ids.New()
	if err != nil {
		return model.Entry{}, err
	}
	objectKey := "files/" + id
	mediaType := mime.TypeByExtension(strings.ToLower(path.Ext(name)))
	if mediaType == "" {
		mediaType = http.DetectContentType(content)
	}
	if err := s.content.Put(ctx, objectKey, content, mediaType); err != nil {
		return model.Entry{}, s.compensate(ctx, owner, objectKey, fmt.Errorf("write file content: %w", err))
	}
	now := s.clock.Now().UTC()
	entry := model.Entry{ID: id, OwnerID: owner, ParentID: parent, Kind: model.File, Name: name, NormalizedName: normalized, ObjectKey: objectKey, SizeBytes: int64(len(content)), MediaType: mediaType, CreatedAt: now, UpdatedAt: now, UploadKey: key, ContentSHA: hash, ContentRevision: 1}
	result, err := s.repo.Change(ctx, owner, func(entries []model.Entry) (model.Entry, error) {
		if previous, ok, err := previousUpload(entries, key, parent, normalized, hash); ok || err != nil {
			return previous, err
		}
		if err := model.Parent(entries, parent); err != nil {
			return model.Entry{}, err
		}
		if err := model.Available(entries, "", parent, normalized); err != nil {
			return model.Entry{}, err
		}
		if model.Used(entries)+entry.SizeBytes > s.policy.QuotaBytes {
			return model.Entry{}, model.ErrQuota
		}
		return entry, nil
	})
	if err != nil || result.ObjectKey != objectKey {
		if compensationErr := s.compensate(ctx, owner, objectKey, err); compensationErr != nil {
			return model.Entry{}, compensationErr
		}
	}
	return result, err
}

var ErrCleanup = errors.New("file content compensation incomplete")

func (s *Service) compensate(ctx context.Context, owner, key string, cause error) error {
	cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()
	if err := s.content.Delete(cleanup, key); err != nil {
		recordCtx, recordCancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
		defer recordCancel()
		recordErr := s.repo.RecordCleanup(recordCtx, owner, key)
		return errors.Join(cause, ErrCleanup, fmt.Errorf("compensate file content: %w", err), recordErr)
	}
	return cause
}
func previousUpload(entries []model.Entry, key, parent, normalized, hash string) (model.Entry, bool, error) {
	for _, entry := range entries {
		if entry.UploadKey == key {
			if entry.ContentSHA != hash || entry.NormalizedName != normalized || entry.ParentID != parent {
				return model.Entry{}, false, model.ErrConflict
			}
			if !model.Visible(entries, entry) {
				return model.Entry{}, false, model.ErrConflict
			}
			return entry, true, nil
		}
	}
	return model.Entry{}, false, nil
}

type Change struct {
	Name             *string `json:"name,omitempty"`
	ParentID         *string `json:"parentId,omitempty"`
	ExpectedRevision *int64  `json:"expectedRevision,omitempty" minimum:"1"`
}

func (s *Service) Update(ctx context.Context, owner, id string, change Change) (model.Entry, error) {
	return s.repo.Change(ctx, owner, func(entries []model.Entry) (model.Entry, error) {
		entry, ok := model.Find(entries, id)
		if !ok || !model.Visible(entries, entry) {
			return model.Entry{}, model.ErrMissing
		}
		if change.Name == nil && change.ParentID == nil {
			return model.Entry{}, model.ErrInvalid
		}
		if entry.Kind == model.Shortcut {
			if change.ExpectedRevision == nil || *change.ExpectedRevision != entry.ContentRevision {
				return model.Entry{}, model.ErrConflict
			}
			entry.ContentRevision++
		}
		if change.Name != nil {
			normalized, err := s.normalizedName(*change.Name)
			if err != nil {
				return model.Entry{}, err
			}
			entry.Name = *change.Name
			entry.NormalizedName = normalized
		}
		if change.ParentID != nil {
			if err := model.Parent(entries, *change.ParentID); err != nil {
				return model.Entry{}, err
			}
			for parent := *change.ParentID; parent != ""; {
				if parent == id {
					return model.Entry{}, model.ErrConflict
				}
				ancestor, ok := model.Find(entries, parent)
				if !ok {
					return model.Entry{}, model.ErrMissing
				}
				parent = ancestor.ParentID
			}
			entry.ParentID = *change.ParentID
		}
		if err := model.Available(entries, id, entry.ParentID, entry.NormalizedName); err != nil {
			return model.Entry{}, err
		}
		entry.UpdatedAt = s.clock.Now().UTC()
		return entry, nil
	})
}
func (s *Service) Trash(ctx context.Context, owner, id string) (model.Entry, error) {
	return s.repo.Change(ctx, owner, func(entries []model.Entry) (model.Entry, error) {
		entry, ok := model.Find(entries, id)
		if !ok || !model.Visible(entries, entry) {
			return model.Entry{}, model.ErrMissing
		}
		now := s.clock.Now().UTC()
		entry.TrashedAt = &now
		if entry.Kind == model.Shortcut {
			entry.ContentRevision++
		}
		entry.UpdatedAt = now
		return entry, nil
	})
}
func (s *Service) Restore(ctx context.Context, owner, id string, parent *string) (model.Entry, error) {
	return s.repo.Change(ctx, owner, func(entries []model.Entry) (model.Entry, error) {
		entry, ok := model.Find(entries, id)
		if !ok || entry.TrashedAt == nil {
			return model.Entry{}, model.ErrMissing
		}
		if parent != nil {
			entry.ParentID = *parent
		}
		if err := model.Parent(entries, entry.ParentID); err != nil {
			return model.Entry{}, model.ErrConflict
		}
		for ancestor := entry.ParentID; ancestor != ""; {
			if ancestor == id {
				return model.Entry{}, model.ErrConflict
			}
			p, ok := model.Find(entries, ancestor)
			if !ok {
				return model.Entry{}, model.ErrConflict
			}
			ancestor = p.ParentID
		}
		if err := model.Available(entries, id, entry.ParentID, entry.NormalizedName); err != nil {
			return model.Entry{}, err
		}
		entry.TrashedAt = nil
		if entry.Kind == model.Shortcut {
			entry.ContentRevision++
		}
		entry.UpdatedAt = s.clock.Now().UTC()
		return entry, nil
	})
}

type Detail struct {
	Entry       model.Entry   `json:"entry"`
	Breadcrumbs []model.Entry `json:"breadcrumbs"`
}

func (s *Service) Detail(ctx context.Context, owner, id string) (Detail, error) {
	entries, err := s.read(ctx, owner)
	if err != nil {
		return Detail{}, err
	}
	entry, ok := model.Find(entries, id)
	if !ok || !model.Visible(entries, entry) {
		return Detail{}, model.ErrMissing
	}
	result := Detail{Entry: entry, Breadcrumbs: []model.Entry{}}
	for parent := entry.ParentID; parent != ""; {
		ancestor, ok := model.Find(entries, parent)
		if !ok {
			return Detail{}, model.ErrMissing
		}
		result.Breadcrumbs = append([]model.Entry{ancestor}, result.Breadcrumbs...)
		parent = ancestor.ParentID
	}
	return result, nil
}

// ReadSmall 仅用于有明确预算的内容处理；大文件下载必须使用 DownloadTo。
func (s *Service) ReadSmall(ctx context.Context, owner, id string, maxBytes int64) (model.Entry, []byte, error) {
	detail, err := s.Detail(ctx, owner, id)
	if err != nil {
		return model.Entry{}, nil, err
	}
	entry := detail.Entry
	if entry.Kind == model.Shortcut {
		return model.Entry{}, nil, model.ErrUnsupported
	}
	if entry.Kind != model.File {
		return model.Entry{}, nil, model.ErrInvalid
	}
	if maxBytes < 0 || maxBytes > DefaultMaxArchiveBytes || entry.SizeBytes > maxBytes {
		return model.Entry{}, nil, model.ErrTooLarge
	}
	var content []byte
	err = s.content.WithReader(ctx, entry.ObjectKey, func(reader io.ReadSeeker, sizeBytes int64) error {
		if sizeBytes != entry.SizeBytes {
			return fmt.Errorf("file content length mismatch")
		}
		var err error
		content, err = io.ReadAll(io.LimitReader(reader, maxBytes+1))
		return err
	})
	if err != nil {
		return model.Entry{}, nil, fmt.Errorf("read file content: %w", err)
	}
	digest := sha256.Sum256(content)
	if int64(len(content)) != entry.SizeBytes || hex.EncodeToString(digest[:]) != entry.ContentSHA {
		return model.Entry{}, nil, fmt.Errorf("file content integrity mismatch")
	}
	return entry, content, nil
}
