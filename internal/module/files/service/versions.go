package service

import (
	"context"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"io"
	"slices"
	"time"
)

const DefaultVersionPageSize = 5

type VersionOrder string

const (
	VersionsNewest VersionOrder = "newest"
	VersionsOldest VersionOrder = "oldest"
)

type FileVersion struct {
	Revision  int64     `json:"revision"`
	Current   bool      `json:"current"`
	Name      string    `json:"name"`
	SizeBytes int64     `json:"sizeBytes"`
	MediaType string    `json:"mediaType"`
	UpdatedAt time.Time `json:"updatedAt"`
}
type VersionPage struct {
	PDFReader         PDFReaderLimits `json:"pdfReader"`
	Entry             model.Entry     `json:"entry"`
	Items             []FileVersion   `json:"items"`
	Page              int             `json:"page"`
	PageSize          int             `json:"pageSize"`
	Total             int             `json:"total"`
	ContentRevision   int64           `json:"contentRevision"`
	HistoryRevision   int64           `json:"historyRevision"`
	HistoryEnabled    bool            `json:"historyEnabled"`
	PerFile           int             `json:"perFile"`
	PerOwner          int             `json:"perOwner"`
	FileHistoryBytes  int64           `json:"fileHistoryBytes"`
	OwnerHistoryBytes int64           `json:"ownerHistoryBytes"`
	OwnerUsedBytes    int64           `json:"ownerUsedBytes"`
	QuotaBytes        int64           `json:"quotaBytes"`
	MaxTextBytes      int64           `json:"maxTextBytes"`
	MaxMediaBytes     int64           `json:"maxMediaBytes"`
}
type VersionMutation struct {
	ExpectedContentRevision int64 `json:"expectedContentRevision" minimum:"1" maximum:"9007199254740991"`
	ExpectedHistoryRevision int64 `json:"expectedHistoryRevision" minimum:"0" maximum:"9007199254740991"`
}
type VersionCopy struct {
	ParentID string `json:"parentId" maxLength:"36"`
	Name     string `json:"name" minLength:"1" maxLength:"255"`
}
type HistoryDeleteMode string

const (
	DeleteSelectedVersions HistoryDeleteMode = "selected"
	DeleteAllHistory       HistoryDeleteMode = "all-history"
)

type VersionDelete struct {
	VersionMutation
	Mode      HistoryDeleteMode `json:"mode" enum:"selected,all-history"`
	Revisions []int64           `json:"revisions" maxItems:"20"`
}
type VersionMutationResult struct {
	ContentRevision int64 `json:"contentRevision"`
	HistoryRevision int64 `json:"historyRevision"`
}

func historyEntry(entries []model.Entry, id string) (model.Entry, error) {
	entry, ok := model.Find(entries, id)
	if !ok || !model.Visible(entries, entry) {
		return model.Entry{}, model.ErrMissing
	}
	if entry.Kind != model.File {
		return model.Entry{}, model.ErrUnsupported
	}
	if entry.ContentRevision < 1 || entry.ContentRevision > model.MaxContentRevision {
		return model.Entry{}, model.ErrInvalid
	}
	if err := model.ValidateHistory(entry); err != nil {
		return model.Entry{}, err
	}
	return entry, nil
}
func lookupVersion(entry model.Entry, revision int64) (model.VersionSnapshot, error) {
	if revision == entry.ContentRevision {
		return model.CurrentSnapshot(entry), nil
	}
	for _, version := range entry.History {
		if version.Revision == revision {
			return version, nil
		}
	}
	return model.VersionSnapshot{}, model.ErrMissing
}
func (s *Service) versionSnapshot(ctx context.Context, owner, id string, revision int64) (model.Entry, model.VersionSnapshot, error) {
	if owner == "" {
		return model.Entry{}, model.VersionSnapshot{}, model.ErrMissing
	}
	entries, err := s.repo.ReadBounded(ctx, owner, s.policy.SearchTreeEntries)
	if err != nil {
		return model.Entry{}, model.VersionSnapshot{}, err
	}
	entry, err := historyEntry(entries, id)
	if err != nil {
		return model.Entry{}, model.VersionSnapshot{}, err
	}
	version, err := lookupVersion(entry, revision)
	return entry, version, err
}

// Versions 返回受控页与真实逻辑占用；当前版本和历史的存储键都不在协议投影内。
func (s *Service) Versions(ctx context.Context, owner, id string, page int, order VersionOrder) (VersionPage, error) {
	if page < 1 || page > model.MaxFileHistory+1 || (order != VersionsNewest && order != VersionsOldest) {
		return VersionPage{}, model.ErrInvalid
	}
	if owner == "" {
		return VersionPage{}, model.ErrMissing
	}
	entries, err := s.repo.ReadBounded(ctx, owner, s.policy.SearchTreeEntries)
	if err != nil {
		return VersionPage{}, err
	}
	entry, err := historyEntry(entries, id)
	if err != nil {
		return VersionPage{}, err
	}
	versions := append(model.CloneHistory(entry.History), model.CurrentSnapshot(entry))
	slices.SortFunc(versions, func(a, b model.VersionSnapshot) int {
		if a.Revision < b.Revision {
			return -1
		}
		if a.Revision > b.Revision {
			return 1
		}
		return 0
	})
	if order == VersionsNewest {
		slices.Reverse(versions)
	}
	result := VersionPage{PDFReader: s.policy.PDFReader.Limits(s.policy.MaxMediaBytes), Entry: entry, Items: []FileVersion{}, Page: page, PageSize: DefaultVersionPageSize, Total: len(versions), ContentRevision: entry.ContentRevision, HistoryRevision: entry.HistoryRevision, HistoryEnabled: s.policy.HistoryEnabled, PerFile: s.policy.HistoryPerFile, PerOwner: s.policy.HistoryPerOwner, FileHistoryBytes: model.HistoryBytes(entry), OwnerUsedBytes: model.Used(entries), QuotaBytes: s.policy.QuotaBytes, MaxTextBytes: s.policy.MaxTextBytes, MaxMediaBytes: s.policy.MaxMediaBytes}
	for _, item := range entries {
		result.OwnerHistoryBytes += model.HistoryBytes(item)
	}
	start := min((page-1)*DefaultVersionPageSize, len(versions))
	end := min(start+DefaultVersionPageSize, len(versions))
	for _, version := range versions[start:end] {
		result.Items = append(result.Items, FileVersion{Revision: version.Revision, Current: version.Revision == entry.ContentRevision, Name: version.Name, SizeBytes: version.SizeBytes, MediaType: version.MediaType, UpdatedAt: version.UpdatedAt})
	}
	return result, nil
}

// DownloadVersionTo 复用原内容租约；HTTP层拥有传输准入名额，读取前再次检查版本关联。
func (s *Service) DownloadVersionTo(ctx context.Context, owner, id string, revision int64, use func(model.Entry, io.ReadSeeker) error) error {
	if use == nil {
		return model.ErrInvalid
	}
	entry, version, err := s.versionSnapshot(ctx, owner, id, revision)
	if err != nil {
		return err
	}
	return s.content.WithReader(ctx, version.ObjectKey, func(reader io.ReadSeeker, size int64) error {
		if size != version.SizeBytes {
			return fmt.Errorf("file version content length mismatch")
		}
		_, latest, err := s.versionSnapshot(ctx, owner, id, revision)
		if err != nil {
			return err
		}
		if latest.ObjectKey != version.ObjectKey || latest.SizeBytes != version.SizeBytes {
			return model.ErrConflict
		}
		entry.Name, entry.ObjectKey, entry.SizeBytes, entry.MediaType, entry.ContentSHA, entry.ContentRevision, entry.UpdatedAt = version.Name, version.ObjectKey, version.SizeBytes, version.MediaType, version.ContentSHA, version.Revision, version.UpdatedAt
		return use(entry, reader)
	})
}
func (s *Service) validateVersionContent(ctx context.Context, version model.VersionSnapshot) error {
	release, err := s.AcquireUpload(ctx)
	if err != nil {
		return err
	}
	defer release()
	return s.content.WithReader(ctx, version.ObjectKey, func(_ io.ReadSeeker, size int64) error {
		if size != version.SizeBytes {
			return fmt.Errorf("file version content length mismatch")
		}
		return ctx.Err()
	})
}
func matchVersionMutation(entry model.Entry, input VersionMutation) error {
	if input.ExpectedContentRevision != entry.ContentRevision || input.ExpectedHistoryRevision != entry.HistoryRevision {
		return model.ErrConflict
	}
	return nil
}

// RestoreVersion 保留恢复前内容；只切换内容，不回滚文件名、位置或私有整理信息。
func (s *Service) RestoreVersion(ctx context.Context, owner, id string, revision int64, input VersionMutation) (model.Entry, error) {
	_, version, err := s.versionSnapshot(ctx, owner, id, revision)
	if err != nil {
		return model.Entry{}, err
	}
	if err := s.validateVersionContent(ctx, version); err != nil {
		return model.Entry{}, err
	}
	changed, err := s.repo.ChangeManyBounded(ctx, owner, s.policy.SearchTreeEntries, func(entries []model.Entry) ([]model.Entry, error) {
		entry, err := historyEntry(entries, id)
		if err != nil {
			return nil, err
		}
		if err := matchVersionMutation(entry, input); err != nil {
			return nil, err
		}
		chosen, err := lookupVersion(entry, revision)
		if err != nil {
			return nil, err
		}
		if chosen.ObjectKey != version.ObjectKey {
			return nil, model.ErrConflict
		}
		if entry.ObjectKey == chosen.ObjectKey {
			return []model.Entry{entry}, nil
		}
		// 提升所选关联为当前，旧当前退入历史；不额外复制逻辑占用，满保留容量也可恢复。
		kept := make([]model.VersionSnapshot, 0, len(entry.History)-1)
		for _, past := range entry.History {
			if past.Revision != revision {
				kept = append(kept, past)
			}
		}
		entry.History = kept
		entry, err = appendCurrentSnapshot(entry)
		if err != nil {
			return nil, err
		}
		entry.ObjectKey, entry.ContentSHA, entry.SizeBytes, entry.MediaType = chosen.ObjectKey, chosen.ContentSHA, chosen.SizeBytes, chosen.MediaType
		entry.ContentRevision++
		entry.UploadKey = ""
		entry.UpdatedAt = s.clock.Now().UTC()
		return []model.Entry{entry}, nil
	})
	if err != nil {
		return model.Entry{}, err
	}
	return changed[0], nil
}

// CopyVersion 为选定内容建立新目录项，不复制无关历史，不改动原文件。
func (s *Service) CopyVersion(ctx context.Context, owner, id string, revision int64, input VersionCopy) (model.Entry, error) {
	normalized, err := s.normalizedName(input.Name)
	if err != nil {
		return model.Entry{}, err
	}
	_, version, err := s.versionSnapshot(ctx, owner, id, revision)
	if err != nil {
		return model.Entry{}, err
	}
	if err := s.validateVersionContent(ctx, version); err != nil {
		return model.Entry{}, err
	}
	generated, err := s.ids.New()
	if err != nil {
		return model.Entry{}, err
	}
	changed, err := s.repo.ChangeManyBounded(ctx, owner, s.policy.SearchTreeEntries, func(entries []model.Entry) ([]model.Entry, error) {
		original, err := historyEntry(entries, id)
		if err != nil {
			return nil, err
		}
		chosen, err := lookupVersion(original, revision)
		if err != nil {
			return nil, err
		}
		if chosen.ObjectKey != version.ObjectKey {
			return nil, model.ErrConflict
		}
		if err := model.Parent(entries, input.ParentID); err != nil {
			return nil, err
		}
		if err := model.Available(entries, "", input.ParentID, normalized); err != nil {
			return nil, err
		}
		if generated == "" {
			return nil, model.ErrInvalid
		}
		if _, exists := model.Find(entries, generated); exists {
			return nil, model.ErrConflict
		}
		used := model.Used(entries)
		if used > s.policy.QuotaBytes || chosen.SizeBytes > s.policy.QuotaBytes-used {
			return nil, model.ErrQuota
		}
		now := s.clock.Now().UTC()
		copy := model.Entry{ID: generated, OwnerID: owner, ParentID: input.ParentID, Kind: model.File, Name: input.Name, NormalizedName: normalized, ObjectKey: chosen.ObjectKey, SizeBytes: chosen.SizeBytes, MediaType: chosen.MediaType, CreatedAt: now, UpdatedAt: now, ContentSHA: chosen.ContentSHA, ContentRevision: 1, Annotations: model.CloneAnnotations(original.Annotations)}
		return []model.Entry{copy}, nil
	})
	if err != nil {
		return model.Entry{}, err
	}
	return changed[0], nil
}

// DeleteVersions 只移除经明确选择的旧关联；当前内容、物理对象和其他文件的副本不受影响。
func (s *Service) DeleteVersions(ctx context.Context, owner, id string, input VersionDelete) (VersionMutationResult, error) {
	if owner == "" {
		return VersionMutationResult{}, model.ErrMissing
	}
	if input.Mode != DeleteSelectedVersions && input.Mode != DeleteAllHistory {
		return VersionMutationResult{}, model.ErrInvalid
	}
	if len(input.Revisions) > model.MaxFileHistory || (input.Mode == DeleteSelectedVersions && len(input.Revisions) == 0) || (input.Mode == DeleteAllHistory && len(input.Revisions) != 0) {
		return VersionMutationResult{}, model.ErrInvalid
	}
	selected := make(map[int64]bool, len(input.Revisions))
	for _, revision := range input.Revisions {
		if revision < 1 || selected[revision] {
			return VersionMutationResult{}, model.ErrInvalid
		}
		selected[revision] = true
	}
	changed, err := s.repo.ChangeManyBounded(ctx, owner, s.policy.SearchTreeEntries, func(entries []model.Entry) ([]model.Entry, error) {
		entry, err := historyEntry(entries, id)
		if err != nil {
			return nil, err
		}
		if err := matchVersionMutation(entry, input.VersionMutation); err != nil {
			return nil, err
		}
		if selected[entry.ContentRevision] {
			return nil, model.ErrInvalid
		}
		for revision := range selected {
			if _, err := lookupVersion(entry, revision); err != nil {
				return nil, err
			}
		}
		kept := make([]model.VersionSnapshot, 0, len(entry.History))
		for _, version := range entry.History {
			if input.Mode != DeleteAllHistory && !selected[version.Revision] {
				kept = append(kept, version)
			}
		}
		if len(kept) != len(entry.History) {
			if entry.HistoryRevision >= model.MaxHistoryRevision {
				return nil, model.ErrConflict
			}
			entry.History = kept
			entry.HistoryRevision++
		}
		return []model.Entry{entry}, nil
	})
	if err != nil {
		return VersionMutationResult{}, err
	}
	return VersionMutationResult{ContentRevision: changed[0].ContentRevision, HistoryRevision: changed[0].HistoryRevision}, nil
}
