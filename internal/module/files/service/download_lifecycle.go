package service

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// downloadMonitor 仅属于一次Dispatch；stop取消并等待，两个监视器都不能逃逸到下一代。
type downloadMonitor struct {
	cancel context.CancelFunc
	done   <-chan error
	once   sync.Once
	err    error
}

func (m *downloadMonitor) stop() error {
	m.once.Do(func() { m.cancel(); m.err = <-m.done })
	return m.err
}

func (s *OfflineDownloads) monitorLease(ctx context.Context, cancel context.CancelCauseFunc, claim DownloadClaim) *downloadMonitor {
	lifetime, stop := context.WithCancel(ctx)
	done := make(chan error, 1)
	go func() {
		ticker := time.NewTicker(s.policy.RenewInterval)
		defer ticker.Stop()
		for {
			select {
			case <-lifetime.Done():
				done <- nil
				return
			case <-ticker.C:
				err := s.authorize(lifetime, claim.OwnerID)
				if err == nil {
					now := s.transfers.files.clock.Now().UTC()
					err = s.repo.RenewDownload(lifetime, claim, now, now.Add(s.policy.LeaseTTL))
				}
				if err != nil {
					if lifetime.Err() != nil {
						done <- nil
						return
					}
					cancel(err)
					done <- err
					return
				}
			}
		}
	}()
	return &downloadMonitor{cancel: stop, done: done}
}

func (s *OfflineDownloads) monitorProgress(ctx context.Context, cancel context.CancelCauseFunc, claim DownloadClaim, transferID string) *downloadMonitor {
	lifetime, stop := context.WithCancel(ctx)
	done := make(chan error, 1)
	go func() {
		ticker := time.NewTicker(s.policy.ProgressInterval)
		defer ticker.Stop()
		var previous int64
		initialized := false
		previousAt := s.transfers.files.clock.Now()
		for {
			select {
			case <-lifetime.Done():
				done <- nil
				return
			case <-ticker.C:
				offset, err := s.transfers.stage.Offset(lifetime, transferID)
				if errors.Is(err, model.ErrMissing) {
					continue
				}
				if err == nil {
					now := s.transfers.files.clock.Now().UTC()
					rate := float64(0)
					if initialized && previousAt.Before(now) && offset >= previous {
						rate = float64(offset-previous) / now.Sub(previousAt).Seconds()
					}
					err = s.repo.CheckpointDownload(lifetime, claim, now, offset, rate)
					previous, previousAt = offset, now
					initialized = true
				}
				if err != nil {
					if lifetime.Err() != nil {
						done <- nil
						return
					}
					cancel(err)
					done <- err
					return
				}
			}
		}
	}()
	return &downloadMonitor{cancel: stop, done: done}
}

func (s *OfflineDownloads) finishControlled(ctx context.Context, claim DownloadClaim) error {
	cleanup, cancel := context.WithTimeout(ctx, cleanupTimeout)
	defer cancel()
	snapshot, err := s.repo.ReadDownload(cleanup, claim.OwnerID, claim.TaskID)
	if err != nil {
		return err
	}
	if len(snapshot.Transfers) != 1 {
		return model.ErrInvalid
	}
	return s.transfers.stage.WithLock(cleanup, snapshot.Transfers[0].ID, func(ctx context.Context) error {
		current, err := s.repo.ReadDownload(ctx, claim.OwnerID, claim.TaskID)
		if err != nil {
			return err
		}
		if current.Task.LeaseToken != claim.Token || !current.Task.LeaseValid(s.transfers.files.clock.Now()) {
			return model.ErrDownloadLeaseLost
		}
		child := current.Transfers[0]
		if child.Terminal() {
			_, err := s.transfers.cleanupLocked(ctx, child)
			return err
		}
		if current.Task.Intent == model.DownloadPause && s.transfers.files.clock.Now().Before(current.Task.ExpiresAt) {
			_, err := s.transfers.change(ctx, claim.OwnerID, child.ID, func(child *model.Transfer, _ []model.Entry) error { child.State = model.TransferPaused; return nil })
			return err
		}
		if current.Task.Intent != model.DownloadCancel && s.transfers.files.clock.Now().Before(current.Task.ExpiresAt) {
			return model.ErrConflict
		}
		child, err = s.transfers.repo.ChangeTransfer(ctx, claim.OwnerID, child.ID, "", func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
			if snapshot.Transfer == nil || snapshot.DownloadTask == nil || snapshot.DownloadTask.LeaseToken != claim.Token || !snapshot.DownloadTask.LeaseValid(s.transfers.files.clock.Now()) {
				return model.Transfer{}, nil, model.ErrDownloadLeaseLost
			}
			child := *snapshot.Transfer
			if child.State == model.TransferCompleted {
				return child, nil, nil
			}
			child.State = model.TransferCanceled
			if !s.transfers.files.clock.Now().Before(snapshot.DownloadTask.ExpiresAt) {
				child.State = model.TransferExpired
			}
			child.CleanupPending, child.UpdatedAt = true, s.transfers.files.clock.Now().UTC()
			return child, nil, nil
		})
		if err != nil {
			return err
		}
		_, err = s.transfers.cleanupLocked(ctx, child)
		return err
	})
}

func (s *OfflineDownloads) finishAttempt(ctx context.Context, claim DownloadClaim, runErr error, shuttingDown bool) error {
	// 暂停/取消可能在流读取期间提交，收尾时按最新持久意图处理而不是使用领取时快照。
	snapshot, err := s.repo.ReadDownload(ctx, claim.OwnerID, claim.TaskID)
	if err != nil {
		return err
	}
	if snapshot.Task.LeaseToken != claim.Token || !snapshot.Task.LeaseValid(s.transfers.files.clock.Now()) {
		return nil
	}
	if len(snapshot.Transfers) != 1 {
		return model.ErrInvalid
	}
	var finalOffset *int64
	var finishErr error
	if !snapshot.Transfers[0].Terminal() {
		offset, offsetErr := s.transfers.stage.Offset(ctx, snapshot.Transfers[0].ID)
		if offsetErr == nil && (snapshot.Task.DeclaredBytes == nil || offset <= *snapshot.Task.DeclaredBytes) {
			finalOffset = &offset
		}
		if offsetErr != nil && !errors.Is(offsetErr, model.ErrMissing) {
			finishErr = offsetErr
		}
	}
	if snapshot.Task.Intent != model.DownloadRun || snapshot.Transfers[0].Terminal() || !s.transfers.files.clock.Now().Before(snapshot.Task.ExpiresAt) {
		if cleanupErr := s.finishControlled(ctx, claim); cleanupErr != nil {
			runErr = errors.Join(runErr, cleanupErr)
			finishErr = errors.Join(finishErr, cleanupErr)
		}
	}
	_, err = s.changeClaim(ctx, claim, func(task *model.DownloadTask, current DownloadSnapshot) error {
		if len(current.Transfers) != 1 {
			return model.ErrInvalid
		}
		child := current.Transfers[0]
		now := s.transfers.files.clock.Now().UTC()
		task.RateBytesPerSecond, task.UpdatedAt = 0, now
		if finalOffset != nil {
			task.ReceivedBytes, task.ProgressAt = *finalOffset, &now
		}
		task.FailureCode, task.SourceStatus = model.DownloadFailureNone, 0
		finished := task.FinishedAt
		if finished == nil {
			finished = &now
		}
		switch {
		case child.State == model.TransferCompleted:
			total := child.SizeBytes
			task.State, task.Intent, task.DeclaredBytes, task.ReceivedBytes, task.FinishedAt = model.DownloadCompleted, model.DownloadRun, &total, total, finished
		case !now.Before(task.ExpiresAt):
			task.State, task.FailureCode, task.FinishedAt = model.DownloadExpired, model.DownloadFailureExpired, finished
			if !child.Terminal() {
				task.State = model.DownloadFailed
			}
		case task.Intent == model.DownloadCancel:
			task.State, task.FinishedAt = model.DownloadCanceled, finished
			if !child.Terminal() {
				task.State, task.FailureCode = model.DownloadFailed, model.DownloadFailureCleanup
			}
		case task.Intent == model.DownloadPause:
			task.State, task.FinishedAt = model.DownloadPaused, nil
		case shuttingDown:
			task.State, task.FinishedAt = model.DownloadQueued, nil
		default:
			if runErr == nil {
				return model.ErrConflict
			}
			task.State, task.FinishedAt = model.DownloadFailed, &now
			task.FailureCode, task.SourceStatus = downloadFailure(runErr)
		}
		if child.CleanupPending {
			task.FailureCode = model.DownloadFailureCleanup
		}
		task.LeaseToken, task.LeaseUntil = "", nil
		return nil
	})
	return errors.Join(err, finishErr)
}

func downloadFailure(err error) (model.DownloadFailure, int) {
	var source *DownloadSourceError
	if errors.As(err, &source) {
		return source.Failure, source.StatusCode
	}
	switch {
	case errors.Is(err, model.ErrDownloadMetadataLimited):
		return model.DownloadFailureDestination, 0
	case errors.Is(err, model.ErrDownloadPermission):
		return model.DownloadFailurePermission, 0
	case errors.Is(err, model.ErrDownloadSourceBlocked):
		return model.DownloadFailureBlocked, 0
	case errors.Is(err, model.ErrDownloadSourceChanged):
		return model.DownloadFailureChanged, 0
	case errors.Is(err, model.ErrDownloadResumeUnsupported):
		return model.DownloadFailureResume, 0
	case errors.Is(err, model.ErrQuota):
		return model.DownloadFailureQuota, 0
	case errors.Is(err, model.ErrTooLarge):
		return model.DownloadFailureLarge, 0
	case errors.Is(err, model.ErrMissing), errors.Is(err, model.ErrConflict):
		return model.DownloadFailureDestination, 0
	case errors.Is(err, ErrCleanup):
		return model.DownloadFailureCleanup, 0
	case errors.Is(err, context.DeadlineExceeded):
		return model.DownloadFailureTimeout, 0
	case errors.Is(err, model.ErrDownloadLeaseLost), errors.Is(err, context.Canceled):
		return model.DownloadFailureLease, 0
	default:
		return model.DownloadFailureStorage, 0
	}
}
