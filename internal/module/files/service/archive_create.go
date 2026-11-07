package service

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const zipArchiveMediaType = "application/zip"

// ZIPTaskInput 指定同一账号下的 ZIP 来源和保存位置。空 ParentID 表示根目录。
type ZIPTaskInput struct {
	ClientKey string   `json:"clientKey" minLength:"36" maxLength:"36"`
	SourceIDs []string `json:"sourceIds" minItems:"1" maxItems:"500"`
	ParentID  string   `json:"parentId" maxLength:"36"`
	Name      string   `json:"name" minLength:"1" maxLength:"255"`
}

// CreateZIP 在所有者事务中固定来源，原始请求可按客户端键安全重放。
func (s *ArchiveTasks) CreateZIP(ctx context.Context, owner string, input ZIPTaskInput) (ArchiveTask, error) {
	if !s.available {
		return ArchiveTask{}, ErrArchiveTasksUnavailable
	}
	if err := s.authorize(ctx, owner); err != nil {
		return ArchiveTask{}, err
	}
	files := s.archives.files
	if model.ValidateTransferID(input.ClientKey) != nil || len(input.SourceIDs) == 0 || len(input.SourceIDs) > files.policy.MaxBatchEntries {
		return ArchiveTask{}, model.ErrInvalid
	}
	for _, id := range input.SourceIDs {
		if err := model.ValidateTransferID(id); err != nil {
			return ArchiveTask{}, err
		}
	}
	input.SourceIDs = slices.Clone(input.SourceIDs)
	slices.Sort(input.SourceIDs)
	input.SourceIDs = slices.Compact(input.SourceIDs)
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" || strings.EqualFold(input.Name, ".zip") {
		return ArchiveTask{}, model.ErrInvalid
	}
	if !strings.HasSuffix(strings.ToLower(input.Name), ".zip") {
		input.Name += ".zip"
	}
	normalized, err := files.normalizedName(input.Name)
	if err != nil {
		return ArchiveTask{}, err
	}
	request, err := json.Marshal(input)
	if err != nil {
		return ArchiveTask{}, err
	}
	if len(request) > ArchiveTaskRequestBytes {
		return ArchiveTask{}, model.ErrTooLarge
	}
	id, err := files.ids.New()
	if err != nil {
		return ArchiveTask{}, err
	}
	claim := ArchiveTaskClaim{ID: id, OwnerID: owner, Kind: ArchiveTaskZIP, RequestJSON: string(request)}
	return s.repo.CreateArchiveTask(ctx, claim, input.ClientKey, files.policy.SearchTreeEntries, func(entries []model.Entry) (ArchiveTaskSource, error) {
		if err := model.Parent(entries, input.ParentID); err != nil {
			return ArchiveTaskSource{}, err
		}
		if err := model.Available(entries, "", input.ParentID, normalized); err != nil {
			return ArchiveTaskSource{}, err
		}
		_, signature, err := s.zipSources(ctx, entries, input.SourceIDs)
		return ArchiveTaskSource{Name: input.Name, Signature: signature}, err
	})
}

type zipSourceVersion struct {
	ID, Name, ObjectKey, ContentSHA string
	Kind                            model.Kind
	Revision, SizeBytes             int64
	Modified                        time.Time
}

func (s *ArchiveTasks) zipSources(ctx context.Context, entries []model.Entry, ids []string) ([]zipMember, string, error) {
	members, err := s.archives.files.archiveMembers(ctx, entries, ids)
	if err != nil {
		return nil, "", err
	}
	versions := make([]zipSourceVersion, 0, len(members))
	paths := make([]ArchiveMember, 0, len(members))
	for _, member := range members {
		entry := member.entry
		paths = append(paths, ArchiveMember{Path: strings.TrimSuffix(member.name, "/"), Kind: entry.Kind, SizeBytes: entry.SizeBytes})
		versions = append(versions, zipSourceVersion{
			ID: entry.ID, Name: member.name, ObjectKey: entry.ObjectKey, ContentSHA: entry.ContentSHA,
			Kind: entry.Kind, Revision: entry.ContentRevision, SizeBytes: entry.SizeBytes, Modified: entry.UpdatedAt.UTC(),
		})
	}
	if err := s.archives.validateParsed(ArchiveParseResult{Format: "zip", Members: paths}); err != nil {
		return nil, "", err
	}
	encoded, err := json.Marshal(versions)
	if err != nil {
		return nil, "", fmt.Errorf("encode archive source versions: %w", err)
	}
	digest := sha256.Sum256(encoded)
	return members, hex.EncodeToString(digest[:]), nil
}

type zipTaskBuffer struct {
	ctx        context.Context
	content    bytes.Buffer
	limitBytes int64
}

func (w *zipTaskBuffer) Write(content []byte) (int, error) {
	if err := w.ctx.Err(); err != nil {
		return 0, err
	}
	if int64(len(content)) > w.limitBytes-int64(w.content.Len()) {
		return 0, model.ErrTooLarge
	}
	return w.content.Write(content)
}

func (s *ArchiveTasks) runZIP(ctx context.Context, claim ArchiveTaskClaim) error {
	var input ZIPTaskInput
	if err := json.Unmarshal([]byte(claim.RequestJSON), &input); err != nil {
		return fmt.Errorf("decode ZIP task input: %w", err)
	}
	files := s.archives.files
	normalized, err := files.normalizedName(input.Name)
	if err != nil {
		return err
	}
	entries, err := files.repo.ReadBounded(ctx, claim.OwnerID, files.policy.SearchTreeEntries)
	if err != nil {
		return err
	}
	members, signature, err := s.zipSources(ctx, entries, input.SourceIDs)
	if err != nil {
		return err
	}
	if signature != claim.Signature {
		return model.ErrConflict
	}
	if err := model.Parent(entries, input.ParentID); err != nil {
		return err
	}
	if err := model.Available(entries, "", input.ParentID, normalized); err != nil {
		return err
	}
	output := &zipTaskBuffer{ctx: ctx, limitBytes: min(files.policy.MaxArchiveBytes, files.policy.MaxFileBytes)}
	if err := files.writeArchive(ctx, claim.OwnerID, members, output, zip.Deflate); err != nil {
		return err
	}
	content := output.content.Bytes()
	size := int64(len(content))
	if size > files.policy.QuotaBytes-model.Used(entries) {
		return model.ErrQuota
	}
	id, err := files.ids.New()
	if err != nil {
		return err
	}
	key := "files/" + id
	if err := s.repo.RecordArchiveCandidates(ctx, claim, []string{key}); err != nil {
		return err
	}
	if err := files.content.Put(ctx, key, content, zipArchiveMediaType); err != nil {
		return fmt.Errorf("write ZIP task candidate: %w", err)
	}
	if err := s.authorize(ctx, claim.OwnerID); err != nil {
		return err
	}
	now := files.clock.Now().UTC()
	digest := sha256.Sum256(content)
	entry := model.Entry{
		ID: id, OwnerID: claim.OwnerID, ParentID: input.ParentID, Name: input.Name,
		NormalizedName: normalized, Kind: model.File, SizeBytes: size, MediaType: zipArchiveMediaType,
		ObjectKey: key, ContentSHA: hex.EncodeToString(digest[:]), ContentRevision: 1, CreatedAt: now, UpdatedAt: now,
	}
	result := ArchiveTask{DestinationID: input.ParentID, ResultEntryID: id, CreatedCount: 1}
	return s.repo.PublishArchiveTask(ctx, claim, files.policy.SearchTreeEntries, result, func(current []model.Entry) ([]model.Entry, error) {
		_, latest, err := s.zipSources(ctx, current, input.SourceIDs)
		if err != nil {
			return nil, err
		}
		if latest != claim.Signature {
			return nil, model.ErrConflict
		}
		if err := model.Parent(current, input.ParentID); err != nil {
			return nil, err
		}
		if err := model.Available(current, "", input.ParentID, normalized); err != nil {
			return nil, err
		}
		if size > files.policy.QuotaBytes-model.Used(current) {
			return nil, model.ErrQuota
		}
		if len(current) >= files.policy.SearchTreeEntries {
			return nil, model.ErrTooLarge
		}
		return []model.Entry{entry}, nil
	})
}
