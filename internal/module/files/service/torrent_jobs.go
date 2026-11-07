package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"path/filepath"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

const torrentNodeControlInterval = 100 * time.Millisecond

type torrentBindingDisposition uint8

const (
	retainTorrentPayload torrentBindingDisposition = iota
	cleanTorrentBinding
)

func (s *TorrentDownloads) bindingJob(node TorrentNode, binding TorrentBinding) (TorrentJob, error) {
	identity, err := TorrentWorkspaceIdentity(node.Config)
	if err != nil {
		return TorrentJob{}, err
	}
	if binding.NodeID != node.Config.ID || binding.WorkspaceIdentity != identity {
		return TorrentJob{}, ErrTorrentBinding
	}
	return TorrentJob{GID: binding.GID, Directory: filepath.Join(node.Config.WorkspaceRoot, binding.GID), Phase: binding.Phase}, nil
}

func (s *TorrentDownloads) updateBinding(ctx context.Context, claim DownloadClaim, gid string, update func(*TorrentBinding) error) (TorrentBinding, error) {
	var result TorrentBinding
	_, err := s.changeOwned(ctx, claim, func(mutation *TorrentMutation, _ TorrentSnapshot) error {
		for index := range mutation.Bindings {
			if mutation.Bindings[index].GID == gid {
				if err := update(&mutation.Bindings[index]); err != nil {
					return err
				}
				result = mutation.Bindings[index]
				mutation.Task.UpdatedAt = s.transfers.files.clock.Now().UTC()
				return nil
			}
		}
		return model.ErrMissing
	})
	return result, err
}

func nativeTorrentStopped(state TorrentNodeState) bool {
	return state == TorrentNodeComplete || state == TorrentNodeError || state == TorrentNodeRemoved
}

func waitTorrentStopped(ctx context.Context, node TorrentNode, job TorrentJob, disposition torrentBindingDisposition) error {
	ticker := time.NewTicker(torrentNodeControlInterval)
	defer ticker.Stop()
	for {
		progress, err := node.Engine.Progress(ctx, job)
		if errors.Is(err, ErrTorrentJobMissing) {
			return nil
		}
		if err != nil {
			return err
		}
		if nativeTorrentStopped(progress.State) || disposition == retainTorrentPayload && progress.State == TorrentNodePaused {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

// stopBinding 先确认特定GID停止，再推进持久账本；未提交候选可由新领取者围栏回收。
func (s *TorrentDownloads) stopBinding(ctx context.Context, claim DownloadClaim, node TorrentNode, binding TorrentBinding, disposition torrentBindingDisposition) (TorrentBinding, error) {
	if binding.Cleaned {
		return binding, nil
	}
	job, err := s.bindingJob(node, binding)
	if err != nil {
		return binding, err
	}
	if !binding.Submitted || binding.Stopped && !binding.Accepted {
		binding, err = s.updateBinding(ctx, claim, binding.GID, func(current *TorrentBinding) error { current.Stopped = true; return nil })
		if err != nil {
			return binding, err
		}
		if err := node.Engine.DiscardUnsubmitted(ctx, job); err != nil {
			return binding, errors.Join(ErrCleanup, err)
		}
		return s.updateBinding(ctx, claim, binding.GID, func(current *TorrentBinding) error { current.Cleaned = true; return nil })
	}
	progress, err := node.Engine.Progress(ctx, job)
	missing := errors.Is(err, ErrTorrentJobMissing)
	if err != nil && !missing {
		return binding, err
	}
	if missing && !binding.Accepted {
		return binding, errors.Join(ErrCleanup, ErrTorrentJobMissing)
	}
	if !missing {
		binding, err = s.updateBinding(ctx, claim, binding.GID, func(current *TorrentBinding) error { current.Accepted = true; return nil })
		if err != nil {
			return binding, err
		}
		if progress.State != TorrentNodePaused && !nativeTorrentStopped(progress.State) {
			pauseErr := node.Engine.Pause(ctx, job)
			if waitErr := waitTorrentStopped(ctx, node, job, retainTorrentPayload); waitErr != nil {
				return binding, errors.Join(pauseErr, waitErr)
			}
		}
		// 不保留可被迟到unpause重新启动的暂停句柄，只保留经过围栏的文件缓存。
		removeErr := node.Engine.Remove(ctx, job)
		if waitErr := waitTorrentStopped(ctx, node, job, cleanTorrentBinding); waitErr != nil {
			return binding, errors.Join(removeErr, waitErr)
		}
	}
	// 先保存没有活动旧job的节点会话，再把Stopped写入本项目账本。
	if err := node.Engine.PersistSession(ctx); err != nil {
		return binding, err
	}
	binding, err = s.updateBinding(ctx, claim, binding.GID, func(current *TorrentBinding) error { current.Stopped = true; return nil })
	if err != nil {
		return binding, err
	}
	if disposition == retainTorrentPayload && binding.Phase == TorrentJobPayload {
		return binding, nil
	}
	if err := node.Engine.CleanupStopped(ctx, job); err != nil {
		return binding, errors.Join(ErrCleanup, err)
	}
	return s.updateBinding(ctx, claim, binding.GID, func(current *TorrentBinding) error { current.Cleaned = true; return nil })
}

// recordSubmission 允许原提交者记录迟到结果；这不允许旧领取者发布或续租。
func (s *TorrentDownloads) recordSubmission(ctx context.Context, claim DownloadClaim, gid string, outcome TorrentSubmissionOutcome) error {
	receipt, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout/2)
	defer cancel()
	err := s.repo.RecordTorrentSubmission(receipt, claim, gid, outcome)
	if errors.Is(err, model.ErrMissing) {
		return nil
	}
	return err
}
func (s *TorrentDownloads) startTorrentJob(ctx context.Context, claim DownloadClaim, node TorrentNode, phase TorrentJobPhase) (TorrentJob, error) {
	snapshot, err := s.repo.ReadTorrent(ctx, claim.OwnerID, claim.TaskID)
	if err != nil {
		return TorrentJob{}, err
	}
	var retained *TorrentBinding
	for _, binding := range snapshot.Bindings {
		if binding.Cleaned {
			continue
		}
		disposition := cleanTorrentBinding
		if phase == TorrentJobPayload && binding.Phase == TorrentJobPayload && binding.Submitted {
			disposition = retainTorrentPayload
		}
		stopped, err := s.stopBinding(ctx, claim, node, binding, disposition)
		if err != nil {
			return TorrentJob{}, err
		}
		if !stopped.Cleaned && stopped.Accepted {
			copy := stopped
			retained = &copy
		}
	}
	identity, err := node.Engine.Probe(ctx)
	if err != nil {
		return TorrentJob{}, &TorrentError{Kind: ErrTorrentNode, Cause: err}
	}
	location, err := TorrentWorkspaceIdentity(node.Config)
	if err != nil {
		return TorrentJob{}, err
	}
	randomID, err := s.transfers.files.ids.New()
	if err != nil {
		return TorrentJob{}, err
	}
	digest := sha256.Sum256([]byte(randomID))
	gid := hex.EncodeToString(digest[:8])
	var binding TorrentBinding
	snapshot, err = s.changeActive(ctx, claim, func(mutation *TorrentMutation, current TorrentSnapshot) error {
		if len(current.Bindings) >= MaxTorrentBindings {
			return model.ErrTooLarge
		}
		if current.NodeActiveTasks >= s.policy.TorrentNodeConcurrency {
			return model.ErrBusy
		}
		if current.NodeHashActiveTasks > 0 {
			return model.ErrBusy
		}
		reserved := TorrentMetadataReservationBytes
		if phase == TorrentJobPayload {
			reserved = current.Data.TotalBytes + TorrentPayloadOverheadBytes
		}
		if current.NodeReservedBytes > s.policy.TorrentNodeReservedBytes || reserved > s.policy.TorrentNodeReservedBytes-current.NodeReservedBytes {
			return model.ErrBusy
		}
		binding = TorrentBinding{GID: gid, TaskID: claim.TaskID, OwnerID: claim.OwnerID, NodeID: node.Config.ID, ClaimToken: claim.Token, Phase: phase, WorkspaceIdentity: location, NodeSessionID: identity.SessionID, ReservedBytes: reserved, CreatedAt: s.transfers.files.clock.Now().UTC()}
		mutation.Bindings = append(mutation.Bindings, binding)
		return nil
	})
	if err != nil {
		return TorrentJob{}, err
	}
	job, err := s.bindingJob(node, binding)
	if err != nil {
		return TorrentJob{}, err
	}
	selectedFiles := []TorrentFile{}
	indexes := []int{}
	for _, file := range snapshot.Data.Files {
		if file.Selected {
			selectedFiles = append(selectedFiles, file.TorrentFile)
			indexes = append(indexes, file.Index)
		}
	}
	if phase == TorrentJobPayload && retained != nil {
		previous, err := s.bindingJob(node, *retained)
		if err != nil {
			return TorrentJob{}, err
		}
		if err := node.Engine.ClonePartial(ctx, previous, job, selectedFiles); err != nil {
			return TorrentJob{}, err
		}
	}
	if err := node.Engine.PrepareJob(ctx, job); err != nil {
		return TorrentJob{}, err
	}
	// 只有新目录已获得保留数据，才清理旧payload；失败时两份预留均留在账本。
	for _, old := range snapshot.Bindings {
		if old.GID != gid && !old.Cleaned {
			if _, err := s.stopBinding(ctx, claim, node, old, cleanTorrentBinding); err != nil {
				return TorrentJob{}, err
			}
		}
	}
	_, err = s.changeActive(ctx, claim, func(mutation *TorrentMutation, _ TorrentSnapshot) error {
		for index := range mutation.Bindings {
			if mutation.Bindings[index].GID == gid {
				mutation.Bindings[index].Submitted = true
				return nil
			}
		}
		return model.ErrMissing
	})
	if err != nil {
		return TorrentJob{}, err
	}
	if phase == TorrentJobMetadata {
		err = node.Engine.AddMetadata(ctx, job, snapshot.Task.SourceURI)
	} else {
		err = node.Engine.AddPayload(ctx, job, snapshot.Data.Metadata, indexes)
	}
	if err != nil {
		var submission *TorrentSubmissionError
		if errors.As(err, &submission) {
			if submission.Acknowledged {
				return TorrentJob{}, errors.Join(err, s.recordSubmission(ctx, claim, gid, TorrentSubmissionAccepted))
			}
			if submission.DefinitelyUnsent {
				return TorrentJob{}, errors.Join(err, s.recordSubmission(ctx, claim, gid, TorrentSubmissionUnsent))
			}
		}
		return TorrentJob{}, err
	}
	if err := s.recordSubmission(ctx, claim, gid, TorrentSubmissionAccepted); err != nil {
		return TorrentJob{}, err
	}
	if err := node.Engine.PersistSession(ctx); err != nil {
		return TorrentJob{}, err
	}
	// 在发出启动命令之前再检查一次持久意图；迟到控制只可能命中本GID。
	if _, err := s.changeActive(ctx, claim, func(*TorrentMutation, TorrentSnapshot) error { return nil }); err != nil {
		return TorrentJob{}, err
	}
	if err := node.Engine.Resume(ctx, job); err != nil {
		return TorrentJob{}, err
	}
	return job, nil
}

func (s *TorrentDownloads) awaitTorrent(ctx context.Context, claim DownloadClaim, node TorrentNode, job TorrentJob) error {
	ticker := time.NewTicker(s.policy.ProgressInterval)
	defer ticker.Stop()
	for {
		progress, err := node.Engine.Progress(ctx, job)
		if err != nil {
			return err
		}
		if progress.State == TorrentNodeError || progress.State == TorrentNodeRemoved {
			return model.ErrDownloadSourceUnavailable
		}
		if progress.State == TorrentNodePaused {
			return ErrTorrentNode
		}
		_, err = s.changeActive(ctx, claim, func(mutation *TorrentMutation, current TorrentSnapshot) error {
			if progress.InfoHash != "" && progress.InfoHash != current.Data.InfoHash {
				return ErrTorrentBinding
			}
			if job.Phase == TorrentJobPayload {
				actual := map[int]TorrentNodeFile{}
				for _, file := range progress.Files {
					actual[file.Index] = file
				}
				var received int64
				var selectedBytes int64
				for _, file := range current.Data.Files {
					status, exists := actual[file.Index]
					if !file.Selected {
						if exists && status.Selected {
							return ErrTorrentBinding
						}
						continue
					}
					if !exists || !status.Selected || status.Path != file.Path || status.SizeBytes != file.SizeBytes {
						return ErrTorrentBinding
					}
					received += status.ReceivedBytes
					selectedBytes += file.SizeBytes
				}
				if progress.State == TorrentNodeComplete {
					// aria2的终结结果可能丢弃bitfield，逐文件完成量会归零；以已校验终态和总量为准。
					// 实际文件仍须在发布前逐个核对路径与长度，不能只凭进度写入目录。
					if progress.ReceivedBytes != progress.TotalBytes || progress.ReceivedBytes < selectedBytes {
						return model.ErrDownloadSourceUnavailable
					}
					received = selectedBytes
				}
				mutation.Task.ReceivedBytes, mutation.Task.RateBytesPerSecond = received, float64(progress.RateBytesPerSecond)
			}
			now := s.transfers.files.clock.Now().UTC()
			mutation.Task.ProgressAt, mutation.Task.UpdatedAt = &now, now
			return nil
		})
		if err != nil {
			return err
		}
		if progress.State == TorrentNodeComplete {
			if err := node.Engine.PersistSession(ctx); err != nil {
				return err
			}
			_, err := s.updateBinding(ctx, claim, job.GID, func(current *TorrentBinding) error { current.Stopped = true; return nil })
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}
