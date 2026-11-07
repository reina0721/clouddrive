package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/clock"
)

const (
	BlobReclamationTaskID  = "files.blob-reclamation"
	BlobReclamationGrace   = 24 * time.Hour
	blobReclamationTimeout = 3 * time.Second
	blobReclamationBatch   = 16
	blobReclamationRetry   = time.Hour
)

type BlobReclamationPolicy struct {
	Automatic bool          `mapstructure:"automatic"`
	Interval  time.Duration `mapstructure:"interval"`
}

func DefaultBlobReclamationPolicy() BlobReclamationPolicy {
	return BlobReclamationPolicy{Interval: 15 * time.Minute}
}

func (p BlobReclamationPolicy) Validate() error {
	if p.Interval < time.Minute || p.Interval > 24*time.Hour {
		return fmt.Errorf("invalid blob reclamation interval")
	}
	return nil
}

type BlobCandidate struct {
	ID         string    `json:"id"`
	SizeBytes  int64     `json:"sizeBytes"`
	DetachedAt time.Time `json:"detachedAt"`
	ReadyAt    time.Time `json:"readyAt"`
	Ready      bool      `json:"ready"`
}

type BlobCandidatePage struct {
	Items     []BlobCandidate `json:"items"`
	Total     int64           `json:"total"`
	Page      int             `json:"page"`
	PageSize  int             `json:"pageSize"`
	Automatic bool            `json:"automatic"`
}

type BlobReclamationRepository interface {
	BlobCandidates(context.Context, time.Time, int) (BlobCandidatePage, error)
	DueBlobCandidates(context.Context, time.Time, int) ([]string, error)
	ReclaimBlob(context.Context, string, time.Time, BlobReclamationMode, func(context.Context, string) error) error
	DeferBlobReclamation(context.Context, string, time.Time, time.Time) error
}

type BlobReclamationMode uint8

const (
	BlobReclamationManual BlobReclamationMode = iota
	BlobReclamationScheduled
)

type BlobObjectRemover interface {
	Delete(context.Context, string) error
}

type BlobReclamation struct {
	store   BlobReclamationRepository
	content BlobObjectRemover
	clock   clock.Clock
	policy  BlobReclamationPolicy
}

func NewBlobReclamation(store BlobReclamationRepository, content BlobObjectRemover, currentClock clock.Clock, policy BlobReclamationPolicy) (*BlobReclamation, error) {
	if store == nil || content == nil || currentClock == nil {
		return nil, fmt.Errorf("blob reclamation dependencies are required")
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	return &BlobReclamation{store: store, content: content, clock: currentClock, policy: policy}, nil
}

func (s *BlobReclamation) List(ctx context.Context, page int) (BlobCandidatePage, error) {
	if page < 1 || page > MaxInventoryPage {
		return BlobCandidatePage{}, model.ErrInvalid
	}
	result, err := s.store.BlobCandidates(ctx, s.clock.Now().UTC(), page)
	result.Automatic = s.policy.Automatic
	return result, err
}

func (s *BlobReclamation) Remove(ctx context.Context, id string) error {
	if model.ValidateTransferID(id) != nil {
		return model.ErrMissing
	}
	return s.remove(ctx, publishedBlobKeyPrefix+id, s.clock.Now().UTC(), BlobReclamationManual)
}

func (s *BlobReclamation) remove(ctx context.Context, key string, now time.Time, mode BlobReclamationMode) error {
	bounded, cancel := context.WithTimeout(ctx, blobReclamationTimeout)
	defer cancel()
	return s.store.ReclaimBlob(bounded, key, now, mode, s.content.Delete)
}

// Dispatch 每项独立提交；存储故障时保留候选并延后调度，允许其他项继续。
func (s *BlobReclamation) Dispatch(ctx context.Context) error {
	if !s.policy.Automatic {
		return nil
	}
	now := s.clock.Now().UTC()
	keys, err := s.store.DueBlobCandidates(ctx, now, blobReclamationBatch)
	if err != nil {
		return err
	}
	var failures error
	for _, key := range keys {
		if err := ctx.Err(); err != nil {
			return errors.Join(failures, err)
		}
		err := s.remove(ctx, key, now, BlobReclamationScheduled)
		if err == nil || errors.Is(err, model.ErrMissing) || errors.Is(err, model.ErrConflict) {
			continue
		}
		failures = errors.Join(failures, err, s.store.DeferBlobReclamation(ctx, key, now, now.Add(blobReclamationRetry)))
	}
	return failures
}
