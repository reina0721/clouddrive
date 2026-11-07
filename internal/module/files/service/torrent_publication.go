package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

func activeTorrentClaim(task model.DownloadTask, claim DownloadClaim, now time.Time) error {
	if task.Kind != model.DownloadBitTorrent || task.ID != claim.TaskID || task.OwnerID != claim.OwnerID || task.LeaseToken != claim.Token || !task.LeaseValid(now) || task.Intent != model.DownloadRun || !now.Before(task.ExpiresAt) {
		return model.ErrDownloadLeaseLost
	}
	switch task.State {
	case model.DownloadResolving, model.DownloadFetching, model.DownloadPublishing:
		return nil
	default:
		return model.ErrDownloadLeaseLost
	}
}

func (s *TorrentDownloads) changeActive(ctx context.Context, claim DownloadClaim, change func(*TorrentMutation, TorrentSnapshot) error) (TorrentSnapshot, error) {
	return s.repo.ChangeTorrent(ctx, claim.OwnerID, claim.TaskID, func(snapshot TorrentSnapshot) (TorrentMutation, error) {
		mutation := unchangedTorrentMutation(snapshot)
		if err := activeTorrentClaim(snapshot.Task, claim, s.transfers.files.clock.Now().UTC()); err != nil {
			return mutation, err
		}
		mutation.Claim = &claim
		if err := change(&mutation, snapshot); err != nil {
			return mutation, err
		}
		return mutation, nil
	})
}

// withCandidateLocks 按固定ID顺序持有整批候选锁，覆盖写对象、发布和失败补偿。
// 一批最多MaxTorrentFiles把锁，内容reader仍一次一个；不启动额外goroutine。
// 这使迟到worker不能在下一领取者发布后删除同一ObjectKey。
func (s *TorrentDownloads) withCandidateLocks(ctx context.Context, children []model.Transfer, work func(context.Context) error) error {
	if len(children) == 0 || len(children) > MaxTorrentFiles || work == nil {
		return model.ErrInvalid
	}
	identifiers := make([]string, 0, len(children))
	for _, child := range children {
		identifiers = append(identifiers, child.ID)
	}
	sort.Strings(identifiers)
	for index, id := range identifiers {
		if model.ValidateTransferID(id) != nil || index > 0 && id == identifiers[index-1] {
			return model.ErrInvalid
		}
	}
	var lockNext func(context.Context, int) error
	lockNext = func(ctx context.Context, index int) error {
		if index == len(identifiers) {
			return work(ctx)
		}
		return s.transfers.stage.WithLock(ctx, identifiers[index], func(locked context.Context) error { return lockNext(locked, index+1) })
	}
	return lockNext(ctx, 0)
}

func (s *TorrentDownloads) publish(ctx context.Context, claim DownloadClaim, node TorrentNode, job TorrentJob) error {
	initial, err := s.repo.ReadTorrent(ctx, claim.OwnerID, claim.TaskID)
	if err != nil {
		return err
	}
	if err := activeTorrentClaim(initial.Task, claim, s.transfers.files.clock.Now().UTC()); err != nil {
		return err
	}
	if node.Config.ID != initial.Data.NodeID || job.Phase != TorrentJobPayload {
		return ErrTorrentBinding
	}
	identity, err := TorrentWorkspaceIdentity(node.Config)
	if err != nil {
		return err
	}
	bound := false
	for _, binding := range initial.Bindings {
		if binding.GID == job.GID && binding.Phase == TorrentJobPayload && binding.ClaimToken == claim.Token && binding.Accepted && !binding.Cleaned && binding.WorkspaceIdentity == identity {
			bound = true
		}
	}
	if !bound {
		return ErrTorrentBinding
	}
	return s.withCandidateLocks(ctx, initial.Transfers, func(ctx context.Context) (returned error) {
		if err := s.authorize(ctx, claim.OwnerID); err != nil {
			return err
		}
		snapshot, err := s.changeActive(ctx, claim, func(mutation *TorrentMutation, _ TorrentSnapshot) error {
			mutation.Task.State = model.DownloadPublishing
			mutation.Task.UpdatedAt = s.transfers.files.clock.Now().UTC()
			return nil
		})
		if err != nil {
			return err
		}
		progress, err := node.Engine.Progress(ctx, job)
		if err != nil {
			return err
		}
		if progress.State != TorrentNodeComplete || progress.InfoHash != snapshot.Data.InfoHash {
			return ErrTorrentProtocol
		}
		files := map[string]TorrentFile{}
		for _, child := range snapshot.Transfers {
			if err := s.transfers.files.policy.NameAdmission.validate(child.Name); err != nil {
				return err
			}
		}
		for _, file := range snapshot.Data.Files {
			if file.Selected {
				files[file.TransferID] = file.TorrentFile
			}
		}
		createdKeys := []string{}
		commitAttempted := false
		defer func() {
			if returned == nil || commitAttempted {
				return
			}
			cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
			defer cancel()
			for _, key := range createdKeys {
				if err := s.transfers.content.Delete(cleanup, key); err != nil {
					returned = errors.Join(returned, ErrCleanup, err)
					// 当前仍持有全部候选锁；即使租约已丢失，真实未清理对象也不能丢掉标记。
					for _, child := range snapshot.Transfers {
						if child.ObjectKey == key {
							_, debtErr := s.transfers.change(cleanup, claim.OwnerID, child.ID, func(current *model.Transfer, _ []model.Entry) error { current.CleanupPending = true; return nil })
							returned = errors.Join(returned, debtErr)
						}
					}
				}
			}
		}()
		candidates := map[string]model.Entry{}
		for _, child := range snapshot.Transfers {
			file, exists := files[child.ID]
			if !exists {
				return model.ErrInvalid
			}
			if err := ctx.Err(); err != nil {
				return err
			}
			if err := s.transfers.stage.Remove(ctx, child.ID); err != nil {
				return err
			}
			// 服务端流写入复用deferred暂存契约，实际长度在有界复制后由Seal固定。
			if err := s.transfers.stage.CreateDeferred(ctx, child.ID); err != nil {
				return err
			}
			var checksum string
			err := node.Engine.OpenCompleted(ctx, job, file, func(reader io.Reader) error {
				written, digest, err := s.transfers.stage.WriteStream(ctx, child.ID, reader, child.SizeBytes)
				if err != nil {
					return err
				}
				if written != child.SizeBytes {
					return ErrTransferChecksum
				}
				checksum = digest
				return s.transfers.stage.Seal(ctx, child.ID, child.SizeBytes)
			})
			if err != nil {
				return err
			}
			if checksum == "" {
				return ErrTransferChecksum
			}
			_, err = s.changeActive(ctx, claim, func(mutation *TorrentMutation, _ TorrentSnapshot) error {
				found := false
				for index := range mutation.Transfers {
					current := &mutation.Transfers[index]
					if current.ID != child.ID {
						continue
					}
					if current.Terminal() {
						return model.ErrConflict
					}
					current.ContentSHA256, current.State, current.CleanupPending = checksum, model.TransferPublishing, false
					current.UpdatedAt = s.transfers.files.clock.Now().UTC()
					current.Revision++
					found = true
				}
				if !found {
					return model.ErrMissing
				}
				return nil
			})
			if err != nil {
				return err
			}
			createdKeys = append(createdKeys, child.ObjectKey)
			var mediaType string
			err = s.transfers.stage.WithReader(ctx, child.ID, func(source io.ReadSeeker) error {
				hash := sha256.New()
				count, err := io.Copy(hash, io.LimitReader(downloadContextReader{ctx: ctx, source: source}, child.SizeBytes+1))
				if err != nil {
					return err
				}
				if count != child.SizeBytes || hex.EncodeToString(hash.Sum(nil)) != checksum {
					return ErrTransferChecksum
				}
				if _, err := source.Seek(0, io.SeekStart); err != nil {
					return err
				}
				prefix := make([]byte, transferMIMESniffBytes)
				read, err := io.ReadFull(source, prefix)
				if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
					return err
				}
				mediaType = http.DetectContentType(prefix[:read])
				if _, err := source.Seek(0, io.SeekStart); err != nil {
					return err
				}
				return s.transfers.content.PutReader(ctx, child.ObjectKey, source, child.SizeBytes, mediaType)
			})
			if err != nil {
				return err
			}
			now := s.transfers.files.clock.Now().UTC()
			candidates[child.ID] = model.Entry{ID: child.ID, OwnerID: claim.OwnerID, ParentID: child.ParentID, Kind: model.File, Name: child.Name, NormalizedName: child.NormalizedName, ObjectKey: child.ObjectKey, SizeBytes: child.SizeBytes, MediaType: mediaType, CreatedAt: now, UpdatedAt: now, ContentSHA: checksum, ContentRevision: 1}
		}
		if err := s.authorize(ctx, claim.OwnerID); err != nil {
			return err
		}
		// 提交错误不等于事务必然回滚。结果不确定时不删除对象，由持久任务和相同候选锁协调恢复。
		commitAttempted = true
		completed, err := s.changeActive(ctx, claim, func(mutation *TorrentMutation, current TorrentSnapshot) error {
			if current.MetadataLimited {
				return model.ErrDownloadMetadataLimited
			}
			if err := model.Parent(current.Entries, current.Task.TargetParentID); err != nil {
				return err
			}
			if len(current.Entries)+len(current.Data.Folders)+len(current.Transfers) > s.transfers.files.policy.SearchTreeEntries {
				return model.ErrDownloadMetadataLimited
			}
			var selectedBytes int64
			for _, child := range current.Transfers {
				if child.SizeBytes > s.transfers.files.policy.MaxFileBytes {
					return model.ErrTooLarge
				}
				selectedBytes += child.SizeBytes
			}
			used := model.Used(current.Entries)
			if current.OwnerReservedBytes < selectedBytes {
				return model.ErrInvalid
			}
			otherReserved := current.OwnerReservedBytes - selectedBytes
			if used > s.transfers.files.policy.QuotaBytes || otherReserved > s.transfers.files.policy.QuotaBytes-used || selectedBytes > s.transfers.files.policy.QuotaBytes-used-otherReserved {
				return model.ErrQuota
			}
			planned := append([]model.Entry(nil), current.Entries...)
			folders := append([]TorrentFolder(nil), current.Data.Folders...)
			sort.Slice(folders, func(left, right int) bool {
				return strings.Count(folders[left].Path, "/") < strings.Count(folders[right].Path, "/")
			})
			now := s.transfers.files.clock.Now().UTC()
			for _, folder := range folders {
				normalized, err := s.transfers.files.normalizedName(folder.Name)
				if err != nil {
					return err
				}
				if err := model.Parent(planned, folder.ParentID); err != nil {
					return err
				}
				if err := model.Available(planned, "", folder.ParentID, normalized); err != nil {
					return err
				}
				entry := model.Entry{ID: folder.EntryID, OwnerID: claim.OwnerID, ParentID: folder.ParentID, Kind: model.Folder, Name: folder.Name, NormalizedName: normalized, CreatedAt: now, UpdatedAt: now, ContentRevision: 1}
				mutation.Entries = append(mutation.Entries, entry)
				planned = append(planned, entry)
			}
			for index, child := range current.Transfers {
				entry, exists := candidates[child.ID]
				if !exists || child.ContentSHA256 != entry.ContentSHA || child.State != model.TransferPublishing {
					return model.ErrConflict
				}
				if err := model.Parent(planned, child.ParentID); err != nil {
					return err
				}
				if err := model.Available(planned, "", child.ParentID, child.NormalizedName); err != nil {
					return err
				}
				mutation.Entries = append(mutation.Entries, entry)
				planned = append(planned, entry)
				mutation.Transfers[index].State, mutation.Transfers[index].EntryID, mutation.Transfers[index].CleanupPending = model.TransferCompleted, child.ID, true
				mutation.Transfers[index].UpdatedAt = now
				mutation.Transfers[index].Revision++
			}
			mutation.Task.State, mutation.Task.FailureCode = model.DownloadCompleted, model.DownloadFailureNone
			mutation.Task.FinishedAt = &now
			mutation.Task.DeclaredBytes = &selectedBytes
			mutation.Task.ReceivedBytes, mutation.Task.RateBytesPerSecond = selectedBytes, 0
			mutation.Task.UpdatedAt = now
			mutation.Data.Metadata = nil
			return nil
		})
		if err != nil {
			return err
		}
		var cleanupErrors error
		for _, child := range completed.Transfers {
			_, err := s.transfers.cleanupLocked(ctx, child)
			cleanupErrors = errors.Join(cleanupErrors, err)
		}
		return cleanupErrors
	})
}
