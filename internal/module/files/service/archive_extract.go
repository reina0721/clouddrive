package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"path"
	"sort"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type archivePlan struct {
	receipt    ArchiveReceipt
	sourcePath map[string]string
	reused     []model.Entry
	bytes      int64
}

func archiveMembersForSelection(members []ArchiveMember, selection ArchiveSelection) []ArchiveMember {
	wanted := map[string]bool{}
	for _, m := range members {
		if selection.Mode == ArchiveReadAll || archiveChosen(m.Path, selection.Paths) {
			for name := m.Path; name != "."; name = path.Dir(name) {
				wanted[name] = true
			}
		}
	}
	result := []ArchiveMember{}
	for _, m := range members {
		if wanted[m.Path] {
			result = append(result, m)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Path < result[j].Path })
	return result
}
func archiveDirectoryChain(entries []model.Entry, id string) []model.Entry {
	result := []model.Entry{}
	for remaining := len(entries) + 1; id != "" && remaining > 0; remaining-- {
		entry, ok := model.Find(entries, id)
		if !ok {
			break
		}
		result = append(result, entry)
		id = entry.ParentID
	}
	return result
}
func (a *Archives) plan(ctx context.Context, owner string, entries []model.Entry, members []ArchiveMember, q ArchiveExtractRequest) (archivePlan, error) {
	p := archivePlan{receipt: ArchiveReceipt{DestinationID: q.ParentID, Created: []model.Entry{}, Skipped: []string{}, Renamed: []ArchiveRenamed{}}, sourcePath: map[string]string{}, reused: archiveDirectoryChain(entries, q.ParentID)}
	if err := model.Parent(entries, q.ParentID); err != nil {
		return p, err
	}
	known := append([]model.Entry(nil), entries...)
	now := a.files.clock.Now().UTC()
	add := func(parent, name, original string, kind model.Kind, size int64) (model.Entry, bool, error) {
		if err := ctx.Err(); err != nil {
			return model.Entry{}, false, err
		}
		normalized, err := a.files.normalizedName(name)
		if err != nil {
			return model.Entry{}, false, err
		}
		var existing model.Entry
		found := false
		for _, entry := range known {
			if entry.ParentID == parent && entry.TrashedAt == nil && entry.NormalizedName == normalized {
				existing, found = entry, true
				break
			}
		}
		if found {
			switch q.Conflict {
			case ArchiveReject:
				return model.Entry{}, false, model.ErrConflict
			case ArchiveSkip:
				if kind == model.Folder && existing.Kind == model.Folder {
					p.reused = append(p.reused, existing)
					return existing, false, nil
				}
				return model.Entry{}, true, nil
			case ArchiveRename:
				originalName := name
				extension := ""
				if kind == model.File {
					extension = path.Ext(name)
				}
				stem := strings.TrimSuffix(name, extension)
				chosen := false
				for number := 1; number <= len(known)+a.files.policy.MaxBatchEntries+1; number++ {
					suffix := fmt.Sprintf(" (%d)", number)
					available := model.MaxNameRunes - len([]rune(extension)) - len([]rune(suffix))
					if available < 0 {
						return model.Entry{}, false, model.ErrInvalid
					}
					base := []rune(stem)
					if len(base) > available {
						base = base[:available]
					}
					name = string(base) + suffix + extension
					normalized, err = a.files.normalizedName(name)
					if err != nil {
						return model.Entry{}, false, err
					}
					if model.Available(known, "", parent, normalized) == nil {
						chosen = true
						break
					}
				}
				if !chosen {
					return model.Entry{}, false, model.ErrConflict
				}
				if name != originalName {
					p.receipt.Renamed = append(p.receipt.Renamed, ArchiveRenamed{Path: original, Name: name})
				}
			default:
				return model.Entry{}, false, model.ErrInvalid
			}
		}
		if kind == model.File {
			if err := a.files.policy.NameAdmission.validate(name); err != nil {
				return model.Entry{}, false, err
			}
		}
		id, err := a.files.ids.New()
		if err != nil {
			return model.Entry{}, false, err
		}
		entry := model.Entry{ID: id, OwnerID: owner, ParentID: parent, Name: name, NormalizedName: normalized, Kind: kind, SizeBytes: size, CreatedAt: now, UpdatedAt: now, ContentRevision: 1}
		if kind == model.File {
			entry.ObjectKey = "files/" + id
			p.sourcePath[id] = original
			p.bytes += size
		}
		known = append(known, entry)
		p.receipt.Created = append(p.receipt.Created, entry)
		if len(p.receipt.Created) > a.files.policy.MaxBatchEntries {
			return model.Entry{}, false, model.ErrTooLarge
		}
		return entry, false, nil
	}
	destination := q.ParentID
	if q.FolderName != "" {
		folder, skip, err := add(destination, q.FolderName, "", model.Folder, 0)
		if err != nil {
			return p, err
		}
		if skip {
			for _, m := range members {
				p.receipt.Skipped = append(p.receipt.Skipped, m.Path)
			}
			return p, nil
		}
		destination = folder.ID
		p.receipt.DestinationID = destination
	}
	parents := map[string]string{".": destination}
	blocked := map[string]bool{}
	for _, member := range members {
		parentPath := path.Dir(member.Path)
		if blocked[parentPath] {
			blocked[member.Path] = true
			p.receipt.Skipped = append(p.receipt.Skipped, member.Path)
			continue
		}
		parent, ok := parents[parentPath]
		if !ok {
			return p, model.ErrInvalid
		}
		entry, skip, err := add(parent, path.Base(member.Path), member.Path, member.Kind, member.SizeBytes)
		if err != nil {
			return p, err
		}
		if skip {
			blocked[member.Path] = true
			p.receipt.Skipped = append(p.receipt.Skipped, member.Path)
			continue
		}
		if member.Kind == model.Folder {
			parents[member.Path] = entry.ID
		}
	}
	used := model.Used(entries)
	if used > a.files.policy.QuotaBytes || p.bytes > a.files.policy.QuotaBytes-used {
		return p, model.ErrQuota
	}
	if len(entries)+len(p.receipt.Created) > a.files.policy.SearchTreeEntries {
		return p, model.ErrTooLarge
	}
	return p, nil
}

// Extract 先构造完整候选，再用单次owner事务发布；任何失败都不留下部分目录项。
func (a *Archives) Extract(ctx context.Context, owner, id string, q ArchiveExtractRequest) (ArchiveReceipt, error) {
	source, plan, payloads, err := a.prepareExtraction(ctx, owner, id, q)
	if err != nil {
		return ArchiveReceipt{}, err
	}
	staged, err := a.stageExtraction(ctx, &plan, payloads)
	if err != nil {
		return ArchiveReceipt{}, a.compensate(ctx, owner, staged, err)
	}
	changed, err := a.files.repo.ChangeManyBounded(ctx, owner, a.files.policy.SearchTreeEntries, a.archivePublication(source, plan, q))
	if err != nil {
		return ArchiveReceipt{}, a.compensate(ctx, owner, staged, err)
	}
	plan.receipt.Created = changed
	if plan.receipt.Created == nil {
		plan.receipt.Created = []model.Entry{}
	}
	return plan.receipt, nil
}

func (a *Archives) validateExtraction(q ArchiveExtractRequest) error {
	if q.Conflict != ArchiveReject && q.Conflict != ArchiveSkip && q.Conflict != ArchiveRename {
		return model.ErrInvalid
	}
	if q.FolderName != "" {
		if _, err := a.files.normalizedName(q.FolderName); err != nil {
			return err
		}
	}
	return a.validateSelection(q.Selection)
}

func (a *Archives) prepareExtraction(ctx context.Context, owner, id string, q ArchiveExtractRequest) (model.Entry, archivePlan, map[string][]byte, error) {
	if err := a.validateExtraction(q); err != nil {
		return model.Entry{}, archivePlan{}, nil, err
	}
	source, parsed, err := a.parse(ctx, owner, id, q.ExpectedRevision, q.Password, q.Selection)
	if err != nil {
		return model.Entry{}, archivePlan{}, nil, err
	}
	entries, err := a.files.repo.ReadBounded(ctx, owner, a.files.policy.SearchTreeEntries)
	if err != nil {
		return model.Entry{}, archivePlan{}, nil, err
	}
	plan, err := a.plan(ctx, owner, entries, archiveMembersForSelection(parsed.Members, q.Selection), q)
	if err != nil {
		return model.Entry{}, archivePlan{}, nil, err
	}
	payloads := map[string][]byte{}
	for _, payload := range parsed.Payloads {
		payloads[payload.Path] = payload.Content
	}
	return source, plan, payloads, nil
}

func (a *Archives) stageExtraction(ctx context.Context, plan *archivePlan, payloads map[string][]byte) ([]string, error) {
	staged := []string{}
	for i, entry := range plan.receipt.Created {
		if err := ctx.Err(); err != nil {
			return staged, err
		}
		if entry.Kind != model.File {
			continue
		}
		content, ok := payloads[plan.sourcePath[entry.ID]]
		if !ok {
			return staged, model.ErrInvalid
		}
		entry.MediaType = mime.TypeByExtension(strings.ToLower(path.Ext(entry.Name)))
		if entry.MediaType == "" {
			entry.MediaType = http.DetectContentType(content)
		}
		hash := sha256.Sum256(content)
		entry.ContentSHA = hex.EncodeToString(hash[:])
		plan.receipt.Created[i] = entry
		staged = append(staged, entry.ObjectKey)
		if err := a.files.content.Put(ctx, entry.ObjectKey, content, entry.MediaType); err != nil {
			return staged, fmt.Errorf("write archive candidate: %w", err)
		}
	}
	return staged, nil
}

func (a *Archives) archivePublication(source model.Entry, plan archivePlan, q ArchiveExtractRequest) func([]model.Entry) ([]model.Entry, error) {
	return func(current []model.Entry) ([]model.Entry, error) {
		latest, ok := model.Find(current, source.ID)
		if !ok || !model.Visible(current, latest) {
			return nil, model.ErrMissing
		}
		if latest.ObjectKey != source.ObjectKey || latest.ContentRevision != q.ExpectedRevision {
			return nil, model.ErrConflict
		}
		if err := model.Parent(current, q.ParentID); err != nil {
			return nil, err
		}
		for _, previous := range plan.reused {
			now, ok := model.Find(current, previous.ID)
			if !ok || now.Kind != model.Folder || !model.Visible(current, now) || now.ParentID != previous.ParentID || now.Name != previous.Name {
				return nil, model.ErrConflict
			}
		}
		known := append([]model.Entry(nil), current...)
		for _, entry := range plan.receipt.Created {
			if err := model.Parent(known, entry.ParentID); err != nil {
				return nil, err
			}
			if err := model.Available(known, "", entry.ParentID, entry.NormalizedName); err != nil {
				return nil, err
			}
			known = append(known, entry)
		}
		used := model.Used(current)
		if used > a.files.policy.QuotaBytes || plan.bytes > a.files.policy.QuotaBytes-used {
			return nil, model.ErrQuota
		}
		if len(current)+len(plan.receipt.Created) > a.files.policy.SearchTreeEntries {
			return nil, model.ErrTooLarge
		}
		return plan.receipt.Created, nil
	}
}
func (a *Archives) compensate(ctx context.Context, owner string, keys []string, cause error) error {
	cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()
	failed := []string{}
	result := cause
	for _, key := range keys {
		if err := a.files.content.Delete(cleanup, key); err != nil {
			result = errors.Join(result, ErrCleanup, fmt.Errorf("archive compensation: %w", err))
			failed = append(failed, key)
		}
	}
	debt, debtCancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer debtCancel()
	for _, key := range failed {
		result = errors.Join(result, a.files.repo.RecordCleanup(debt, owner, key))
	}
	return result
}
