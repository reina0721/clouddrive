package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/clock"
)

const (
	TrashExpiryTaskID   = "files.trash.expire"
	TrashExpiryInterval = time.Minute
	TrashExpiryBatch    = 32
	trashExpiryRetry    = 5 * time.Minute
)

// TrashRetentionRepository 只提供本人规则、待处理快照及回收事务。
type TrashRetentionRepository interface {
	ReadTrashRetention(context.Context, string) (model.TrashRetention, error)
	SaveTrashRetention(context.Context, string, model.TrashRetention) (model.TrashRetention, error)
	FindDueTrash(context.Context, time.Time) ([]model.TrashExpiryCandidate, error)
	RemoveTrash(context.Context, string, int, func([]model.Entry) ([]string, error)) error
	DeferTrashExpiry(context.Context, string, []model.TrashExpiryCandidate, time.Time) error
}

type TrashRetention struct {
	repository TrashRetentionRepository
	clock      clock.Clock
	treeLimit  int
}

func NewTrashRetention(repository TrashRetentionRepository, currentClock clock.Clock, policy Policy) (*TrashRetention, error) {
	if repository == nil || currentClock == nil || policy.SearchTreeEntries < 1 || policy.SearchTreeEntries > DefaultSearchTreeEntries {
		return nil, fmt.Errorf("trash retention dependencies or tree budget are invalid")
	}
	return &TrashRetention{repository: repository, clock: currentClock, treeLimit: policy.SearchTreeEntries}, nil
}

func (s *TrashRetention) Get(ctx context.Context, owner string) (model.TrashRetention, error) {
	return s.repository.ReadTrashRetention(ctx, owner)
}

func (s *TrashRetention) Save(ctx context.Context, owner string, policy model.TrashRetention) (model.TrashRetention, error) {
	return s.repository.SaveTrashRetention(ctx, owner, policy)
}

// Dispatch 仅重试仍与数据库候选快照一致的回收转换。
func (s *TrashRetention) Dispatch(ctx context.Context) error {
	now := s.clock.Now().UTC()
	candidates, err := s.repository.FindDueTrash(ctx, now)
	if err != nil {
		return fmt.Errorf("scan due trash: %w", err)
	}
	groups := make(map[string][]model.TrashExpiryCandidate)
	var owners []string
	for _, candidate := range candidates {
		if _, exists := groups[candidate.OwnerID]; !exists {
			owners = append(owners, candidate.OwnerID)
		}
		groups[candidate.OwnerID] = append(groups[candidate.OwnerID], candidate)
	}
	var failures []error
	for _, owner := range owners {
		if err := ctx.Err(); err != nil {
			return errors.Join(append(failures, err)...)
		}
		if err := s.expireOwner(ctx, owner, groups[owner], now); err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}

func (s *TrashRetention) expireOwner(ctx context.Context, owner string, candidates []model.TrashExpiryCandidate, now time.Time) error {
	var deferred []model.TrashExpiryCandidate
	err := s.repository.RemoveTrash(ctx, owner, s.treeLimit, func(entries []model.Entry) ([]string, error) {
		tree, err := newTrashTree(owner, entries)
		if err != nil {
			return nil, err
		}
		remove := make(map[string]bool)
		for _, candidate := range candidates {
			if candidate.TrashExpiresAt.After(now) || candidate.TrashRetryAt.After(now) || !candidate.Matches(tree.entries[candidate.ID]) {
				continue
			}
			targets, err := tree.expand(ctx, []string{candidate.ID})
			if err != nil {
				return nil, err
			}
			if trashContainsProtectedEntry(targets, now) {
				deferred = append(deferred, candidate)
				continue
			}
			for id := range targets {
				remove[id] = true
			}
		}
		ids := make([]string, 0, len(remove))
		for id := range remove {
			ids = append(ids, id)
		}
		slices.Sort(ids)
		return ids, nil
	})
	if err != nil {
		err = fmt.Errorf("expire trash transaction: %w", err)
		deferred = candidates
	}
	if len(deferred) == 0 || ctx.Err() != nil {
		return err
	}
	if retryErr := s.repository.DeferTrashExpiry(ctx, owner, deferred, now.Add(trashExpiryRetry)); retryErr != nil {
		return errors.Join(err, fmt.Errorf("defer trash expiry: %w", retryErr))
	}
	return err
}

func trashContainsProtectedEntry(entries map[string]model.Entry, now time.Time) bool {
	for _, entry := range entries {
		if entry.TrashedAt != nil && (entry.TrashExpiresAt == nil || entry.TrashExpiresAt.After(now)) {
			return true
		}
	}
	return false
}
