package service

import (
	"context"
	"path"
	"sort"
	"strings"

	"github.com/reina0721/clouddrive/internal/module/files/model"
)

type TorrentSelection struct {
	Revision int64 `json:"revision" minimum:"1" maximum:"9007199254740990"`
	Indexes  []int `json:"indexes" minItems:"1" maxItems:"200"`
}

func (s *TorrentDownloads) Select(ctx context.Context, owner, id string, input TorrentSelection) (DownloadSummary, error) {
	if !s.available {
		return DownloadSummary{}, model.ErrDownloadUnavailable
	}
	if err := s.authorize(ctx, owner); err != nil {
		return DownloadSummary{}, err
	}
	if input.Revision < 1 || input.Revision >= model.MaxDownloadRevision || len(input.Indexes) < 1 || len(input.Indexes) > MaxTorrentFiles {
		return DownloadSummary{}, model.ErrInvalid
	}
	selected := map[int]bool{}
	for _, index := range input.Indexes {
		if index < 1 || index > MaxTorrentFiles || selected[index] {
			return DownloadSummary{}, model.ErrInvalid
		}
		selected[index] = true
	}
	result, err := s.repo.ChangeTorrent(ctx, owner, id, func(snapshot TorrentSnapshot) (TorrentMutation, error) {
		mutation := unchangedTorrentMutation(snapshot)
		now := s.transfers.files.clock.Now().UTC()
		if _, exists := s.nodes[snapshot.Data.NodeID]; !exists {
			return mutation, ErrTorrentNode
		}
		if snapshot.Task.Revision != input.Revision || snapshot.Task.State != model.DownloadSelecting || snapshot.Task.LeaseValid(now) || !now.Before(snapshot.Task.ExpiresAt) || len(snapshot.Transfers) != 0 {
			return mutation, model.ErrConflict
		}
		if snapshot.MetadataLimited {
			return mutation, model.ErrDownloadMetadataLimited
		}
		if len(snapshot.Data.Files) == 0 || len(snapshot.Data.Metadata) == 0 {
			return mutation, ErrTorrentMetadata
		}
		for _, binding := range snapshot.Bindings {
			if !binding.Stopped && !binding.Cleaned {
				return mutation, model.ErrBusy
			}
		}
		if err := model.Parent(snapshot.Entries, snapshot.Task.TargetParentID); err != nil {
			return mutation, err
		}
		var bytes int64
		knownSelections := 0
		folders := map[string]bool{}
		for _, file := range snapshot.Data.Files {
			if !selected[file.Index] {
				continue
			}
			if file.SizeBytes > s.transfers.files.policy.MaxFileBytes {
				return mutation, model.ErrTooLarge
			}
			knownSelections++
			bytes += file.SizeBytes
			for parent := path.Dir(file.Path); parent != "."; parent = path.Dir(parent) {
				folders[parent] = true
			}
		}
		if knownSelections != len(selected) {
			return mutation, model.ErrInvalid
		}
		used := model.Used(snapshot.Entries)
		if used > s.transfers.files.policy.QuotaBytes || snapshot.OwnerReservedBytes > s.transfers.files.policy.QuotaBytes-used || bytes > s.transfers.files.policy.QuotaBytes-used-snapshot.OwnerReservedBytes {
			return mutation, model.ErrQuota
		}
		if snapshot.OwnerReservedCount > int64(s.transfers.policy.OwnerCount) || snapshot.GlobalReservedCount > int64(s.transfers.policy.GlobalCount) || snapshot.GlobalReservedBytes > s.transfers.policy.StagingBytes || bytes > s.transfers.policy.StagingBytes-snapshot.GlobalReservedBytes {
			return mutation, model.ErrBusy
		}
		if len(snapshot.Entries)+len(folders)+len(input.Indexes) > s.transfers.files.policy.SearchTreeEntries {
			return mutation, model.ErrDownloadMetadataLimited
		}
		paths := make([]string, 0, len(folders))
		for folder := range folders {
			paths = append(paths, folder)
		}
		sort.Slice(paths, func(left, right int) bool {
			leftDepth, rightDepth := strings.Count(paths[left], "/"), strings.Count(paths[right], "/")
			if leftDepth != rightDepth {
				return leftDepth < rightDepth
			}
			return paths[left] < paths[right]
		})
		folderIDs := map[string]string{}
		planned := append([]model.Entry(nil), snapshot.Entries...)
		mutation.Data.Folders = []TorrentFolder{}
		for _, folderPath := range paths {
			folderID, err := s.transfers.files.ids.New()
			if err != nil {
				return mutation, err
			}
			parentID := snapshot.Task.TargetParentID
			name := path.Base(folderPath)
			if parentPath := path.Dir(folderPath); parentPath != "." {
				var found bool
				parentID, found = folderIDs[parentPath]
				if !found {
					return mutation, model.ErrInvalid
				}
			} else if snapshot.Task.RequestedName != "" {
				name = snapshot.Task.RequestedName
			}
			normalized, err := s.transfers.files.normalizedName(name)
			if err != nil {
				return mutation, err
			}
			if err := model.Available(planned, "", parentID, normalized); err != nil {
				return mutation, err
			}
			if _, exists := model.Find(planned, folderID); exists {
				return mutation, model.ErrConflict
			}
			folderIDs[folderPath] = folderID
			mutation.Data.Folders = append(mutation.Data.Folders, TorrentFolder{Path: folderPath, EntryID: folderID, ParentID: parentID, Name: name})
			planned = append(planned, model.Entry{ID: folderID, OwnerID: owner, ParentID: parentID, Name: name, NormalizedName: normalized, Kind: model.Folder, ContentRevision: 1, CreatedAt: now, UpdatedAt: now})
		}
		wanted := map[int]bool{}
		for _, index := range input.Indexes {
			wanted[index] = true
		}
		mutation.Transfers = []model.Transfer{}
		for index, file := range mutation.Data.Files {
			if !wanted[file.Index] {
				continue
			}
			identifier, err := s.transfers.files.ids.New()
			if err != nil {
				return mutation, err
			}
			parentID := snapshot.Task.TargetParentID
			if directory := path.Dir(file.Path); directory != "." {
				var found bool
				parentID, found = folderIDs[directory]
				if !found {
					return mutation, model.ErrInvalid
				}
			}
			name := torrentDesiredName(snapshot.Task, file.TorrentFile, len(snapshot.Data.Files))
			normalized, err := s.transfers.files.normalizedName(name)
			if err != nil {
				return mutation, err
			}
			if err := model.Available(planned, "", parentID, normalized); err != nil {
				return mutation, err
			}
			if _, exists := model.Find(planned, identifier); exists {
				return mutation, model.ErrConflict
			}
			child := model.Transfer{ID: identifier, OwnerID: owner, DownloadID: id, ParentID: parentID, Name: name, NormalizedName: normalized, SizeBytes: file.SizeBytes, SizeKnown: true, QuotaReservedBytes: file.SizeBytes, Source: model.TransferSourceOffline, IdempotencyKey: torrentTransferPrefix + identifier, State: model.TransferPreparing, Revision: 1, CreatedAt: now, UpdatedAt: now, ExpiresAt: snapshot.Task.ExpiresAt, ObjectKey: "files/" + identifier}
			mutation.Transfers = append(mutation.Transfers, child)
			mutation.Data.Files[index].Selected, mutation.Data.Files[index].TransferID = true, identifier
			planned = append(planned, model.Entry{ID: identifier, OwnerID: owner, ParentID: parentID, Name: name, NormalizedName: normalized, Kind: model.File, SizeBytes: file.SizeBytes, ContentRevision: 1, CreatedAt: now, UpdatedAt: now})
		}
		mutation.Data.ResultFolderID = snapshot.Task.TargetParentID
		if len(mutation.Data.Folders) > 0 {
			root, exists := folderIDs[snapshot.Data.Name]
			if !exists {
				return mutation, model.ErrInvalid
			}
			mutation.Data.ResultFolderID = root
		}
		mutation.Task.State, mutation.Task.Intent, mutation.Task.FailureCode = model.DownloadQueued, model.DownloadRun, model.DownloadFailureNone
		mutation.Task.DeclaredBytes = &bytes
		mutation.Task.ReceivedBytes, mutation.Task.RateBytesPerSecond = 0, 0
		mutation.Task.LeaseToken, mutation.Task.LeaseUntil = "", nil
		mutation.Task.FinishedAt, mutation.Task.ProgressAt = nil, nil
		mutation.Task.Revision++
		mutation.Task.UpdatedAt = now
		return mutation, nil
	})
	if err != nil {
		return DownloadSummary{}, err
	}
	return s.summary(result), nil
}
