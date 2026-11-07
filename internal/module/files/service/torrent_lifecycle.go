package service

import (
	"context"
	"errors"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

func torrentFailure(err error) model.DownloadFailure {
	switch {
	case errors.Is(err, model.ErrWriteLocked):
		return model.DownloadFailureWriteLocked
	case errors.Is(err, model.ErrDownloadPermission):
		return model.DownloadFailurePermission
	case errors.Is(err, context.DeadlineExceeded):
		return model.DownloadFailureTimeout
	case errors.Is(err, ErrTorrentMetadata), errors.Is(err, ErrTorrentUnsupported):
		return model.DownloadFailureMetadata
	case errors.Is(err, ErrTorrentNode), errors.Is(err, ErrTorrentBinding), errors.Is(err, ErrTorrentProtocol), errors.Is(err, ErrTorrentJobMissing):
		return model.DownloadFailureNode
	case errors.Is(err, model.ErrDownloadSourceUnavailable), errors.Is(err, ErrTransferChecksum):
		return model.DownloadFailureIncomplete
	case errors.Is(err, model.ErrQuota):
		return model.DownloadFailureQuota
	case errors.Is(err, model.ErrDownloadMetadataLimited):
		return model.DownloadFailureDestination
	case errors.Is(err, model.ErrTooLarge):
		return model.DownloadFailureLarge
	case errors.Is(err, model.ErrFilenameRestricted):
		return model.DownloadFailureFilename
	case errors.Is(err, model.ErrBusy):
		return model.DownloadFailureQuota
	case errors.Is(err, model.ErrMissing), errors.Is(err, model.ErrConflict):
		return model.DownloadFailureDestination
	case errors.Is(err, ErrCleanup):
		return model.DownloadFailureCleanup
	case errors.Is(err, model.ErrDownloadLeaseLost), errors.Is(err, context.Canceled):
		return model.DownloadFailureLease
	default:
		return model.DownloadFailureStorage
	}
}

func (s *TorrentDownloads) cleanupTorrentChildren(ctx context.Context, snapshot TorrentSnapshot) error {
	if len(snapshot.Transfers) == 0 {
		return nil
	}
	return s.withCandidateLocks(ctx, snapshot.Transfers, func(ctx context.Context) error {
		current, err := s.repo.ReadTorrent(ctx, snapshot.Task.OwnerID, snapshot.Task.ID)
		if err != nil {
			return err
		}
		var cleanupErrors error
		for _, child := range current.Transfers {
			if !child.Terminal() {
				return model.ErrConflict
			}
			_, err := s.transfers.cleanupLocked(ctx, child)
			cleanupErrors = errors.Join(cleanupErrors, err)
		}
		return cleanupErrors
	})
}

// finishTorrent 把可恢复的下载/清理错误落到持久状态，数据库或围栏错误完整返回调度边界。
func (s *TorrentDownloads) finishTorrent(ctx context.Context, claim DownloadClaim, runErr error, shuttingDown bool) (TorrentSnapshot, error) {
	const intentSettleAttempts = 3
	var result TorrentSnapshot
	var err error
	for attempt := 0; attempt < intentSettleAttempts; attempt++ {
		result, err = s.settleTorrentOnce(ctx, claim, runErr, shuttingDown)
		if !errors.Is(err, errTorrentControlled) {
			return result, err
		}
	}
	return result, err
}

func (s *TorrentDownloads) settleTorrentOnce(ctx context.Context, claim DownloadClaim, runErr error, shuttingDown bool) (TorrentSnapshot, error) {
	snapshot, err := s.repo.ReadTorrent(ctx, claim.OwnerID, claim.TaskID)
	if err != nil {
		return TorrentSnapshot{}, err
	}
	if snapshot.Task.LeaseToken != claim.Token || !snapshot.Task.LeaseValid(s.transfers.files.clock.Now().UTC()) {
		// 已丢失发布权限，最多暂停本领取者自己的GID，不能改写新领取者或释放其预算。
		var stopErrors error
		for _, binding := range snapshot.Bindings {
			if binding.ClaimToken != claim.Token || !binding.Submitted || binding.Cleaned {
				continue
			}
			node, exists := s.nodes[binding.NodeID]
			if !exists {
				stopErrors = errors.Join(stopErrors, ErrTorrentNode)
				continue
			}
			job, err := s.bindingJob(node, binding)
			if err != nil {
				stopErrors = errors.Join(stopErrors, err)
				continue
			}
			if err := node.Engine.Pause(ctx, job); err != nil && !errors.Is(err, ErrTorrentJobMissing) {
				stopErrors = errors.Join(stopErrors, err)
			}
		}
		return TorrentSnapshot{}, errors.Join(model.ErrDownloadLeaseLost, stopErrors)
	}
	now := s.transfers.files.clock.Now().UTC()
	desired := snapshot.Task.State
	switch {
	case snapshot.Task.State == model.DownloadCompleted:
		desired = model.DownloadCompleted
	case !now.Before(snapshot.Task.ExpiresAt):
		desired = model.DownloadExpired
	case snapshot.Task.Intent == model.DownloadCancel:
		desired = model.DownloadCanceled
	case snapshot.Task.Intent == model.DownloadPause || !s.policy.Enabled:
		desired = model.DownloadPaused
	case snapshot.Task.State == model.DownloadSelecting:
		desired = model.DownloadSelecting
	case shuttingDown:
		desired = model.DownloadQueued
	case snapshot.Task.State == model.DownloadFailed && runErr == nil:
		desired = model.DownloadFailed
	default:
		desired = model.DownloadFailed
	}
	if desired == model.DownloadCanceled || desired == model.DownloadExpired {
		snapshot, err = s.changeOwned(ctx, claim, func(mutation *TorrentMutation, _ TorrentSnapshot) error {
			mutation.Task.State = desired
			mutation.Task.FinishedAt = &now
			mutation.Task.UpdatedAt = now
			mutation.Data.Metadata = nil
			for index := range mutation.Transfers {
				child := &mutation.Transfers[index]
				if child.Terminal() {
					continue
				}
				child.State = model.TransferCanceled
				if desired == model.DownloadExpired {
					child.State = model.TransferExpired
				}
				child.CleanupPending = true
				child.UpdatedAt = now
				child.Revision++
			}
			return nil
		})
		if err != nil {
			return TorrentSnapshot{}, err
		}
	}
	disposition := retainTorrentPayload
	if desired == model.DownloadCompleted || desired == model.DownloadCanceled || desired == model.DownloadExpired {
		disposition = cleanTorrentBinding
	}
	// 为持久化最后状态保留独立时间，节点I/O超时不能耗尽整个收尾上下文。
	ioContext, ioCancel := context.WithTimeout(ctx, cleanupTimeout/2)
	defer ioCancel()
	var cleanupErrors error
	for _, binding := range snapshot.Bindings {
		if binding.Cleaned {
			continue
		}
		node, exists := s.nodes[binding.NodeID]
		if !exists {
			cleanupErrors = errors.Join(cleanupErrors, ErrTorrentNode)
			continue
		}
		_, err := s.stopBinding(ioContext, claim, node, binding, disposition)
		cleanupErrors = errors.Join(cleanupErrors, err)
	}
	if desired == model.DownloadCompleted || desired == model.DownloadCanceled || desired == model.DownloadExpired {
		cleanupErrors = errors.Join(cleanupErrors, s.cleanupTorrentChildren(ioContext, snapshot))
	}
	return s.changeOwned(ctx, claim, func(mutation *TorrentMutation, current TorrentSnapshot) error {
		// 用户命令可能在节点停止期间改变意图，收尾只接受仍相同的持久意图。
		if current.Task.Intent != snapshot.Task.Intent {
			return errTorrentControlled
		}
		mutation.Task.State = desired
		mutation.Task.RateBytesPerSecond = 0
		mutation.Task.UpdatedAt = s.transfers.files.clock.Now().UTC()
		if desired == model.DownloadPaused || desired == model.DownloadQueued || desired == model.DownloadSelecting {
			mutation.Task.FinishedAt = nil
			mutation.Task.FailureCode = model.DownloadFailureNone
		}
		if desired == model.DownloadPaused {
			mutation.Task.Intent = model.DownloadPause
		}
		if desired == model.DownloadFailed {
			if runErr != nil {
				mutation.Task.FailureCode = torrentFailure(runErr)
			} else if current.Task.FailureCode == model.DownloadFailureNone {
				mutation.Task.FailureCode = model.DownloadFailureIncomplete
			}
			if mutation.Task.FinishedAt == nil {
				finished := s.transfers.files.clock.Now().UTC()
				mutation.Task.FinishedAt = &finished
			}
		}
		if desired == model.DownloadCanceled {
			mutation.Task.FailureCode = model.DownloadFailureNone
		}
		if desired == model.DownloadExpired {
			mutation.Task.FailureCode = model.DownloadFailureExpired
		}
		if cleanupErrors != nil {
			mutation.Task.FailureCode = model.DownloadFailureCleanup
			if desired == model.DownloadPaused {
				mutation.Task.State = model.DownloadPausing
			}
			if desired == model.DownloadCanceled {
				mutation.Task.State = model.DownloadCanceling
				mutation.Task.FinishedAt = nil
			}
		}
		for index := range mutation.Transfers {
			child := &mutation.Transfers[index]
			if child.Terminal() {
				continue
			}
			if desired == model.DownloadPaused {
				child.State = model.TransferPaused
			} else if desired == model.DownloadFailed {
				child.State = model.TransferAttention
				child.FailureCode = string(mutation.Task.FailureCode)
			}
			child.UpdatedAt = mutation.Task.UpdatedAt
			child.Revision++
		}
		mutation.Task.LeaseToken, mutation.Task.LeaseUntil = "", nil
		return nil
	})
}
