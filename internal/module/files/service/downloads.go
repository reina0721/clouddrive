package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/logger"
)

const DownloadDispatchTaskID = "files.offline.dispatch"
const downloadTransferKeyPrefix = "offline:"
const downloadFallbackName = "download"

func (s *OfflineDownloads) BatchLimit() int { return s.policy.BatchEntries }

// OfflineDownloads 使用既有文件发布和调度生命周期，不自行启动永久worker或持有数据库连接。
type OfflineDownloads struct {
	torrents  *TorrentDownloads
	transfers *Transfers
	repo      DownloadRepository
	source    HTTPDownloadSource
	accounts  DownloadAccountAuthority
	policy    DownloadPolicy
	available bool
	logger    logger.Logger
	activeMu  sync.Mutex
	active    map[string]downloadRun
}
type downloadRun struct {
	token  string
	cancel context.CancelCauseFunc
}

func NewOfflineDownloads(transfers *Transfers, repository DownloadRepository, source HTTPDownloadSource, accounts DownloadAccountAuthority, policy DownloadPolicy, dispatcherEnabled bool, torrents *TorrentDownloads, logging logger.Logger) (*OfflineDownloads, error) {
	if transfers == nil || repository == nil || source == nil || accounts == nil || torrents == nil || logging == nil {
		return nil, fmt.Errorf("offline download dependencies incomplete")
	}
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	return &OfflineDownloads{torrents: torrents, transfers: transfers, repo: repository, source: source, accounts: accounts, policy: policy, available: policy.Enabled && dispatcherEnabled, logger: logging, active: make(map[string]downloadRun)}, nil
}

type DownloadCreate struct {
	URI       string `json:"uri" maxLength:"4096"`
	ParentID  string `json:"parentId" maxLength:"36"`
	Name      string `json:"name" maxLength:"255"`
	ClientKey string `json:"clientKey" minLength:"16" maxLength:"64"`
}

// DownloadSummary 只公开来源origin；完整含签名URL需用户明确读取且不进入日志。
type DownloadSummary struct {
	NodeID               string                `json:"nodeId"`
	NodeName             string                `json:"nodeName"`
	FileCount            int                   `json:"fileCount"`
	SelectedCount        int                   `json:"selectedCount"`
	ResultIsFolder       bool                  `json:"resultIsFolder"`
	CancelRequested      bool                  `json:"cancelRequested"`
	CanCopySource        bool                  `json:"canCopySource"`
	MetadataLimited      bool                  `json:"metadataLimited"`
	ID                   string                `json:"id"`
	ClientKey            string                `json:"clientKey"`
	Kind                 model.DownloadKind    `json:"kind"`
	Origin               string                `json:"origin"`
	Name                 string                `json:"name"`
	ParentID             string                `json:"parentId"`
	DestinationPath      string                `json:"destinationPath"`
	DestinationAvailable bool                  `json:"destinationAvailable"`
	State                model.DownloadState   `json:"state"`
	FailureCode          model.DownloadFailure `json:"failureCode"`
	SourceStatus         int                   `json:"sourceStatus"`
	DeclaredBytes        *int64                `json:"declaredBytes"`
	ReceivedBytes        int64                 `json:"receivedBytes"`
	RateBytesPerSecond   float64               `json:"rateBytesPerSecond"`
	ProgressAt           *time.Time            `json:"progressAt"`
	Resumable            bool                  `json:"resumable"`
	Attempts             int                   `json:"attempts"`
	Revision             int64                 `json:"revision"`
	EntryID              string                `json:"entryId"`
	ResultAvailable      bool                  `json:"resultAvailable"`
	CleanupPending       bool                  `json:"cleanupPending"`
	CreatedAt            time.Time             `json:"createdAt"`
	UpdatedAt            time.Time             `json:"updatedAt"`
	StartedAt            *time.Time            `json:"startedAt"`
	FinishedAt           *time.Time            `json:"finishedAt"`
	ExpiresAt            time.Time             `json:"expiresAt"`
}
type DownloadListing struct {
	Torrent         TorrentCapabilities `json:"torrent"`
	MetadataLimited bool                `json:"metadataLimited"`
	Items           []DownloadSummary   `json:"items"`
	NextCursor      string              `json:"nextCursor"`
	ActiveCount     int                 `json:"activeCount"`
	FinishedCount   int                 `json:"finishedCount"`
	TotalCount      int                 `json:"totalCount"`
	Available       bool                `json:"available"`
	BatchEntries    int                 `json:"batchEntries"`
	OwnerRecords    int                 `json:"ownerRecords"`
}

func downloadDestination(entries []model.Entry, parent string) (string, bool) {
	if parent == "" {
		return "/", true
	}
	entry, found := model.Find(entries, parent)
	if !found || entry.Kind != model.Folder || !model.Visible(entries, entry) {
		return "", false
	}
	names := []string{}
	for remaining := len(entries) + 1; remaining > 0; remaining-- {
		names = append(names, entry.Name)
		if entry.ParentID == "" {
			for left, right := 0, len(names)-1; left < right; left, right = left+1, right-1 {
				names[left], names[right] = names[right], names[left]
			}
			return "/" + strings.Join(names, "/"), true
		}
		entry, found = model.Find(entries, entry.ParentID)
		if !found {
			return "", false
		}
	}
	return "", false
}

func summarizeDownload(snapshot DownloadSnapshot) DownloadSummary {
	task, child, entries := snapshot.Task, snapshot.Transfers[0], snapshot.Entries
	destination, available := downloadDestination(entries, task.TargetParentID)
	resultAvailable := false
	if child.EntryID != "" {
		entry, found := model.Find(entries, child.EntryID)
		resultAvailable = found && model.Visible(entries, entry) && entry.Kind == model.File
	}
	return DownloadSummary{FileCount: 1, SelectedCount: 1, CanCopySource: true, CancelRequested: task.Intent == model.DownloadCancel, MetadataLimited: snapshot.MetadataLimited, ID: task.ID, ClientKey: task.ClientKey, Kind: task.Kind, Origin: task.SourceOrigin, Name: child.Name, ParentID: task.TargetParentID, DestinationPath: destination, DestinationAvailable: available, State: task.State, FailureCode: task.FailureCode, SourceStatus: task.SourceStatus, DeclaredBytes: task.DeclaredBytes, ReceivedBytes: task.ReceivedBytes, RateBytesPerSecond: task.RateBytesPerSecond, ProgressAt: task.ProgressAt, Resumable: task.ReceivedBytes == 0 || task.ValidatorKind != model.DownloadValidatorNone, Attempts: task.Attempts, Revision: task.Revision, EntryID: child.EntryID, ResultAvailable: resultAvailable, CleanupPending: child.CleanupPending, CreatedAt: task.CreatedAt, UpdatedAt: task.UpdatedAt, StartedAt: task.StartedAt, FinishedAt: task.FinishedAt, ExpiresAt: task.ExpiresAt}
}

func (s *OfflineDownloads) Create(ctx context.Context, owner string, input DownloadCreate) (DownloadSummary, error) {
	if !s.available {
		return DownloadSummary{}, model.ErrDownloadUnavailable
	}
	if err := s.authorize(ctx, owner); err != nil {
		return DownloadSummary{}, err
	}
	uri, origin, err := s.source.Normalize(input.URI)
	if err != nil {
		return DownloadSummary{}, err
	}
	name := input.Name
	if name == "" {
		name = downloadFallbackName
	}
	normalized, err := s.transfers.files.normalizedName(name)
	if err != nil {
		return DownloadSummary{}, err
	}
	taskID, err := s.transfers.files.ids.New()
	if err != nil {
		return DownloadSummary{}, err
	}
	transferID, err := s.transfers.files.ids.New()
	if err != nil {
		return DownloadSummary{}, err
	}
	now := s.transfers.files.clock.Now().UTC()
	task := model.DownloadTask{ID: taskID, OwnerID: owner, Kind: model.DownloadHTTP, SourceURI: uri, SourceOrigin: origin, TargetParentID: input.ParentID, RequestedName: input.Name, ClientKey: input.ClientKey, State: model.DownloadQueued, Intent: model.DownloadRun, Revision: 1, CreatedAt: now, UpdatedAt: now, ExpiresAt: now.Add(s.transfers.policy.Lifetime)}
	if err := model.ValidateDownloadTask(task); err != nil {
		return DownloadSummary{}, err
	}
	child := model.Transfer{ID: transferID, DownloadID: task.ID, OwnerID: owner, ParentID: input.ParentID, Name: name, NormalizedName: normalized, Source: model.TransferSourceOffline, IdempotencyKey: downloadTransferKeyPrefix + input.ClientKey, State: model.TransferPreparing, Revision: 1, CreatedAt: now, UpdatedAt: now, ExpiresAt: task.ExpiresAt, ObjectKey: "files/" + transferID}
	task, err = s.repo.CreateDownload(ctx, task, child, func(snapshot TransferSnapshot) error {
		if snapshot.MetadataLimited {
			return model.ErrDownloadMetadataLimited
		}
		if snapshot.OwnerDownloadRecords >= s.policy.OwnerRecords || snapshot.GlobalDownloadRecords >= s.policy.GlobalRecords {
			return model.ErrDownloadLimit
		}
		if err := model.Parent(snapshot.Entries, input.ParentID); err != nil {
			return err
		}
		if input.Name != "" {
			if err := model.Available(snapshot.Entries, "", input.ParentID, normalized); err != nil {
				return err
			}
		}
		if snapshot.OwnerReservedCount >= int64(s.transfers.policy.OwnerCount) || snapshot.GlobalReservedCount >= int64(s.transfers.policy.GlobalCount) {
			return model.ErrBusy
		}
		return nil
	})
	if err != nil {
		return DownloadSummary{}, err
	}
	return s.Read(ctx, owner, task.ID)
}

func (s *OfflineDownloads) Read(ctx context.Context, owner, id string) (DownloadSummary, error) {
	snapshot, err := s.repo.ReadDownload(ctx, owner, id)
	if err != nil {
		return DownloadSummary{}, err
	}
	if snapshot.Task.Kind == model.DownloadBitTorrent {
		return s.torrents.Read(ctx, owner, id)
	}
	if len(snapshot.Transfers) != 1 {
		return DownloadSummary{}, model.ErrInvalid
	}
	return summarizeDownload(snapshot), nil
}
func (s *OfflineDownloads) List(ctx context.Context, owner string, query DownloadQuery) (DownloadListing, error) {
	page, err := s.repo.ListDownloads(ctx, owner, query, DefaultDownloadPageSize)
	if err != nil {
		return DownloadListing{}, err
	}
	result := DownloadListing{Torrent: s.torrents.Capabilities(), MetadataLimited: page.MetadataLimited, Items: []DownloadSummary{}, NextCursor: page.NextCursor, ActiveCount: page.ActiveCount, FinishedCount: page.FinishedCount, TotalCount: page.TotalCount, Available: s.available, BatchEntries: s.policy.BatchEntries, OwnerRecords: s.policy.OwnerRecords}
	children := make(map[string]model.Transfer, len(page.Transfers))
	for _, child := range page.Transfers {
		children[child.DownloadID] = child
	}
	for _, task := range page.Tasks {
		if task.Kind == model.DownloadBitTorrent {
			summary, err := s.torrents.Read(ctx, owner, task.ID)
			if err != nil {
				return DownloadListing{}, err
			}
			result.Items = append(result.Items, summary)
			continue
		}
		child, found := children[task.ID]
		if !found {
			return DownloadListing{}, model.ErrInvalid
		}
		result.Items = append(result.Items, summarizeDownload(DownloadSnapshot{Task: task, Transfers: []model.Transfer{child}, Entries: page.Entries, MetadataLimited: page.MetadataLimited}))
	}
	return result, nil
}

func (s *OfflineDownloads) Source(ctx context.Context, owner, id string) (string, error) {
	snapshot, err := s.repo.ReadDownload(ctx, owner, id)
	if err != nil {
		return "", err
	}
	if snapshot.Task.Kind == model.DownloadBitTorrent && torrentSourceIsUpload(snapshot.Task.SourceURI) {
		return "", model.ErrUnsupported
	}
	return snapshot.Task.SourceURI, nil
}

func (s *OfflineDownloads) authorize(ctx context.Context, owner string) error {
	allowed, err := s.accounts.AuthorizeDownload(ctx, owner)
	if err != nil {
		return errors.Join(model.ErrDownloadPermission, err)
	}
	if !allowed {
		return model.ErrDownloadPermission
	}
	return nil
}

type DownloadCommand string

const (
	DownloadCommandPause  DownloadCommand = "pause"
	DownloadCommandResume DownloadCommand = "resume"
	DownloadCommandRetry  DownloadCommand = "retry"
	DownloadCommandCancel DownloadCommand = "cancel"
)

func (s *OfflineDownloads) Command(ctx context.Context, owner, id string, revision int64, command DownloadCommand) (DownloadSummary, error) {
	sourceSnapshot, readErr := s.repo.ReadDownload(ctx, owner, id)
	if readErr != nil {
		return DownloadSummary{}, readErr
	}
	if sourceSnapshot.Task.Kind == model.DownloadBitTorrent {
		return s.torrents.Command(ctx, owner, id, revision, command)
	}
	if revision < 1 || revision >= model.MaxDownloadRevision {
		return DownloadSummary{}, model.ErrInvalid
	}
	if command == DownloadCommandResume || command == DownloadCommandRetry {
		if !s.available {
			return DownloadSummary{}, model.ErrDownloadUnavailable
		}
		if err := s.authorize(ctx, owner); err != nil {
			return DownloadSummary{}, err
		}
	}
	_, err := s.repo.ChangeDownload(ctx, owner, id, func(snapshot DownloadSnapshot) (model.DownloadTask, error) {
		task := snapshot.Task
		now := s.transfers.files.clock.Now().UTC()
		if task.Revision != revision || len(snapshot.Transfers) != 1 {
			return task, model.ErrConflict
		}
		child := snapshot.Transfers[0]
		switch command {
		case DownloadCommandPause:
			if task.State != model.DownloadQueued && task.State != model.DownloadFetching && task.State != model.DownloadPublishing {
				return task, model.ErrConflict
			}
			task.Intent = model.DownloadPause
			task.State = model.DownloadPaused
			if task.LeaseValid(now) {
				task.State = model.DownloadPausing
			}
		case DownloadCommandResume, DownloadCommandRetry:
			if snapshot.MetadataLimited {
				return task, model.ErrDownloadMetadataLimited
			}
			wanted := model.DownloadPaused
			if command == DownloadCommandRetry {
				wanted = model.DownloadFailed
			}
			if task.State != wanted || task.LeaseValid(now) || child.Terminal() || !now.Before(task.ExpiresAt) {
				return task, model.ErrConflict
			}
			if task.ReceivedBytes > 0 && task.ValidatorKind == model.DownloadValidatorNone {
				return task, model.ErrDownloadResumeUnsupported
			}
			if task.Attempts >= s.policy.MaxAttempts {
				return task, model.ErrDownloadLimit
			}
			task.State, task.Intent, task.FailureCode, task.SourceStatus = model.DownloadQueued, model.DownloadRun, model.DownloadFailureNone, 0
			task.LeaseToken, task.LeaseUntil, task.FinishedAt = "", nil, nil
		case DownloadCommandCancel:
			if task.State == model.DownloadCompleted || task.State == model.DownloadCanceled || task.State == model.DownloadExpired || child.State == model.TransferCompleted {
				return task, model.ErrConflict
			}
			if task.LeaseValid(now) && task.Intent != model.DownloadRun && task.Intent != model.DownloadPause {
				return task, model.ErrConflict
			}
			task.Intent = model.DownloadCancel
		default:
			return task, model.ErrInvalid
		}
		task.Revision++
		task.UpdatedAt, task.RateBytesPerSecond = now, 0
		return task, nil
	})
	if err != nil {
		return DownloadSummary{}, err
	}
	if command == DownloadCommandPause || command == DownloadCommandCancel {
		s.signal(id, model.ErrDownloadLeaseLost)
	}
	if command == DownloadCommandCancel {
		if err := s.settleCancellation(ctx, owner, id); err != nil {
			return DownloadSummary{}, err
		}
	}
	return s.Read(ctx, owner, id)
}

func (s *OfflineDownloads) signal(id string, cause error) {
	s.activeMu.Lock()
	run, found := s.active[id]
	s.activeMu.Unlock()
	if found {
		run.cancel(cause)
	}
}

func (s *OfflineDownloads) Retarget(ctx context.Context, owner, id string, revision int64, parent, name string) (DownloadSummary, error) {
	sourceSnapshot, readErr := s.repo.ReadDownload(ctx, owner, id)
	if readErr != nil {
		return DownloadSummary{}, readErr
	}
	if sourceSnapshot.Task.Kind == model.DownloadBitTorrent {
		return s.torrents.Retarget(ctx, owner, id, revision, parent, name)
	}
	if err := s.authorize(ctx, owner); err != nil {
		return DownloadSummary{}, err
	}
	normalized, err := s.transfers.files.normalizedName(name)
	if err != nil {
		return DownloadSummary{}, err
	}
	_, err = s.repo.RetargetDownload(ctx, owner, id, revision, parent, name, normalized, func(snapshot DownloadSnapshot) error {
		if snapshot.MetadataLimited {
			return model.ErrDownloadMetadataLimited
		}
		if err := model.Parent(snapshot.Entries, parent); err != nil {
			return err
		}
		return model.Available(snapshot.Entries, "", parent, normalized)
	})
	if err != nil {
		return DownloadSummary{}, err
	}
	return s.Read(ctx, owner, id)
}
