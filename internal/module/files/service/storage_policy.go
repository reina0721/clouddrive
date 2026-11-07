package service

import (
	"context"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/clock"
)

const storageUsageTimeout = 5 * time.Second

type StorageBackend string

const (
	StorageBackendDisabled StorageBackend = "disabled"
	StorageBackendLocal    StorageBackend = "local"
	StorageBackendS3       StorageBackend = "s3"
	StorageBackendMinIO    StorageBackend = "minio"
)

type StorageLimits struct {
	MaxFileBytes int64 `json:"maxFileBytes" minimum:"1"`
	ChunkBytes   int64 `json:"chunkBytes" minimum:"1"`
}

type StorageLimitOverrides struct {
	MaxFileBytes *int64 `json:"maxFileBytes,omitempty" minimum:"1"`
	ChunkBytes   *int64 `json:"chunkBytes,omitempty" minimum:"1"`
}

type StoredStoragePolicy struct {
	Revision  int64                 `json:"revision" minimum:"0" maximum:"9007199254740991"`
	Overrides StorageLimitOverrides `json:"overrides"`
}

type StoragePolicyView struct {
	StoredStoragePolicy
	Backend        StorageBackend `json:"backend" enum:"disabled,local,s3,minio"`
	Defaults       StorageLimits  `json:"defaults"`
	Configured     StorageLimits  `json:"configured"`
	Active         StorageLimits  `json:"active"`
	PendingRestart bool           `json:"pendingRestart"`
}

type StorageUsage struct {
	BlobCount         int64 `json:"blobCount" minimum:"0"`
	BlobBytes         int64 `json:"blobBytes" minimum:"0"`
	CurrentReferences int64 `json:"currentReferences" minimum:"0"`
	HistoryReferences int64 `json:"historyReferences" minimum:"0"`
	PendingCount      int64 `json:"pendingCount" minimum:"0"`
	PendingBytes      int64 `json:"pendingBytes" minimum:"0"`
}

type StorageUsageSnapshot struct {
	StorageUsage
	CheckedAt time.Time `json:"checkedAt"`
}

type StoragePolicyRepository interface {
	ReadStoragePolicy(context.Context) (StoredStoragePolicy, error)
	SaveStoragePolicy(context.Context, StoredStoragePolicy) (StoredStoragePolicy, error)
	ReadStorageUsage(context.Context) (StorageUsage, error)
}

type StoragePolicy struct {
	store    StoragePolicyRepository
	clock    clock.Clock
	backend  StorageBackend
	defaults StorageLimits
	active   StorageLimits
}

func NewStoragePolicy(store StoragePolicyRepository, source clock.Clock, backend StorageBackend, defaults, active StorageLimits) (*StoragePolicy, error) {
	if store == nil || source == nil {
		return nil, fmt.Errorf("storage policy dependencies are required")
	}
	return &StoragePolicy{store: store, clock: source, backend: backend, defaults: defaults, active: active}, nil
}

func (l StorageLimits) Resolve(overrides StorageLimitOverrides) StorageLimits {
	if overrides.MaxFileBytes != nil {
		l.MaxFileBytes = min(l.MaxFileBytes, *overrides.MaxFileBytes)
	}
	if overrides.ChunkBytes != nil {
		l.ChunkBytes = min(l.ChunkBytes, *overrides.ChunkBytes)
	}
	return l
}

func (o StorageLimitOverrides) valid(limits StorageLimits) bool {
	return validSetting(o.MaxFileBytes, 1, limits.MaxFileBytes) && validSetting(o.ChunkBytes, 1, limits.ChunkBytes)
}

func (v StoredStoragePolicy) ValidateStored() error {
	if v.Revision < 1 || v.Revision > model.MaxPreferenceRevision ||
		!v.Overrides.valid(StorageLimits{MaxFileBytes: DefaultMaxFileBytes, ChunkBytes: DefaultTransferChunkBytes}) {
		return model.ErrInvalid
	}
	return nil
}

func (s *StoragePolicy) view(stored StoredStoragePolicy) StoragePolicyView {
	configured := s.defaults.Resolve(stored.Overrides)
	return StoragePolicyView{StoredStoragePolicy: stored, Backend: s.backend, Defaults: s.defaults,
		Configured: configured, Active: s.active, PendingRestart: configured != s.active}
}

func (s *StoragePolicy) Read(ctx context.Context) (StoragePolicyView, error) {
	stored, err := s.store.ReadStoragePolicy(ctx)
	if err != nil {
		return StoragePolicyView{}, err
	}
	return s.view(stored), nil
}

func (s *StoragePolicy) Save(ctx context.Context, input StoredStoragePolicy) (StoragePolicyView, error) {
	if input.Revision < 0 || input.Revision >= model.MaxPreferenceRevision || !input.Overrides.valid(s.defaults) {
		return StoragePolicyView{}, model.ErrInvalid
	}
	stored, err := s.store.SaveStoragePolicy(ctx, input)
	if err != nil {
		return StoragePolicyView{}, err
	}
	return s.view(stored), nil
}

func (s *StoragePolicy) Usage(ctx context.Context) (StorageUsageSnapshot, error) {
	bounded, cancel := context.WithTimeout(ctx, storageUsageTimeout)
	defer cancel()
	usage, err := s.store.ReadStorageUsage(bounded)
	if err != nil {
		return StorageUsageSnapshot{}, err
	}
	return StorageUsageSnapshot{StorageUsage: usage, CheckedAt: s.clock.Now().UTC()}, nil
}
