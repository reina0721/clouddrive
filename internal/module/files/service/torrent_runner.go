package service

import (
	"context"
	"errors"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/logger"
)

var (
	errTorrentControlled = errors.New("torrent persistent intent changed")
	errTorrentSettlement = errors.New("torrent settlement failed")
)

// Dispatch 由既有Scheduler拥有取消与等待，每次只运行一个有持久领取围栏的任务。
func (s *TorrentDownloads) Dispatch(ctx context.Context) error {
	if !s.dispatcherEnabled {
		return nil
	}
	candidate, found, err := s.repo.NextTorrent(ctx, s.transfers.files.clock.Now().UTC(), s.policy.MaxAttempts, s.policy.TorrentNodeConcurrency)
	if err != nil || !found {
		return err
	}
	s.activeMu.Lock()
	_, running := s.active[candidate.ID]
	s.activeMu.Unlock()
	if running {
		return nil
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
	snapshot, err := s.repo.ChangeTorrent(ctx, candidate.OwnerID, candidate.ID, func(current TorrentSnapshot) (TorrentMutation, error) {
		mutation := unchangedTorrentMutation(current)
		now := s.transfers.files.clock.Now().UTC()
		ownActive := false
		for _, binding := range current.Bindings {
			if !binding.Cleaned && !binding.Stopped {
				ownActive = true
			}
		}
		if current.Task.LeaseValid(now) || current.GlobalActiveTasks >= s.policy.Concurrency && !ownActive {
			return mutation, model.ErrBusy
		}
		if current.Task.Attempts >= s.policy.MaxAttempts {
			if !current.Task.State.Finished() {
				mutation.Task.State, mutation.Task.FailureCode = model.DownloadFailed, model.DownloadFailureAttempts
				mutation.Task.FinishedAt = &now
			}
			mutation.Task.LeaseToken, mutation.Task.LeaseUntil = "", nil
			mutation.Task.UpdatedAt = now
			return mutation, nil
		}
		if _, exists := s.nodes[current.Data.NodeID]; !exists && current.Task.Intent == model.DownloadRun && now.Before(current.Task.ExpiresAt) && !current.Task.State.Finished() {
			mutation.Task.State, mutation.Task.FailureCode = model.DownloadFailed, model.DownloadFailureNode
			mutation.Task.FinishedAt, mutation.Task.UpdatedAt = &now, now
			return mutation, nil
		}

		starting := s.policy.Enabled && current.Task.Intent == model.DownloadRun && now.Before(current.Task.ExpiresAt) && (current.Task.State == model.DownloadQueued || current.Task.State == model.DownloadResolving || current.Task.State == model.DownloadFetching || current.Task.State == model.DownloadPublishing)
		if starting && !ownActive && current.NodeActiveTasks >= s.policy.TorrentNodeConcurrency {
			return mutation, model.ErrBusy
		}
		if starting && !ownActive && current.NodeHashActiveTasks > 0 {
			return mutation, model.ErrBusy
		}
		mutation.Task.Attempts++
		until := now.Add(s.policy.LeaseTTL)
		mutation.Task.LeaseToken, mutation.Task.LeaseUntil = token, &until
		mutation.Task.UpdatedAt = now
		if !s.policy.Enabled && !mutation.Task.State.Finished() {
			mutation.Task.Intent = model.DownloadPause
			mutation.Task.State = model.DownloadPausing
		}
		if starting {
			if len(current.Data.Files) == 0 {
				mutation.Task.State = model.DownloadResolving
			} else if len(current.Transfers) > 0 {
				mutation.Task.State = model.DownloadFetching
			} else {
				mutation.Task.State = model.DownloadSelecting
			}
			if mutation.Task.StartedAt == nil {
				mutation.Task.StartedAt = &now
			}
		}
		claimed = true
		return mutation, nil
	})
	if errors.Is(err, model.ErrBusy) || errors.Is(err, model.ErrMissing) {
		return nil
	}
	if err != nil {
		return &TorrentError{Kind: errTorrentSettlement, Cause: err}
	}
	if !claimed {
		s.logger.Warn("files.bittorrent.admission.failed", logger.String("owner", "files.bittorrent"), logger.String("phase", "admission"), logger.String("task_id", candidate.ID), logger.String("error_code", string(snapshot.Task.FailureCode)))
		return nil
	}
	claim := DownloadClaim{TaskID: candidate.ID, OwnerID: candidate.OwnerID, Token: token}
	work, cancel := context.WithCancelCause(ctx)
	s.activeMu.Lock()
	s.active[candidate.ID] = downloadRun{token: token, cancel: cancel}
	s.activeMu.Unlock()
	defer func() {
		cancel(nil)
		s.activeMu.Lock()
		if active, exists := s.active[candidate.ID]; exists && active.token == token {
			delete(s.active, candidate.ID)
		}
		s.activeMu.Unlock()
	}()
	attempt, endAttempt := context.WithTimeout(work, s.policy.AttemptTimeout)
	monitor := s.monitorTorrentLease(attempt, cancel, claim)
	s.logger.Info("files.bittorrent.claimed", logger.String("owner", "files.bittorrent"), logger.String("phase", "transfer"), logger.String("task_id", candidate.ID))
	runErr := s.runTorrent(attempt, claim)
	monitorErr := monitor.stop()
	if cause := context.Cause(work); cause != nil && !errors.Is(cause, context.Canceled) {
		runErr = errors.Join(runErr, cause)
	}
	runErr = errors.Join(runErr, monitorErr)
	endAttempt()
	finish, finishCancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer finishCancel()
	settled, finishErr := s.finishTorrent(finish, claim, runErr, errors.Is(ctx.Err(), context.Canceled))
	if finishErr != nil {
		return &TorrentError{Kind: errTorrentSettlement, Cause: errors.Join(runErr, finishErr)}
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	fields := []logger.Field{logger.String("owner", "files.bittorrent"), logger.String("phase", "transfer"), logger.String("task_id", candidate.ID), logger.String("error_code", string(settled.Task.FailureCode))}
	if runErr != nil && !errors.Is(runErr, errTorrentControlled) && !errors.Is(runErr, context.Canceled) {
		fields = append(fields, logger.String("cause_code", string(torrentFailure(runErr))))
	}
	if settled.Task.FailureCode != model.DownloadFailureNone {
		s.logger.Warn("files.bittorrent.settled.failure", fields...)
	} else if errors.Is(runErr, errTorrentControlled) || errors.Is(runErr, context.Canceled) {
		s.logger.Debug("files.bittorrent.interrupted", fields...)
	} else {
		s.logger.Info("files.bittorrent.settled", fields...)
	}
	return nil
}

func (s *TorrentDownloads) changeOwned(ctx context.Context, claim DownloadClaim, change func(*TorrentMutation, TorrentSnapshot) error) (TorrentSnapshot, error) {
	return s.repo.ChangeTorrent(ctx, claim.OwnerID, claim.TaskID, func(snapshot TorrentSnapshot) (TorrentMutation, error) {
		mutation := unchangedTorrentMutation(snapshot)
		if snapshot.Task.LeaseToken != claim.Token || !snapshot.Task.LeaseValid(s.transfers.files.clock.Now().UTC()) {
			return mutation, model.ErrDownloadLeaseLost
		}
		mutation.Claim = &claim
		if err := change(&mutation, snapshot); err != nil {
			return mutation, err
		}
		return mutation, nil
	})
}

// monitorTorrentLease 只属于一次Dispatch，stop总是取消并等待，不逃逸到下一代。
func (s *TorrentDownloads) monitorTorrentLease(ctx context.Context, cancel context.CancelCauseFunc, claim DownloadClaim) *downloadMonitor {
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
					_, err = s.changeOwned(lifetime, claim, func(mutation *TorrentMutation, current TorrentSnapshot) error {
						if current.Task.Intent != model.DownloadRun && !current.Task.State.Finished() {
							return errTorrentControlled
						}
						until := s.transfers.files.clock.Now().UTC().Add(s.policy.LeaseTTL)
						mutation.Task.LeaseUntil = &until
						return nil
					})
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

func (s *TorrentDownloads) runTorrent(ctx context.Context, claim DownloadClaim) error {
	snapshot, err := s.repo.ReadTorrent(ctx, claim.OwnerID, claim.TaskID)
	if err != nil {
		return err
	}
	if snapshot.Task.Intent != model.DownloadRun || snapshot.Task.State.Finished() || !s.policy.Enabled || !s.transfers.files.clock.Now().Before(snapshot.Task.ExpiresAt) {
		return nil
	}
	if snapshot.Task.State == model.DownloadSelecting {
		return nil
	}
	if err := s.authorize(ctx, claim.OwnerID); err != nil {
		return err
	}
	node, exists := s.nodes[snapshot.Data.NodeID]
	if !exists {
		return ErrTorrentNode
	}
	phase := TorrentJobPayload
	if len(snapshot.Data.Files) == 0 {
		phase = TorrentJobMetadata
	}
	job, err := s.startTorrentJob(ctx, claim, node, phase)
	if err != nil {
		return err
	}
	if err := s.awaitTorrent(ctx, claim, node, job); err != nil {
		return err
	}
	if phase == TorrentJobMetadata {
		raw, err := node.Engine.ReadMetadata(ctx, job, snapshot.Data.InfoHash)
		if err != nil {
			return err
		}
		metadata, err := s.decoder.Decode(raw)
		if err != nil {
			return err
		}
		if metadata.InfoHash != snapshot.Data.InfoHash {
			return ErrTorrentMetadata
		}
		_, err = s.changeActive(ctx, claim, func(mutation *TorrentMutation, _ TorrentSnapshot) error {
			mutation.Data.Metadata, mutation.Data.Name, mutation.Data.TotalBytes = raw, metadata.Name, metadata.TotalBytes
			mutation.Data.Files = []TorrentSelectionFile{}
			for _, file := range metadata.Files {
				mutation.Data.Files = append(mutation.Data.Files, TorrentSelectionFile{TorrentFile: file})
			}
			mutation.Task.State, mutation.Task.FailureCode = model.DownloadSelecting, model.DownloadFailureNone
			mutation.Task.ReceivedBytes, mutation.Task.RateBytesPerSecond = 0, 0
			mutation.Task.UpdatedAt = s.transfers.files.clock.Now().UTC()
			return nil
		})
		return err
	}
	return s.publish(ctx, claim, node, job)
}
