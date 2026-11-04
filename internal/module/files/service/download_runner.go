package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/logger"
)

// Dispatch 一次最多处理一个持久候选，调度器拥有本调用的取消和等待，不在构造期间产生工作。
func (s *OfflineDownloads) Dispatch(ctx context.Context) error {
	if !s.available {
		return nil
	}
	candidate, found, err := s.repo.NextDownload(ctx, s.transfers.files.clock.Now().UTC(), s.policy.MaxAttempts)
	if err != nil || !found {
		return err
	}
	release, err := s.transfers.files.AcquireUpload(ctx)
	if errors.Is(err, model.ErrBusy) {
		return nil
	}
	if err != nil {
		return err
	}
	defer release()
	token, err := s.transfers.files.ids.New()
	if err != nil {
		return err
	}
	claimed := false
	settledAtLimit := false
	task, err := s.repo.ChangeDownload(ctx, candidate.OwnerID, candidate.ID, func(snapshot DownloadSnapshot) (model.DownloadTask, error) {
		task := snapshot.Task
		now := s.transfers.files.clock.Now().UTC()
		if task.LeaseValid(now) || snapshot.GlobalActiveTasks >= s.policy.Concurrency {
			return task, model.ErrBusy
		}
		if len(snapshot.Transfers) != 1 {
			return task, model.ErrInvalid
		}
		child := snapshot.Transfers[0]
		cleanup := child.Terminal() || task.Intent != model.DownloadRun || !now.Before(task.ExpiresAt)
		if task.Attempts >= s.policy.MaxAttempts {
			task.State, task.FailureCode = model.DownloadFailed, model.DownloadFailureAttempts
			switch child.State {
			case model.TransferCompleted:
				total := child.SizeBytes
				task.State, task.Intent, task.DeclaredBytes, task.ReceivedBytes, task.FailureCode = model.DownloadCompleted, model.DownloadRun, &total, total, model.DownloadFailureNone
			case model.TransferCanceled:
				task.State, task.FailureCode = model.DownloadCanceled, model.DownloadFailureNone
			case model.TransferExpired:
				task.State, task.FailureCode = model.DownloadExpired, model.DownloadFailureExpired
			}
			if child.CleanupPending {
				task.FailureCode = model.DownloadFailureCleanup
			}
			if task.FinishedAt == nil {
				task.FinishedAt = &now
			}
			task.LeaseToken, task.LeaseUntil, task.RateBytesPerSecond, task.UpdatedAt = "", nil, 0, now
			settledAtLimit = true
			return task, nil
		}
		// 自动领取同时约束下载和清理，永久I/O失败不能产生无限的定时重试。
		task.Attempts++
		if !cleanup {
			if task.State != model.DownloadQueued && task.State != model.DownloadFetching && task.State != model.DownloadPublishing {
				return task, model.ErrBusy
			}
			task.State = model.DownloadFetching
			if task.StartedAt == nil {
				task.StartedAt = &now
			}
		}
		until := now.Add(s.policy.LeaseTTL)
		task.LeaseToken, task.LeaseUntil, task.UpdatedAt = token, &until, now
		claimed = true
		return task, nil
	})
	if errors.Is(err, model.ErrBusy) || errors.Is(err, model.ErrMissing) {
		return nil
	}
	if err != nil {
		return err
	}
	if !claimed && settledAtLimit {
		fields := []logger.Field{logger.String("owner", "files.offline"), logger.String("phase", "attempt-budget"), logger.String("task_id", task.ID), logger.String("error_code", string(task.FailureCode))}
		if task.FailureCode != model.DownloadFailureNone {
			s.logger.Warn("files.offline.budget.exhausted", fields...)
		} else {
			s.logger.Info("files.offline.reconciled", fields...)
		}
	}
	if !claimed {
		return err
	}
	claim := DownloadClaim{TaskID: task.ID, OwnerID: task.OwnerID, Token: token}
	work, cancel := context.WithCancelCause(ctx)
	s.activeMu.Lock()
	s.active[task.ID] = downloadRun{token: token, cancel: cancel}
	s.activeMu.Unlock()
	defer func() {
		cancel(nil)
		s.activeMu.Lock()
		if run, found := s.active[task.ID]; found && run.token == token {
			delete(s.active, task.ID)
		}
		s.activeMu.Unlock()
	}()
	deadline := s.transfers.files.clock.Now().Add(s.policy.AttemptTimeout)
	if task.ExpiresAt.After(s.transfers.files.clock.Now()) && task.ExpiresAt.Before(deadline) {
		deadline = task.ExpiresAt
	}
	attempt, endAttempt := context.WithDeadline(work, deadline)
	defer endAttempt()
	snapshot, err := s.repo.ReadDownload(attempt, task.OwnerID, task.ID)
	if err == nil && len(snapshot.Transfers) != 1 {
		err = model.ErrInvalid
	}
	if err == nil {
		child := snapshot.Transfers[0]
		if child.Terminal() || task.Intent != model.DownloadRun || !s.transfers.files.clock.Now().Before(task.ExpiresAt) {
			err = s.finishControlled(attempt, claim)
		} else {
			err = s.runTransfer(attempt, cancel, claim, child.ID)
		}
	}
	// 请求取消不取消持久化最终事实；使用有界清理上下文，原始失败和收尾错误一起返回。
	finish, finishCancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer finishCancel()
	finishErr := s.finishAttempt(finish, claim, err, ctx.Err() != nil)
	if finishErr != nil {
		return errors.Join(err, finishErr)
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	// 可恢复来源失败已经成为持久失败状态，当前调度边界负责结构化记录，不泄露源错误文本。
	if err != nil {
		failure, _ := downloadFailure(err)
		if errors.Is(err, model.ErrDownloadLeaseLost) || errors.Is(err, context.Canceled) {
			s.logger.Debug("files.offline.interrupted", logger.String("phase", "transfer"), logger.String("task_id", task.ID), logger.String("error_code", string(failure)))
		} else {
			s.logger.Warn("files.offline.failed", logger.String("phase", "transfer"), logger.String("task_id", task.ID), logger.String("error_code", string(failure)))
		}
	} else {
		s.logger.Info("files.offline.settled", logger.String("phase", "transfer"), logger.String("task_id", task.ID))
	}
	return nil
}

func (s *OfflineDownloads) changeClaim(ctx context.Context, claim DownloadClaim, apply func(*model.DownloadTask, DownloadSnapshot) error) (model.DownloadTask, error) {
	return s.repo.ChangeDownload(ctx, claim.OwnerID, claim.TaskID, func(snapshot DownloadSnapshot) (model.DownloadTask, error) {
		task := snapshot.Task
		if task.LeaseToken != claim.Token || !task.LeaseValid(s.transfers.files.clock.Now()) {
			return task, model.ErrDownloadLeaseLost
		}
		if err := apply(&task, snapshot); err != nil {
			return task, err
		}
		return task, nil
	})
}

func (s *OfflineDownloads) runTransfer(ctx context.Context, cancel context.CancelCauseFunc, claim DownloadClaim, transferID string) (resultErr error) {
	if err := s.authorize(ctx, claim.OwnerID); err != nil {
		return err
	}
	lease := s.monitorLease(ctx, cancel, claim)
	defer func() { resultErr = errors.Join(resultErr, lease.stop()) }()
	progress := s.monitorProgress(ctx, cancel, claim, transferID)
	progressStopped := false
	defer func() {
		if !progressStopped {
			resultErr = errors.Join(resultErr, progress.stop())
		}
	}()
	err := s.transfers.stage.WithLock(ctx, transferID, func(ctx context.Context) error {
		snapshot, err := s.repo.ReadDownload(ctx, claim.OwnerID, claim.TaskID)
		if err != nil {
			return err
		}
		if err := activeDownloadClaim(snapshot.Task, claim, s.transfers.files.clock.Now()); err != nil {
			return err
		}
		if snapshot.MetadataLimited {
			return model.ErrDownloadMetadataLimited
		}
		if len(snapshot.Transfers) != 1 {
			return model.ErrInvalid
		}
		child := snapshot.Transfers[0]
		info, err := s.transfers.stage.Inspect(ctx, transferID)
		if errors.Is(err, model.ErrMissing) {
			offset, offsetErr := s.transfers.stage.Offset(ctx, transferID)
			if offsetErr != nil && !errors.Is(offsetErr, model.ErrMissing) {
				return offsetErr
			}
			if offset > 0 || snapshot.Task.ReceivedBytes > 0 {
				return fmt.Errorf("download staging metadata missing")
			}
			if err := s.transfers.stage.CreateDeferred(ctx, transferID); err != nil {
				return err
			}
			info = StageInfo{Deferred: true}
		} else if err != nil {
			return err
		}
		if info.OffsetBytes < snapshot.Task.ReceivedBytes {
			return fmt.Errorf("download staging prefix was truncated")
		}
		if info.Deferred {
			offset := info.OffsetBytes
			complete := false
			for requestCount := 0; requestCount < s.policy.MaxRequests; requestCount++ {
				snapshot, err = s.repo.ReadDownload(ctx, claim.OwnerID, claim.TaskID)
				if err != nil {
					return err
				}
				if err := activeDownloadClaim(snapshot.Task, claim, s.transfers.files.clock.Now()); err != nil {
					return err
				}
				request := DownloadSourceRequest{URI: snapshot.Task.SourceURI, EffectiveURI: snapshot.Task.EffectiveURI, OffsetBytes: offset, DeclaredBytes: snapshot.Task.DeclaredBytes, ValidatorKind: snapshot.Task.ValidatorKind, ValidatorValue: snapshot.Task.ValidatorValue, MaxBytes: s.transfers.policy.MaxFileBytes}
				previousOffset := offset
				var headers DownloadSourceHeaders
				err = s.source.WithBody(ctx, request, func(received DownloadSourceHeaders, body io.Reader) error {
					headers = received
					child, err = s.allocateSource(ctx, claim, transferID, received, offset)
					if err != nil {
						return err
					}
					written, err := s.transfers.stage.AppendStream(ctx, transferID, body, StageAppend{OffsetBytes: offset, MaxAppendBytes: child.SizeBytes - offset})
					offset += written
					return err
				})
				if err != nil {
					return err
				}
				if err := s.repo.CheckpointDownload(ctx, claim, s.transfers.files.clock.Now().UTC(), offset, 0); err != nil {
					return err
				}
				if headers.DeclaredBytes == nil || offset == *headers.DeclaredBytes {
					complete = true
					break
				}
				if offset <= previousOffset || headers.SegmentEndBytes == nil || offset != *headers.SegmentEndBytes {
					return &DownloadSourceError{Failure: model.DownloadFailureIncomplete, Cause: io.ErrUnexpectedEOF}
				}
			}
			if !complete {
				return &DownloadSourceError{Failure: model.DownloadFailureIncomplete, Cause: fmt.Errorf("download source request budget exhausted")}
			}
			// 进度采样退出后才写seal元数据；响应body此时已由source关闭。
			progressErr := progress.stop()
			progressStopped = true
			if progressErr != nil {
				return progressErr
			}
			if err := s.transfers.stage.Seal(ctx, transferID, offset); err != nil {
				return err
			}
			info = StageInfo{SizeBytes: offset, OffsetBytes: offset}
		} else {
			progressErr := progress.stop()
			progressStopped = true
			if progressErr != nil {
				return progressErr
			}
			if info.SizeBytes != info.OffsetBytes {
				return fmt.Errorf("download sealed staging incomplete")
			}
		}
		// 封口后崩溃可从同一候选重建摘要；不重新请求来源，不创建第二个内容对象。
		hash := sha256.New()
		err = s.transfers.stage.WithReader(ctx, transferID, func(reader io.ReadSeeker) error {
			count, err := io.Copy(hash, io.LimitReader(downloadContextReader{ctx: ctx, source: reader}, info.SizeBytes+1))
			if err != nil {
				return err
			}
			if count != info.SizeBytes {
				return io.ErrUnexpectedEOF
			}
			return nil
		})
		if err != nil {
			return err
		}
		_, err = s.transfers.repo.ChangeTransfer(ctx, claim.OwnerID, transferID, "", func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
			if snapshot.Transfer == nil || snapshot.DownloadTask == nil {
				return model.Transfer{}, nil, model.ErrMissing
			}
			if err := activeDownloadClaim(*snapshot.DownloadTask, claim, s.transfers.files.clock.Now()); err != nil {
				return model.Transfer{}, nil, err
			}
			child := *snapshot.Transfer
			if child.Terminal() || info.SizeBytes > child.SizeBytes {
				return child, nil, model.ErrConflict
			}
			child.SizeKnown, child.SizeBytes, child.QuotaReservedBytes, child.ContentSHA256 = true, info.SizeBytes, info.SizeBytes, hex.EncodeToString(hash.Sum(nil))
			child.State, child.UpdatedAt = model.TransferReceiving, s.transfers.files.clock.Now().UTC()
			return child, nil, nil
		})
		if err != nil {
			return err
		}
		_, err = s.changeClaim(ctx, claim, func(task *model.DownloadTask, _ DownloadSnapshot) error {
			if err := activeDownloadClaim(*task, claim, s.transfers.files.clock.Now()); err != nil {
				return err
			}
			total := info.SizeBytes
			task.DeclaredBytes, task.ReceivedBytes, task.RateBytesPerSecond = &total, total, 0
			task.State, task.UpdatedAt = model.DownloadPublishing, s.transfers.files.clock.Now().UTC()
			return nil
		})
		return err
	})
	if err != nil {
		return err
	}
	_, err = s.transfers.commitAuthorized(ctx, claim.OwnerID, transferID, model.TransferSourceOffline, &downloadPublication{claim: claim, repository: s.repo, accounts: s.accounts})
	return err
}

func activeDownloadClaim(task model.DownloadTask, claim DownloadClaim, now time.Time) error {
	if task.ID != claim.TaskID || task.OwnerID != claim.OwnerID || task.LeaseToken != claim.Token || !task.LeaseValid(now) || task.Intent != model.DownloadRun || task.State != model.DownloadFetching && task.State != model.DownloadPublishing || !now.Before(task.ExpiresAt) {
		return model.ErrDownloadLeaseLost
	}
	return nil
}

type downloadContextReader struct {
	ctx    context.Context
	source io.Reader
}

func (r downloadContextReader) Read(target []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.source.Read(target)
}

func (s *OfflineDownloads) allocateSource(ctx context.Context, claim DownloadClaim, transferID string, headers DownloadSourceHeaders, offset int64) (model.Transfer, error) {
	_, err := s.changeClaim(ctx, claim, func(task *model.DownloadTask, _ DownloadSnapshot) error {
		if err := activeDownloadClaim(*task, claim, s.transfers.files.clock.Now()); err != nil {
			return err
		}
		if offset > 0 && (task.EffectiveURI != headers.EffectiveURI || task.ValidatorKind != headers.ValidatorKind || task.ValidatorValue != headers.ValidatorValue) {
			return model.ErrDownloadSourceChanged
		}
		task.EffectiveURI, task.ValidatorKind, task.ValidatorValue = headers.EffectiveURI, headers.ValidatorKind, headers.ValidatorValue
		task.DeclaredBytes, task.MediaType = headers.DeclaredBytes, headers.MediaType
		return nil
	})
	if err != nil {
		return model.Transfer{}, err
	}
	return s.transfers.repo.ChangeTransfer(ctx, claim.OwnerID, transferID, "", func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
		if snapshot.MetadataLimited {
			return model.Transfer{}, nil, model.ErrDownloadMetadataLimited
		}
		if snapshot.Transfer == nil || snapshot.DownloadTask == nil {
			return model.Transfer{}, nil, model.ErrMissing
		}
		task, child := *snapshot.DownloadTask, *snapshot.Transfer
		if err := activeDownloadClaim(task, claim, s.transfers.files.clock.Now()); err != nil {
			return child, nil, err
		}
		if child.Terminal() {
			return child, nil, model.ErrConflict
		}
		name := task.RequestedName
		if name == "" {
			name = child.Name
			if offset == 0 && headers.SuggestedName != "" {
				name = headers.SuggestedName
			}
		}
		normalized, err := s.transfers.files.normalizedName(name)
		if err != nil {
			return child, nil, err
		}
		if err := model.Parent(snapshot.Entries, task.TargetParentID); err != nil {
			return child, nil, err
		}
		if err := model.Available(snapshot.Entries, "", task.TargetParentID, normalized); err != nil {
			return child, nil, err
		}
		used := model.Used(snapshot.Entries)
		if snapshot.OwnerReservedBytes < child.QuotaReservedBytes || snapshot.GlobalReservedBytes < child.SizeBytes {
			return child, nil, fmt.Errorf("download reservation invariant")
		}
		otherOwner := snapshot.OwnerReservedBytes - child.QuotaReservedBytes
		otherGlobal := snapshot.GlobalReservedBytes - child.SizeBytes
		if used > s.transfers.files.policy.QuotaBytes || otherOwner > s.transfers.files.policy.QuotaBytes-used {
			return child, nil, model.ErrQuota
		}
		if otherGlobal > s.transfers.policy.StagingBytes {
			return child, nil, model.ErrBusy
		}
		capacity := min(s.transfers.policy.MaxFileBytes, s.transfers.files.policy.QuotaBytes-used-otherOwner, s.transfers.policy.StagingBytes-otherGlobal)
		if headers.DeclaredBytes != nil {
			if *headers.DeclaredBytes > s.transfers.policy.MaxFileBytes {
				return child, nil, model.ErrTooLarge
			}
			if *headers.DeclaredBytes > s.transfers.files.policy.QuotaBytes-used-otherOwner {
				return child, nil, model.ErrQuota
			}
			if *headers.DeclaredBytes > s.transfers.policy.StagingBytes-otherGlobal {
				return child, nil, model.ErrBusy
			}
			capacity = *headers.DeclaredBytes
		}
		if offset > capacity {
			return child, nil, model.ErrQuota
		}
		child.ParentID, child.Name, child.NormalizedName = task.TargetParentID, name, normalized
		child.SizeBytes, child.QuotaReservedBytes, child.SizeKnown = capacity, capacity, headers.DeclaredBytes != nil
		child.State, child.FailureCode, child.UpdatedAt = model.TransferReceiving, "", s.transfers.files.clock.Now().UTC()
		return child, nil, nil
	})
}
