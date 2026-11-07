package service

import (
	"context"
	"errors"
	"path"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

func (s *TorrentDownloads) cancelActive(id string) {
	s.activeMu.Lock()
	run, exists := s.active[id]
	s.activeMu.Unlock()
	if exists {
		run.cancel(errTorrentControlled)
	}
}

func validTorrentRevision(revision int64) bool {
	return revision >= 1 && revision < model.MaxDownloadRevision
}

func (s *TorrentDownloads) Command(ctx context.Context, owner, id string, revision int64, command DownloadCommand) (DownloadSummary, error) {
	if !validTorrentRevision(revision) {
		return DownloadSummary{}, model.ErrInvalid
	}
	if command == DownloadCommandResume || command == DownloadCommandRetry {
		if !s.dispatcherEnabled {
			return DownloadSummary{}, model.ErrDownloadUnavailable
		}
		if err := s.authorize(ctx, owner); err != nil {
			return DownloadSummary{}, err
		}
	}
	result, err := s.repo.ChangeTorrent(ctx, owner, id, func(snapshot TorrentSnapshot) (TorrentMutation, error) {
		mutation := unchangedTorrentMutation(snapshot)
		now := s.transfers.files.clock.Now().UTC()
		if snapshot.Task.Revision != revision {
			return mutation, model.ErrConflict
		}
		switch command {
		case DownloadCommandPause:
			switch snapshot.Task.State {
			case model.DownloadQueued, model.DownloadResolving, model.DownloadSelecting, model.DownloadFetching, model.DownloadPublishing:
			default:
				return mutation, model.ErrConflict
			}
			mutation.Task.Intent = model.DownloadPause
			mutation.Task.State = model.DownloadPaused
			if snapshot.Task.LeaseValid(now) {
				mutation.Task.State = model.DownloadPausing
			}
			for _, binding := range snapshot.Bindings {
				if !binding.Cleaned && !binding.Stopped {
					mutation.Task.State = model.DownloadPausing
				}
			}
			mutation.Task.FailureCode = model.DownloadFailureNone
		case DownloadCommandResume, DownloadCommandRetry:
			if snapshot.Task.LeaseValid(now) {
				return mutation, model.ErrConflict
			}
			if snapshot.Task.Intent == model.DownloadCancel {
				if command != DownloadCommandRetry || snapshot.Task.State == model.DownloadCompleted || snapshot.Task.State == model.DownloadCanceled || snapshot.Task.State == model.DownloadExpired {
					return mutation, model.ErrConflict
				}
				// 已取消任务只重试清理，绝不重新开始下载。
				mutation.Task.State = model.DownloadCanceling
				mutation.Task.FinishedAt = nil
				mutation.Task.FailureCode = model.DownloadFailureNone
				mutation.Task.Attempts = 0
				break
			}
			if !s.available {
				return mutation, model.ErrDownloadUnavailable
			}
			if _, exists := s.nodes[snapshot.Data.NodeID]; !exists {
				return mutation, ErrTorrentNode
			}
			if snapshot.Task.State != model.DownloadPaused && snapshot.Task.State != model.DownloadFailed {
				return mutation, model.ErrConflict
			}
			if !now.Before(snapshot.Task.ExpiresAt) {
				return mutation, ErrTransferExpired
			}
			if snapshot.MetadataLimited {
				return mutation, model.ErrDownloadMetadataLimited
			}
			if err := model.Parent(snapshot.Entries, snapshot.Task.TargetParentID); err != nil {
				return mutation, err
			}
			for _, child := range snapshot.Transfers {
				if child.Terminal() {
					return mutation, model.ErrConflict
				}
			}
			mutation.Task.Intent, mutation.Task.State = model.DownloadRun, model.DownloadQueued
			if len(snapshot.Data.Files) > 0 && len(snapshot.Transfers) == 0 {
				mutation.Task.State = model.DownloadSelecting
			}
			mutation.Task.FailureCode, mutation.Task.FinishedAt = model.DownloadFailureNone, nil
			mutation.Task.Attempts = 0
			mutation.Task.LeaseToken, mutation.Task.LeaseUntil = "", nil
			for index := range mutation.Transfers {
				mutation.Transfers[index].State = model.TransferPreparing
				mutation.Transfers[index].FailureCode = ""
				mutation.Transfers[index].Revision++
				mutation.Transfers[index].UpdatedAt = now
			}
		case DownloadCommandCancel:
			if snapshot.Task.State == model.DownloadCompleted || snapshot.Task.State == model.DownloadCanceled || snapshot.Task.State == model.DownloadExpired {
				return mutation, model.ErrConflict
			}
			mutation.Task.Intent, mutation.Task.State = model.DownloadCancel, model.DownloadCanceling
			mutation.Task.FinishedAt = nil
			mutation.Task.FailureCode = model.DownloadFailureNone
			mutation.Task.Attempts = 0
			if len(snapshot.Bindings) == 0 {
				// 没有job绑定就没有发生候选文件I/O，取消可直接释放纯元数据预留。
				mutation.Task.State, mutation.Task.FinishedAt = model.DownloadCanceled, &now
				mutation.Data.Metadata = nil
				for index := range mutation.Transfers {
					mutation.Transfers[index].State = model.TransferCanceled
					mutation.Transfers[index].CleanupPending = false
					mutation.Transfers[index].Revision++
					mutation.Transfers[index].UpdatedAt = now
				}
			}
		default:
			return mutation, model.ErrInvalid
		}
		mutation.Task.RateBytesPerSecond = 0
		mutation.Task.Revision++
		mutation.Task.UpdatedAt = now
		return mutation, nil
	})
	if err != nil {
		return DownloadSummary{}, err
	}
	if command == DownloadCommandPause || command == DownloadCommandCancel {
		s.cancelActive(id)
	}
	return s.summary(result), nil
}

func (s *TorrentDownloads) Retarget(ctx context.Context, owner, id string, revision int64, parent, name string) (DownloadSummary, error) {
	if !validTorrentRevision(revision) {
		return DownloadSummary{}, model.ErrInvalid
	}
	if err := s.authorize(ctx, owner); err != nil {
		return DownloadSummary{}, err
	}
	normalized, err := s.transfers.files.normalizedName(name)
	if err != nil {
		return DownloadSummary{}, err
	}
	result, err := s.repo.ChangeTorrent(ctx, owner, id, func(snapshot TorrentSnapshot) (TorrentMutation, error) {
		mutation := unchangedTorrentMutation(snapshot)
		now := s.transfers.files.clock.Now().UTC()
		if snapshot.Task.Revision != revision || snapshot.Task.LeaseValid(now) || snapshot.Task.Intent == model.DownloadCancel || (snapshot.Task.State != model.DownloadPaused && snapshot.Task.State != model.DownloadFailed) {
			return mutation, model.ErrConflict
		}
		if !now.Before(snapshot.Task.ExpiresAt) {
			return mutation, ErrTransferExpired
		}
		if snapshot.MetadataLimited {
			return mutation, model.ErrDownloadMetadataLimited
		}
		if err := model.Parent(snapshot.Entries, parent); err != nil {
			return mutation, err
		}
		if err := model.Available(snapshot.Entries, "", parent, normalized); err != nil {
			return mutation, err
		}
		mutation.Task.TargetParentID, mutation.Task.RequestedName = parent, name
		mutation.Task.Revision++
		mutation.Task.UpdatedAt = now
		for index := range mutation.Data.Folders {
			folder := &mutation.Data.Folders[index]
			if path.Dir(folder.Path) == "." {
				folder.ParentID, folder.Name = parent, name
			}
		}
		if len(mutation.Data.Folders) == 0 {
			mutation.Data.ResultFolderID = parent
		}
		for index := range mutation.Transfers {
			child := &mutation.Transfers[index]
			if child.Terminal() {
				return mutation, model.ErrConflict
			}
			if len(mutation.Data.Folders) == 0 {
				if err := s.transfers.files.policy.NameAdmission.validate(name); err != nil {
					return mutation, err
				}
				child.ParentID, child.Name, child.NormalizedName = parent, name, normalized
			}
			child.UpdatedAt = now
			child.Revision++
		}
		return mutation, nil
	})
	if err != nil {
		return DownloadSummary{}, err
	}
	return s.summary(result), nil
}

func (s *TorrentDownloads) Remove(ctx context.Context, owner, id string, revision int64) error {
	if !validTorrentRevision(revision) {
		return model.ErrInvalid
	}
	release, err := s.transfers.files.AcquireUpload(ctx)
	if err != nil {
		return err
	}
	defer release()
	token, err := s.transfers.files.ids.New()
	if err != nil {
		return err
	}
	_, err = s.repo.ChangeTorrent(ctx, owner, id, func(snapshot TorrentSnapshot) (TorrentMutation, error) {
		mutation := unchangedTorrentMutation(snapshot)
		now := s.transfers.files.clock.Now().UTC()
		if snapshot.Task.Revision != revision || !snapshot.Task.State.Finished() || snapshot.Task.LeaseValid(now) {
			return mutation, model.ErrConflict
		}
		until := now.Add(s.policy.LeaseTTL)
		mutation.Task.LeaseToken, mutation.Task.LeaseUntil = token, &until
		mutation.Task.Revision++
		mutation.Task.UpdatedAt = now
		mutation.Task.Attempts = 0
		if snapshot.Task.State != model.DownloadCompleted {
			mutation.Task.Intent = model.DownloadCancel
		}
		return mutation, nil
	})
	if err != nil {
		return err
	}
	finish, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()
	settled, err := s.finishTorrent(finish, DownloadClaim{TaskID: id, OwnerID: owner, Token: token}, nil, false)
	if err != nil {
		return err
	}
	if !settled.Task.State.Finished() {
		return ErrCleanup
	}
	for _, binding := range settled.Bindings {
		if !binding.Cleaned {
			return ErrCleanup
		}
	}
	for _, child := range settled.Transfers {
		if !child.Terminal() || child.CleanupPending {
			return ErrCleanup
		}
	}
	_, err = s.repo.ChangeTorrent(finish, owner, id, func(snapshot TorrentSnapshot) (TorrentMutation, error) {
		mutation := unchangedTorrentMutation(snapshot)
		if snapshot.Task.Revision != revision+1 {
			return mutation, model.ErrConflict
		}
		mutation.Delete = true
		return mutation, nil
	})
	return err
}

func (s *TorrentDownloads) Restart(ctx context.Context, owner, id string, revision int64) (DownloadSummary, error) {
	if !s.available {
		return DownloadSummary{}, model.ErrDownloadUnavailable
	}
	if !validTorrentRevision(revision) {
		return DownloadSummary{}, model.ErrInvalid
	}
	if err := s.authorize(ctx, owner); err != nil {
		return DownloadSummary{}, err
	}
	release, err := s.transfers.files.AcquireUpload(ctx)
	if err != nil {
		return DownloadSummary{}, err
	}
	defer release()
	token, err := s.transfers.files.ids.New()
	if err != nil {
		return DownloadSummary{}, err
	}
	snapshot, err := s.repo.ChangeTorrent(ctx, owner, id, func(current TorrentSnapshot) (TorrentMutation, error) {
		mutation := unchangedTorrentMutation(current)
		now := s.transfers.files.clock.Now().UTC()
		if current.Task.Revision != revision || current.Task.LeaseValid(now) || current.Task.Intent == model.DownloadCancel || (current.Task.State != model.DownloadPaused && current.Task.State != model.DownloadFailed) {
			return mutation, model.ErrConflict
		}
		if current.MetadataLimited {
			return mutation, model.ErrDownloadMetadataLimited
		}
		if !now.Before(current.Task.ExpiresAt) {
			return mutation, ErrTransferExpired
		}
		for _, child := range current.Transfers {
			if child.Terminal() {
				return mutation, model.ErrConflict
			}
		}
		until := now.Add(s.policy.LeaseTTL)
		mutation.Task.LeaseToken, mutation.Task.LeaseUntil = token, &until
		mutation.Task.Intent = model.DownloadPause
		mutation.Task.Revision++
		mutation.Task.UpdatedAt = now
		return mutation, nil
	})
	if err != nil {
		return DownloadSummary{}, err
	}
	claim := DownloadClaim{TaskID: id, OwnerID: owner, Token: token}
	cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()
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
		_, err := s.stopBinding(cleanup, claim, node, binding, cleanTorrentBinding)
		cleanupErrors = errors.Join(cleanupErrors, err)
	}
	if len(snapshot.Transfers) > 0 {
		cleanupErrors = errors.Join(cleanupErrors, s.withCandidateLocks(cleanup, snapshot.Transfers, func(ctx context.Context) error {
			var errs error
			for _, child := range snapshot.Transfers {
				errs = errors.Join(errs, s.transfers.stage.Remove(ctx, child.ID), s.transfers.content.Delete(ctx, child.ObjectKey))
			}
			return errs
		}))
	}
	settle, settleCancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout/2)
	defer settleCancel()
	result, settleErr := s.changeOwned(settle, claim, func(mutation *TorrentMutation, current TorrentSnapshot) error {
		if current.Task.Intent != model.DownloadPause {
			return errTorrentControlled
		}
		mutation.Task.State, mutation.Task.Intent = model.DownloadPaused, model.DownloadPause
		mutation.Task.LeaseToken, mutation.Task.LeaseUntil = "", nil
		mutation.Task.UpdatedAt = s.transfers.files.clock.Now().UTC()
		mutation.Task.FailureCode = model.DownloadFailureNone
		if cleanupErrors != nil {
			mutation.Task.FailureCode = model.DownloadFailureCleanup
			for _, binding := range mutation.Bindings {
				if !binding.Cleaned && !binding.Stopped {
					mutation.Task.State = model.DownloadPausing
				}
			}
			return nil
		}
		mutation.Task.ReceivedBytes, mutation.Task.RateBytesPerSecond = 0, 0
		mutation.Task.ProgressAt, mutation.Task.FinishedAt = nil, nil
		mutation.Task.Attempts = 0
		for index := range mutation.Transfers {
			child := &mutation.Transfers[index]
			child.ContentSHA256, child.FailureCode = "", ""
			child.State, child.CleanupPending = model.TransferPaused, false
			child.Revision++
			child.UpdatedAt = mutation.Task.UpdatedAt
		}
		return nil
	})
	if errors.Is(settleErr, errTorrentControlled) {
		_, finishErr := s.finishTorrent(settle, claim, nil, false)
		return DownloadSummary{}, errors.Join(model.ErrConflict, cleanupErrors, finishErr)
	}
	if cleanupErrors != nil || settleErr != nil {
		return DownloadSummary{}, errors.Join(cleanupErrors, settleErr)
	}
	return s.summary(result), nil
}
