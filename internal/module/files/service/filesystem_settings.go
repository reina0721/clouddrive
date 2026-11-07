package service

import (
	"context"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const (
	MinFileScanSeconds = 60
	MaxFileScanSeconds = 24 * 60 * 60
)

type FilesystemOverrides struct {
	Pagination       *WorkspacePagination `json:"pagination,omitempty" enum:"numbered,cursor"`
	MaxPageSize      *int                 `json:"maxPageSize,omitempty" minimum:"1" maximum:"200"`
	TextBytes        *int64               `json:"textBytes,omitempty" minimum:"1"`
	BatchEntries     *int                 `json:"batchEntries,omitempty" minimum:"1"`
	HistoryEnabled   *bool                `json:"historyEnabled,omitempty"`
	HistoryPerFile   *int                 `json:"historyPerFile,omitempty" minimum:"1"`
	TrashScanSeconds *int                 `json:"trashScanSeconds,omitempty" minimum:"60" maximum:"86400"`
	BlobScanSeconds  *int                 `json:"blobScanSeconds,omitempty" minimum:"60" maximum:"86400"`
	AutomaticBlob    *bool                `json:"automaticBlob,omitempty"`
}

type StoredFilesystemSettings struct {
	Revision  int64               `json:"revision" minimum:"0"`
	Overrides FilesystemOverrides `json:"overrides"`
}

type FilesystemValues struct {
	Pagination       WorkspacePagination `json:"pagination" enum:"numbered,cursor"`
	MaxPageSize      int                 `json:"maxPageSize"`
	TextBytes        int64               `json:"textBytes"`
	BatchEntries     int                 `json:"batchEntries"`
	HistoryEnabled   bool                `json:"historyEnabled"`
	HistoryPerFile   int                 `json:"historyPerFile"`
	TrashScanSeconds float64             `json:"trashScanSeconds"`
	BlobScanSeconds  float64             `json:"blobScanSeconds"`
	AutomaticBlob    bool                `json:"automaticBlob"`
}

type FilesystemSettingsView struct {
	StoredFilesystemSettings
	Defaults                FilesystemValues `json:"defaults"`
	Configured              FilesystemValues `json:"configured"`
	Active                  FilesystemValues `json:"active"`
	PendingRestart          bool             `json:"pendingRestart"`
	TrashSchedulerAvailable bool             `json:"trashSchedulerAvailable"`
	BlobSchedulerAvailable  bool             `json:"blobSchedulerAvailable"`
}

type FilesystemSettingsRepository interface {
	ReadFilesystemSettings(context.Context) (StoredFilesystemSettings, error)
	SaveFilesystemSettings(context.Context, StoredFilesystemSettings) (StoredFilesystemSettings, error)
}

// FilesystemRuntime 是当前应用实例固定的文件配置。一个请求内的预算不会随设置写入改变。
type FilesystemRuntime struct {
	Policy         Policy
	Blob           BlobReclamationPolicy
	TrashInterval  time.Duration
	TrashScheduled bool
	BlobScheduled  bool
}

func (r FilesystemRuntime) values() FilesystemValues {
	return FilesystemValues{
		Pagination: r.Policy.WorkspacePagination, MaxPageSize: r.Policy.WorkspaceMaxPageSize,
		TextBytes: r.Policy.MaxTextBytes, BatchEntries: r.Policy.MaxBatchEntries, HistoryEnabled: r.Policy.HistoryEnabled,
		HistoryPerFile: r.Policy.HistoryPerFile, TrashScanSeconds: r.TrashInterval.Seconds(),
		BlobScanSeconds: r.Blob.Interval.Seconds(), AutomaticBlob: r.Blob.Automatic,
	}
}

// Resolve 保留已存覆盖；部署降低硬上限时，仅降低生效值。
func (r FilesystemRuntime) Resolve(overrides FilesystemOverrides) FilesystemRuntime {
	if overrides.Pagination != nil {
		r.Policy.WorkspacePagination = *overrides.Pagination
	}
	if overrides.MaxPageSize != nil {
		r.Policy.WorkspaceMaxPageSize = min(*overrides.MaxPageSize, r.Policy.WorkspaceMaxPageSize)
	}
	if overrides.TextBytes != nil {
		r.Policy.MaxTextBytes = min(*overrides.TextBytes, r.Policy.MaxTextBytes)
	}
	if overrides.BatchEntries != nil {
		r.Policy.MaxBatchEntries = min(*overrides.BatchEntries, r.Policy.MaxBatchEntries)
	}
	if overrides.HistoryEnabled != nil {
		r.Policy.HistoryEnabled = *overrides.HistoryEnabled && r.Policy.HistoryEnabled
	}
	if overrides.HistoryPerFile != nil {
		r.Policy.HistoryPerFile = min(*overrides.HistoryPerFile, r.Policy.HistoryPerFile)
	}
	if overrides.TrashScanSeconds != nil {
		r.TrashInterval = time.Duration(*overrides.TrashScanSeconds) * time.Second
	}
	if overrides.BlobScanSeconds != nil {
		r.Blob.Interval = time.Duration(*overrides.BlobScanSeconds) * time.Second
	}
	if overrides.AutomaticBlob != nil {
		r.Blob.Automatic = *overrides.AutomaticBlob
	}
	return r
}

func validSetting[T ~int | ~int64](value *T, minimum, maximum T) bool {
	return value == nil || *value >= minimum && *value <= maximum
}

func (o FilesystemOverrides) validate(policy Policy) error {
	if (o.Pagination != nil && !o.Pagination.valid()) ||
		!validSetting(o.MaxPageSize, 1, policy.WorkspaceMaxPageSize) ||
		!validSetting(o.TextBytes, 1, policy.MaxTextBytes) ||
		!validSetting(o.BatchEntries, 1, policy.MaxBatchEntries) ||
		!validSetting(o.HistoryPerFile, 1, policy.HistoryPerFile) ||
		!validSetting(o.TrashScanSeconds, MinFileScanSeconds, MaxFileScanSeconds) ||
		!validSetting(o.BlobScanSeconds, MinFileScanSeconds, MaxFileScanSeconds) ||
		(o.HistoryEnabled != nil && *o.HistoryEnabled && !policy.HistoryEnabled) {
		return model.ErrInvalid
	}
	return nil
}

// ValidateStored 与当前部署分开检查，允许旧值在部署收紧后继续显示及重置。
func (v StoredFilesystemSettings) ValidateStored() error {
	if v.Revision < 1 || v.Revision > model.MaxPreferenceRevision {
		return model.ErrInvalid
	}
	return v.Overrides.validate(DefaultPolicy())
}

type FilesystemSettings struct {
	store    FilesystemSettingsRepository
	defaults FilesystemRuntime
	active   FilesystemRuntime
}

func NewFilesystemSettings(store FilesystemSettingsRepository, defaults, active FilesystemRuntime) (*FilesystemSettings, error) {
	if store == nil {
		return nil, fmt.Errorf("filesystem settings repository is required")
	}
	return &FilesystemSettings{store: store, defaults: defaults, active: active}, nil
}

func (s *FilesystemSettings) view(stored StoredFilesystemSettings) FilesystemSettingsView {
	configured, active := s.defaults.Resolve(stored.Overrides).values(), s.active.values()
	return FilesystemSettingsView{
		StoredFilesystemSettings: stored, Defaults: s.defaults.values(), Configured: configured, Active: active,
		PendingRestart: configured != active, TrashSchedulerAvailable: s.active.TrashScheduled, BlobSchedulerAvailable: s.active.BlobScheduled,
	}
}

func (s *FilesystemSettings) Read(ctx context.Context) (FilesystemSettingsView, error) {
	stored, err := s.store.ReadFilesystemSettings(ctx)
	if err != nil {
		return FilesystemSettingsView{}, err
	}
	return s.view(stored), nil
}

func (s *FilesystemSettings) Save(ctx context.Context, input StoredFilesystemSettings) (FilesystemSettingsView, error) {
	if input.Revision < 0 || input.Revision >= model.MaxPreferenceRevision {
		return FilesystemSettingsView{}, model.ErrInvalid
	}
	if err := input.Overrides.validate(s.defaults.Policy); err != nil {
		return FilesystemSettingsView{}, err
	}
	stored, err := s.store.SaveFilesystemSettings(ctx, input)
	if err != nil {
		return FilesystemSettingsView{}, err
	}
	return s.view(stored), nil
}
