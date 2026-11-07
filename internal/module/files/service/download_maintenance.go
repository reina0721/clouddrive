package service

import (
	"context"
	"errors"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

// settleCancellation 处理没有活跃租约的显式取消，也覆盖调度禁用或自动清理预算耗尽；不启用网络或第二套worker。
// 仍有有效租约的执行由原拥有者收尾；崩溃遗留租约到期后再次取消即可取得清理权。
func (s *OfflineDownloads) settleCancellation(ctx context.Context, owner, id string) error {
	token, err := s.transfers.files.ids.New()
	if err != nil {
		return err
	}
	claimed := false
	_, err = s.repo.ChangeDownload(ctx, owner, id, func(snapshot DownloadSnapshot) (model.DownloadTask, error) {
		task := snapshot.Task
		now := s.transfers.files.clock.Now().UTC()
		if task.LeaseValid(now) || task.Intent != model.DownloadCancel {
			return task, nil
		}
		until := now.Add(s.policy.LeaseTTL)
		task.LeaseToken, task.LeaseUntil = token, &until
		claimed = true
		return task, nil
	})
	if err != nil || !claimed {
		return err
	}
	claim := DownloadClaim{TaskID: id, OwnerID: owner, Token: token}
	cleanup, cancel := context.WithTimeout(ctx, cleanupTimeout)
	defer cancel()
	runErr := s.finishControlled(cleanup, claim)
	return errors.Join(runErr, s.finishAttempt(cleanup, claim, runErr, false))
}

// downloadMaintenanceKind 区分重建候选与移除记录，不用布尔实参隐藏两者不同的数据保留语义。
type downloadMaintenanceKind string

const (
	downloadRestart downloadMaintenanceKind = "restart"
	downloadRemove  downloadMaintenanceKind = "remove"
)

// claimControl 在触碰磁盘前为显式维护操作取得短租约；普通继续/改目标不能与清理交错。
func (s *OfflineDownloads) claimControl(ctx context.Context, owner, id string, revision int64, kind downloadMaintenanceKind) (DownloadClaim, error) {
	if revision < 1 || revision >= model.MaxDownloadRevision || kind != downloadRestart && kind != downloadRemove {
		return DownloadClaim{}, model.ErrInvalid
	}
	remove := kind == downloadRemove
	token, err := s.transfers.files.ids.New()
	if err != nil {
		return DownloadClaim{}, err
	}
	_, err = s.repo.ChangeDownload(ctx, owner, id, func(snapshot DownloadSnapshot) (model.DownloadTask, error) {
		task := snapshot.Task
		now := s.transfers.files.clock.Now().UTC()
		if task.Revision != revision || task.LeaseValid(now) || len(snapshot.Transfers) != 1 {
			return task, model.ErrConflict
		}
		if remove {
			if !task.State.Finished() {
				return task, model.ErrConflict
			}
		} else if task.State != model.DownloadPaused && task.State != model.DownloadFailed || snapshot.Transfers[0].Terminal() || !now.Before(task.ExpiresAt) {
			return task, model.ErrConflict
		}
		if !remove && snapshot.MetadataLimited {
			return task, model.ErrDownloadMetadataLimited
		}
		until := now.Add(s.policy.LeaseTTL)
		task.LeaseToken, task.LeaseUntil = token, &until
		// 重建候选保留暂停意图；移除失败后的清理重试必须保持终结语义，不能变成不可继续的paused项。
		if kind == downloadRestart {
			task.Intent = model.DownloadPause
		} else if task.State != model.DownloadCompleted {
			task.Intent = model.DownloadCancel
		}
		task.Revision++
		task.UpdatedAt = now
		return task, nil
	})
	if err != nil {
		return DownloadClaim{}, err
	}
	return DownloadClaim{TaskID: id, OwnerID: owner, Token: token}, nil
}

func (s *OfflineDownloads) releaseControl(ctx context.Context, claim DownloadClaim, failure error) error {
	cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()
	_, err := s.repo.ChangeDownload(cleanup, claim.OwnerID, claim.TaskID, func(snapshot DownloadSnapshot) (model.DownloadTask, error) {
		task := snapshot.Task
		if task.LeaseToken != claim.Token {
			return task, nil
		}
		task.LeaseToken, task.LeaseUntil = "", nil
		cleanupPending := false
		for _, child := range snapshot.Transfers {
			cleanupPending = cleanupPending || child.CleanupPending
		}
		if failure != nil && (errors.Is(failure, ErrCleanup) || cleanupPending) {
			task.FailureCode = model.DownloadFailureCleanup
		}
		task.UpdatedAt = s.transfers.files.clock.Now().UTC()
		return task, nil
	})
	if errors.Is(err, model.ErrMissing) {
		return nil
	}
	return err
}

func (s *OfflineDownloads) Restart(ctx context.Context, owner, id string, revision int64) (result DownloadSummary, resultErr error) {
	sourceSnapshot, readErr := s.repo.ReadDownload(ctx, owner, id)
	if readErr != nil {
		return DownloadSummary{}, readErr
	}
	if sourceSnapshot.Task.Kind == model.DownloadBitTorrent {
		return s.torrents.Restart(ctx, owner, id, revision)
	}
	if !s.available {
		return result, model.ErrDownloadUnavailable
	}
	if err := s.authorize(ctx, owner); err != nil {
		return result, err
	}
	claim, err := s.claimControl(ctx, owner, id, revision, downloadRestart)
	if err != nil {
		return result, err
	}
	defer func() { resultErr = errors.Join(resultErr, s.releaseControl(ctx, claim, resultErr)) }()
	cleanup, cancel := context.WithTimeout(ctx, cleanupTimeout)
	defer cancel()
	snapshot, err := s.repo.ReadDownload(cleanup, owner, id)
	if err != nil {
		return result, err
	}
	if len(snapshot.Transfers) != 1 {
		return result, model.ErrInvalid
	}
	err = s.transfers.stage.WithLock(cleanup, snapshot.Transfers[0].ID, func(ctx context.Context) error {
		current, err := s.repo.ReadDownload(ctx, owner, id)
		if err != nil {
			return err
		}
		if current.Task.LeaseToken != claim.Token || current.Task.Intent != model.DownloadPause || !current.Task.LeaseValid(s.transfers.files.clock.Now()) {
			return model.ErrConflict
		}
		child := current.Transfers[0]
		if child.Terminal() {
			return model.ErrConflict
		}
		if err := errors.Join(s.transfers.stage.Remove(ctx, child.ID), s.transfers.content.Delete(ctx, child.ObjectKey)); err != nil {
			return errors.Join(ErrCleanup, err)
		}
		_, err = s.transfers.repo.ChangeTransfer(ctx, owner, child.ID, "", func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
			if snapshot.Transfer == nil || snapshot.DownloadTask == nil || snapshot.DownloadTask.LeaseToken != claim.Token || snapshot.DownloadTask.Intent != model.DownloadPause || !snapshot.DownloadTask.LeaseValid(s.transfers.files.clock.Now()) {
				return model.Transfer{}, nil, model.ErrConflict
			}
			child := *snapshot.Transfer
			if child.Terminal() {
				return child, nil, model.ErrConflict
			}
			child.SizeBytes, child.QuotaReservedBytes, child.SizeKnown, child.ContentSHA256 = 0, 0, false, ""
			child.State, child.FailureCode, child.CleanupPending, child.UpdatedAt = model.TransferPreparing, "", false, s.transfers.files.clock.Now().UTC()
			return child, nil, nil
		})
		return err
	})
	if err != nil {
		return result, err
	}
	_, err = s.changeClaim(cleanup, claim, func(task *model.DownloadTask, _ DownloadSnapshot) error {
		if task.Intent != model.DownloadPause {
			return model.ErrConflict
		}
		task.EffectiveURI, task.ValidatorKind, task.ValidatorValue, task.MediaType = "", model.DownloadValidatorNone, "", ""
		task.DeclaredBytes, task.ProgressAt = nil, nil
		task.ReceivedBytes, task.RateBytesPerSecond, task.Attempts, task.SourceStatus = 0, 0, 0, 0
		task.FailureCode, task.StartedAt, task.FinishedAt = model.DownloadFailureNone, nil, nil
		task.State, task.Intent, task.LeaseToken, task.LeaseUntil = model.DownloadQueued, model.DownloadRun, "", nil
		task.UpdatedAt = s.transfers.files.clock.Now().UTC()
		return nil
	})
	if err != nil {
		return result, err
	}
	return s.Read(ctx, owner, id)
}

func (s *OfflineDownloads) Remove(ctx context.Context, owner, id string, revision int64) (resultErr error) {
	sourceSnapshot, readErr := s.repo.ReadDownload(ctx, owner, id)
	if readErr != nil {
		return readErr
	}
	if sourceSnapshot.Task.Kind == model.DownloadBitTorrent {
		return s.torrents.Remove(ctx, owner, id, revision)
	}
	claim, err := s.claimControl(ctx, owner, id, revision, downloadRemove)
	if err != nil {
		return err
	}
	defer func() { resultErr = errors.Join(resultErr, s.releaseControl(ctx, claim, resultErr)) }()
	cleanup, cancel := context.WithTimeout(ctx, cleanupTimeout)
	defer cancel()
	snapshot, err := s.repo.ReadDownload(cleanup, owner, id)
	if err != nil {
		return err
	}
	if len(snapshot.Transfers) != 1 {
		return model.ErrInvalid
	}
	err = s.transfers.stage.WithLock(cleanup, snapshot.Transfers[0].ID, func(ctx context.Context) error {
		current, err := s.repo.ReadDownload(ctx, owner, id)
		if err != nil {
			return err
		}
		if current.Task.LeaseToken != claim.Token || !current.Task.LeaseValid(s.transfers.files.clock.Now()) {
			return model.ErrConflict
		}
		child := current.Transfers[0]
		if !child.Terminal() {
			child, err = s.transfers.repo.ChangeTransfer(ctx, owner, child.ID, "", func(snapshot TransferSnapshot) (model.Transfer, *model.Entry, error) {
				if snapshot.Transfer == nil || snapshot.DownloadTask == nil || snapshot.DownloadTask.LeaseToken != claim.Token || !snapshot.DownloadTask.LeaseValid(s.transfers.files.clock.Now()) {
					return model.Transfer{}, nil, model.ErrConflict
				}
				child := *snapshot.Transfer
				if child.State == model.TransferCompleted {
					return child, nil, nil
				}
				child.State, child.CleanupPending, child.UpdatedAt = model.TransferCanceled, true, s.transfers.files.clock.Now().UTC()
				return child, nil, nil
			})
			if err != nil {
				return err
			}
		}
		_, err = s.transfers.cleanupLocked(ctx, child)
		return err
	})
	if err != nil {
		return err
	}
	// 持有同一维护租约直至删除事务完成，避免先释放后被调度重新领取；已发布对象不属于删除范围。
	return s.repo.DeleteDownload(cleanup, claim, func(snapshot DownloadSnapshot) error {
		if snapshot.Task.Revision != revision+1 {
			return model.ErrConflict
		}
		return nil
	})
}
