package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type TrashPurgeScope string

const (
	TrashPurgeSelection TrashPurgeScope = "selection"
	TrashPurgeAll       TrashPurgeScope = "all"
)

type TrashPurgeSelectionInput struct {
	Scope TrashPurgeScope `json:"scope" enum:"selection,all"`
	IDs   []string        `json:"ids" maxItems:"500"`
}

type TrashPurgePreview struct {
	RootCount  int    `json:"rootCount"`
	EntryCount int    `json:"entryCount"`
	Bytes      int64  `json:"bytes"`
	Snapshot   string `json:"snapshot"`
}

type TrashPurgeRepository interface {
	ReadBounded(context.Context, string, int) ([]model.Entry, error)
	RemoveTrash(context.Context, string, int, func([]model.Entry) ([]string, error)) error
}

type TrashPurge struct {
	repository TrashPurgeRepository
	treeLimit  int
	batchLimit int
}

func NewTrashPurge(repository TrashPurgeRepository, policy Policy) (*TrashPurge, error) {
	if repository == nil || policy.SearchTreeEntries < 1 || policy.SearchTreeEntries > DefaultSearchTreeEntries || policy.MaxBatchEntries < 1 || policy.MaxBatchEntries > DefaultMaxBatchEntries {
		return nil, fmt.Errorf("trash purge dependencies or budgets are invalid")
	}
	return &TrashPurge{repository: repository, treeLimit: policy.SearchTreeEntries, batchLimit: policy.MaxBatchEntries}, nil
}

func (s *TrashPurge) Preview(ctx context.Context, owner string, input TrashPurgeSelectionInput) (TrashPurgePreview, error) {
	if err := s.validate(input); err != nil {
		return TrashPurgePreview{}, err
	}
	entries, err := s.repository.ReadBounded(ctx, owner, s.treeLimit)
	if err != nil {
		return TrashPurgePreview{}, err
	}
	preview, _, err := planTrashPurge(ctx, owner, input, entries)
	return preview, err
}

func (s *TrashPurge) Confirm(ctx context.Context, owner string, input TrashPurgeSelectionInput, snapshot string) (TrashPurgePreview, error) {
	if err := s.validate(input); err != nil {
		return TrashPurgePreview{}, err
	}
	if len(snapshot) != hex.EncodedLen(sha256.Size) {
		return TrashPurgePreview{}, model.ErrInvalid
	}
	if _, err := hex.DecodeString(snapshot); err != nil {
		return TrashPurgePreview{}, model.ErrInvalid
	}
	var result TrashPurgePreview
	err := s.repository.RemoveTrash(ctx, owner, s.treeLimit, func(entries []model.Entry) ([]string, error) {
		preview, ids, err := planTrashPurge(ctx, owner, input, entries)
		if err != nil {
			return nil, err
		}
		if snapshot != preview.Snapshot {
			return nil, model.ErrConflict
		}
		result = preview
		return ids, nil
	})
	if err != nil {
		return TrashPurgePreview{}, err
	}
	return result, nil
}

func (s *TrashPurge) validate(input TrashPurgeSelectionInput) error {
	switch input.Scope {
	case TrashPurgeAll:
		if len(input.IDs) != 0 {
			return model.ErrInvalid
		}
	case TrashPurgeSelection:
		if len(input.IDs) == 0 || len(input.IDs) > s.batchLimit {
			return model.ErrInvalid
		}
		seen := make(map[string]bool, len(input.IDs))
		for _, id := range input.IDs {
			if model.ValidateTransferID(id) != nil || seen[id] {
				return model.ErrInvalid
			}
			seen[id] = true
		}
	default:
		return model.ErrInvalid
	}
	return nil
}

// planTrashPurge 只沿本人的目录边遍历，并用相同内容生成可重建的确认快照。
func planTrashPurge(ctx context.Context, owner string, input TrashPurgeSelectionInput, entries []model.Entry) (TrashPurgePreview, []string, error) {
	type stamp struct {
		ID, ParentID                     string
		UpdatedAt                        time.Time
		TrashedAt                        *time.Time
		ContentRevision, HistoryRevision int64
		SizeBytes                        int64
	}
	index := make(map[string]model.Entry, len(entries))
	children := make(map[string][]string)
	roots := append([]string(nil), input.IDs...)
	for _, entry := range entries {
		if entry.OwnerID != owner || entry.ID == "" || index[entry.ID].ID != "" {
			return TrashPurgePreview{}, nil, fmt.Errorf("trash purge entry identity invariant")
		}
		index[entry.ID] = entry
		children[entry.ParentID] = append(children[entry.ParentID], entry.ID)
		if input.Scope == TrashPurgeAll && entry.TrashedAt != nil {
			roots = append(roots, entry.ID)
		}
	}
	for _, id := range roots {
		entry, exists := index[id]
		if !exists {
			return TrashPurgePreview{}, nil, model.ErrMissing
		}
		if entry.TrashedAt == nil {
			return TrashPurgePreview{}, nil, model.ErrConflict
		}
	}
	sort.Strings(roots)
	queue := append([]string(nil), roots...)
	targets := make(map[string]model.Entry)
	for cursor := 0; cursor < len(queue); cursor++ {
		if err := ctx.Err(); err != nil {
			return TrashPurgePreview{}, nil, err
		}
		id := queue[cursor]
		if _, visited := targets[id]; visited {
			continue
		}
		entry := index[id]
		targets[id] = entry
		if len(children[id]) != 0 && entry.Kind != model.Folder {
			return TrashPurgePreview{}, nil, fmt.Errorf("trash purge parent kind invariant")
		}
		queue = append(queue, children[id]...)
	}
	ids := make([]string, 0, len(targets))
	for id := range targets {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	stamps := make([]stamp, 0, len(ids))
	selected := make([]model.Entry, 0, len(ids))
	for _, id := range ids {
		entry := targets[id]
		stamps = append(stamps, stamp{entry.ID, entry.ParentID, entry.UpdatedAt.UTC(), entry.TrashedAt, entry.ContentRevision, entry.HistoryRevision, entry.SizeBytes})
		selected = append(selected, entry)
	}
	encoded, err := json.Marshal(struct {
		Owner  string
		Scope  TrashPurgeScope
		Roots  []string
		Target []stamp
	}{owner, input.Scope, roots, stamps})
	if err != nil {
		return TrashPurgePreview{}, nil, fmt.Errorf("encode trash purge snapshot: %w", err)
	}
	digest := sha256.Sum256(encoded)
	return TrashPurgePreview{RootCount: len(roots), EntryCount: len(ids), Bytes: model.Used(selected), Snapshot: hex.EncodeToString(digest[:])}, ids, nil
}
