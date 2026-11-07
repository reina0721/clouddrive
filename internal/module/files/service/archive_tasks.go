package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/logger"
)

const (
	ArchiveDispatchTaskID     = "files.archive.dispatch"
	ArchiveDispatchInterval   = 2 * time.Second
	ArchiveTaskOwnerLimit     = 50
	ArchiveTaskGlobalLimit    = 2000
	ArchiveTaskRequestBytes   = 64 << 10
	archiveTaskTimeout        = 90 * time.Second
	ArchiveTaskLease          = 2 * time.Minute
	ArchiveCleanupRetry       = time.Minute
	ArchiveFailureInterrupted = "archive_interrupted"
)

var ErrArchiveTasksUnavailable = errors.New("archive task dispatcher unavailable")
var ErrArchiveTaskForbidden = errors.New("archive task write permission required")

type ArchiveTaskState string

const (
	ArchiveTaskQueued     ArchiveTaskState = "queued"
	ArchiveTaskRunning    ArchiveTaskState = "running"
	ArchiveTaskPublishing ArchiveTaskState = "publishing"
	ArchiveTaskCompleted  ArchiveTaskState = "completed"
	ArchiveTaskFailed     ArchiveTaskState = "failed"
	ArchiveTaskCanceled   ArchiveTaskState = "canceled"
)

func (s ArchiveTaskState) Terminal() bool {
	return s == ArchiveTaskCompleted || s == ArchiveTaskFailed || s == ArchiveTaskCanceled
}

// ArchiveTaskInput 不接受持久化密码；加密包仍走同步解压入口。
type ArchiveTaskInput struct {
	ClientKey        string           `json:"clientKey" minLength:"36" maxLength:"36"`
	ExpectedRevision int64            `json:"expectedRevision" minimum:"1"`
	Selection        ArchiveSelection `json:"selection"`
	ParentID         string           `json:"parentId" maxLength:"36"`
	FolderName       string           `json:"folderName" maxLength:"255"`
	Conflict         ArchiveConflict  `json:"conflict" enum:"reject,skip,rename"`
}

func (q ArchiveTaskInput) extraction() ArchiveExtractRequest {
	return ArchiveExtractRequest{ExpectedRevision: q.ExpectedRevision, Selection: q.Selection, ParentID: q.ParentID, FolderName: q.FolderName, Conflict: q.Conflict}
}

// ArchiveTask 是账号可见的任务回执，仅报告实际提交结果。
type ArchiveTask struct {
	ID             string           `json:"id"`
	SourceName     string           `json:"sourceName"`
	DestinationID  string           `json:"destinationId"`
	State          ArchiveTaskState `json:"state"`
	FailureCode    string           `json:"failureCode"`
	CreatedCount   int              `json:"createdCount"`
	SkippedCount   int              `json:"skippedCount"`
	RenamedCount   int              `json:"renamedCount"`
	CleanupPending bool             `json:"cleanupPending"`
	CreatedAt      time.Time        `json:"createdAt"`
	UpdatedAt      time.Time        `json:"updatedAt"`
}

type ArchiveTaskListing struct {
	Available bool          `json:"available"`
	Items     []ArchiveTask `json:"items"`
}

// ArchiveTaskClaim 仅在执行路径内部携带持久输入与当前领取围栏。
type ArchiveTaskClaim struct {
	ID          string
	OwnerID     string
	SourceID    string
	Token       string
	RequestJSON string
}

type ArchiveCleanup struct {
	ID      string
	OwnerID string
	Token   string
	Keys    []string
}

// ArchiveTaskRepository 负责归档任务状态和文件发布在同一所有者事务中的一致性。
type ArchiveTaskRepository interface {
	CreateArchiveTask(context.Context, ArchiveTaskClaim, string, int, func([]model.Entry) (string, error)) (ArchiveTask, error)
	ListArchiveTasks(context.Context, string) ([]ArchiveTask, error)
	ReadArchiveTask(context.Context, string, string) (ArchiveTask, error)
	CancelArchiveTask(context.Context, string, string) error
	RemoveArchiveTask(context.Context, string, string) error
	ClaimArchiveTask(context.Context, string) (ArchiveTaskClaim, error)
	RecordArchiveCandidates(context.Context, ArchiveTaskClaim, []string) error
	PublishArchiveTask(context.Context, ArchiveTaskClaim, int, ArchiveTask, func([]model.Entry) ([]model.Entry, error)) error
	FailArchiveTask(context.Context, ArchiveTaskClaim, string) (bool, error)
	ClaimArchiveCleanup(context.Context, string) (ArchiveCleanup, error)
	SettleArchiveCleanup(context.Context, ArchiveCleanup, []string) error
}

type ArchiveAccountAuthority interface {
	AuthorizeArchiveTask(context.Context, string) (bool, error)
}

type ArchiveTasks struct {
	archives  *Archives
	repo      ArchiveTaskRepository
	accounts  ArchiveAccountAuthority
	available bool
	log       logger.Logger
}

func NewArchiveTasks(archives *Archives, repository ArchiveTaskRepository, accounts ArchiveAccountAuthority, available bool, log logger.Logger) (*ArchiveTasks, error) {
	if archives == nil || repository == nil || accounts == nil || log == nil {
		return nil, fmt.Errorf("archive task dependencies incomplete")
	}
	return &ArchiveTasks{archives: archives, repo: repository, accounts: accounts, available: available, log: log}, nil
}

func (s *ArchiveTasks) authorize(ctx context.Context, owner string) error {
	allowed, err := s.accounts.AuthorizeArchiveTask(ctx, owner)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrArchiveTaskForbidden
	}
	return nil
}

func (s *ArchiveTasks) Create(ctx context.Context, owner, sourceID string, input ArchiveTaskInput) (ArchiveTask, error) {
	if !s.available {
		return ArchiveTask{}, ErrArchiveTasksUnavailable
	}
	if model.ValidateTransferID(input.ClientKey) != nil || input.ExpectedRevision < 1 {
		return ArchiveTask{}, model.ErrInvalid
	}
	if err := s.authorize(ctx, owner); err != nil {
		return ArchiveTask{}, err
	}
	if err := s.archives.validateExtraction(input.extraction()); err != nil {
		return ArchiveTask{}, err
	}
	request, err := json.Marshal(input)
	if err != nil {
		return ArchiveTask{}, err
	}
	if len(request) > ArchiveTaskRequestBytes {
		return ArchiveTask{}, model.ErrTooLarge
	}
	files := s.archives.files
	id, err := files.ids.New()
	if err != nil {
		return ArchiveTask{}, err
	}
	task := ArchiveTaskClaim{ID: id, OwnerID: owner, SourceID: sourceID, RequestJSON: string(request)}
	return s.repo.CreateArchiveTask(ctx, task, input.ClientKey, files.policy.SearchTreeEntries, func(entries []model.Entry) (string, error) {
		entry, found := model.Find(entries, sourceID)
		if !found || !model.Visible(entries, entry) {
			return "", model.ErrMissing
		}
		extension := strings.ToLower(path.Ext(entry.Name))
		if entry.Kind != model.File || (extension != ".zip" && extension != ".7z") {
			return "", model.ErrUnsupported
		}
		if entry.ContentRevision != input.ExpectedRevision {
			return "", model.ErrConflict
		}
		if entry.SizeBytes > files.policy.MaxArchiveBytes {
			return "", model.ErrTooLarge
		}
		if err := model.Parent(entries, input.ParentID); err != nil {
			return "", err
		}
		return entry.Name, nil
	})
}

func (s *ArchiveTasks) List(ctx context.Context, owner string) (ArchiveTaskListing, error) {
	items, err := s.repo.ListArchiveTasks(ctx, owner)
	return ArchiveTaskListing{Available: s.available, Items: items}, err
}

func (s *ArchiveTasks) Read(ctx context.Context, owner, id string) (ArchiveTask, error) {
	return s.repo.ReadArchiveTask(ctx, owner, id)
}

func (s *ArchiveTasks) Cancel(ctx context.Context, owner, id string) error {
	return s.repo.CancelArchiveTask(ctx, owner, id)
}

func (s *ArchiveTasks) Remove(ctx context.Context, owner, id string) error {
	return s.repo.RemoveArchiveTask(ctx, owner, id)
}

// Dispatch 由现有调度器管理，每次至多处理一个补偿批次和一个真实解压。
func (s *ArchiveTasks) Dispatch(ctx context.Context) error {
	if !s.available {
		return nil
	}
	cleanupErr := s.cleanup(ctx)
	release, err := s.archives.files.AcquireUpload(ctx)
	if errors.Is(err, model.ErrBusy) {
		return cleanupErr
	}
	if err != nil {
		return errors.Join(cleanupErr, err)
	}
	defer release()
	token, err := s.archives.files.ids.New()
	if err != nil {
		return errors.Join(cleanupErr, err)
	}
	claim, err := s.repo.ClaimArchiveTask(ctx, token)
	if err != nil || claim.ID == "" {
		return errors.Join(cleanupErr, err)
	}
	attempt, cancel := context.WithTimeout(ctx, archiveTaskTimeout)
	err = s.run(attempt, claim)
	cancel()
	if err == nil {
		return cleanupErr
	}
	settle, settleCancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer settleCancel()
	code := archiveTaskFailure(err)
	failed, settleErr := s.repo.FailArchiveTask(settle, claim, code)
	if settleErr != nil {
		return errors.Join(cleanupErr, err, settleErr)
	}
	if failed && !errors.Is(err, context.Canceled) {
		s.log.Warn("files.archive.task.failed", logger.String("owner", "files.archive"), logger.String("phase", "execution"), logger.String("task_id", claim.ID), logger.String("error_code", code))
	}
	return cleanupErr
}

func (s *ArchiveTasks) run(ctx context.Context, claim ArchiveTaskClaim) error {
	if err := s.authorize(ctx, claim.OwnerID); err != nil {
		return err
	}
	var persisted ArchiveTaskInput
	if len(claim.RequestJSON) > ArchiveTaskRequestBytes {
		return model.ErrTooLarge
	}
	if err := json.Unmarshal([]byte(claim.RequestJSON), &persisted); err != nil {
		return fmt.Errorf("decode archive task input: %w", err)
	}
	input := persisted.extraction()
	source, plan, payloads, err := s.archives.prepareExtraction(ctx, claim.OwnerID, claim.SourceID, input)
	if err != nil {
		return err
	}
	keys := make([]string, 0, len(plan.sourcePath))
	for _, entry := range plan.receipt.Created {
		if entry.Kind == model.File {
			keys = append(keys, entry.ObjectKey)
		}
	}
	if err := s.repo.RecordArchiveCandidates(ctx, claim, keys); err != nil {
		return err
	}
	if _, err := s.archives.stageExtraction(ctx, &plan, payloads); err != nil {
		return err
	}
	if err := s.authorize(ctx, claim.OwnerID); err != nil {
		return err
	}
	receipt := ArchiveTask{DestinationID: plan.receipt.DestinationID, CreatedCount: len(plan.receipt.Created), SkippedCount: len(plan.receipt.Skipped), RenamedCount: len(plan.receipt.Renamed)}
	return s.repo.PublishArchiveTask(ctx, claim, s.archives.files.policy.SearchTreeEntries, receipt, s.archives.archivePublication(source, plan, input))
}

func (s *ArchiveTasks) cleanup(ctx context.Context) error {
	cleanup, cancel := context.WithTimeout(ctx, cleanupTimeout)
	defer cancel()
	token, err := s.archives.files.ids.New()
	if err != nil {
		return err
	}
	batch, err := s.repo.ClaimArchiveCleanup(cleanup, token)
	if err != nil || batch.ID == "" {
		return err
	}
	failed := make([]string, 0, len(batch.Keys))
	for _, key := range batch.Keys {
		id, valid := strings.CutPrefix(key, "files/")
		if !valid || model.ValidateTransferID(id) != nil {
			return fmt.Errorf("archive candidate key invalid")
		}
		if deleteErr := s.archives.files.content.Delete(cleanup, key); deleteErr != nil {
			failed = append(failed, key)
			err = errors.Join(err, deleteErr)
		}
	}
	settle, settleCancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer settleCancel()
	return errors.Join(err, s.repo.SettleArchiveCleanup(settle, batch, failed))
}

func archiveTaskFailure(err error) string {
	switch {
	case errors.Is(err, context.Canceled):
		return ArchiveFailureInterrupted
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.Is(err, ErrArchiveTaskForbidden):
		return "archive_forbidden"
	case errors.Is(err, ErrArchivePassword):
		return "archive_password"
	case errors.Is(err, ErrArchiveChecksum):
		return "archive_checksum"
	case errors.Is(err, ErrArchiveWorker):
		return "archive_worker_unavailable"
	case errors.Is(err, model.ErrMissing):
		return "not_found"
	case errors.Is(err, model.ErrQuota):
		return "quota"
	case errors.Is(err, model.ErrWriteLocked):
		return "write_locked"
	case errors.Is(err, model.ErrConflict):
		return "conflict"
	case errors.Is(err, model.ErrTooLarge):
		return "too_large"
	case errors.Is(err, model.ErrUnsupported):
		return "unsupported"
	case errors.Is(err, model.ErrInvalid):
		return "invalid"
	default:
		return "unavailable"
	}
}
