package repo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"gorm.io/gorm"
)

// Torrents 复用同一storage/owner锁和连接租约，元数据、候选与发布没有第二套数据库。
type Torrents struct{ downloads *Downloads }

var _ service.TorrentRepository = (*Torrents)(nil)

func NewTorrents(downloads *Downloads) (*Torrents, error) {
	if downloads == nil {
		return nil, model.ErrInvalid
	}
	return &Torrents{downloads: downloads}, nil
}

func (r *Torrents) facts(db *gorm.DB, task model.DownloadTask, data service.TorrentData) (service.TorrentSnapshot, error) {
	result := service.TorrentSnapshot{Task: task, Data: data, Bindings: []service.TorrentBinding{}, Transfers: []model.Transfer{}}
	var err error
	result.Entries, result.MetadataLimited, err = downloadEntrySnapshot(db, task.OwnerID, r.downloads.transfers.metadataEntries)
	if err != nil {
		return result, err
	}
	result.HistoryPreferences, err = loadHistoryPreferences(db, task.OwnerID)
	if err != nil {
		return result, err
	}
	reservations, err := loadTransferReservations(db, task.OwnerID)
	if err != nil {
		return result, err
	}
	result.OwnerReservedBytes, result.OwnerReservedCount = reservations.OwnerBytes, reservations.OwnerCount
	result.GlobalReservedBytes, result.GlobalReservedCount = reservations.GlobalBytes, reservations.GlobalCount
	var metadata struct{ OwnerBytes, GlobalBytes int64 }
	if err := db.Model(&torrentTaskRecord{}).Select("COALESCE(SUM(CASE WHEN owner_id = ? THEN metadata_bytes ELSE 0 END),0) AS owner_bytes, COALESCE(SUM(metadata_bytes),0) AS global_bytes", task.OwnerID).Scan(&metadata).Error; err != nil {
		return result, err
	}
	result.OwnerMetadataBytes, result.GlobalMetadataBytes = metadata.OwnerBytes, metadata.GlobalBytes
	var node struct {
		ReservedBytes int64
		ActiveTasks   int
	}
	if err := db.Model(&torrentJobRecord{}).Select("COALESCE(SUM(reserved_bytes),0) AS reserved_bytes, COUNT(DISTINCT CASE WHEN stopped = ? THEN task_id ELSE NULL END) AS active_tasks", false).Where("node_id = ? AND cleaned = ?", data.NodeID, false).Scan(&node).Error; err != nil {
		return result, err
	}
	result.NodeReservedBytes, result.NodeActiveTasks = node.ReservedBytes, node.ActiveTasks
	var sameHash int64
	if err := db.Model(&torrentJobRecord{}).Joins("JOIN files_torrent_tasks ON files_torrent_tasks.task_id = files_torrent_jobs.task_id AND files_torrent_tasks.owner_id = files_torrent_jobs.owner_id").Where("files_torrent_jobs.node_id = ? AND files_torrent_tasks.info_hash = ? AND cleaned = ? AND stopped = ?", data.NodeID, data.InfoHash, false, false).Distinct("files_torrent_jobs.task_id").Count(&sameHash).Error; err != nil {
		return result, err
	}
	result.NodeHashActiveTasks = int(sameHash)
	var tasks struct{ OwnerRecords, GlobalRecords, ActiveTasks int }
	if err := db.Model(&downloadRecord{}).Select("COALESCE(SUM(CASE WHEN owner_id = ? THEN 1 ELSE 0 END),0) AS owner_records, COUNT(*) AS global_records, COALESCE(SUM(CASE WHEN lease_until > ? OR EXISTS (SELECT 1 FROM files_torrent_jobs WHERE files_torrent_jobs.task_id = files_download_tasks.id AND files_torrent_jobs.owner_id = files_download_tasks.owner_id AND cleaned = ? AND stopped = ?) THEN 1 ELSE 0 END),0) AS active_tasks", task.OwnerID, r.downloads.transfers.clock.Now().UTC(), false, false).Scan(&tasks).Error; err != nil {
		return result, err
	}
	result.OwnerDownloadRecords, result.GlobalDownloadRecords, result.GlobalActiveTasks = tasks.OwnerRecords, tasks.GlobalRecords, tasks.ActiveTasks
	return result, nil
}

func (r *Torrents) snapshot(db *gorm.DB, owner, id string) (service.TorrentSnapshot, error) {
	task, err := readDownloadTask(db, owner, id)
	if err != nil {
		return service.TorrentSnapshot{}, err
	}
	if task.Kind != model.DownloadBitTorrent {
		return service.TorrentSnapshot{}, model.ErrInvalid
	}
	var record torrentTaskRecord
	if err := db.Where("owner_id = ? AND task_id = ?", owner, id).First(&record).Error; err != nil {
		return service.TorrentSnapshot{}, err
	}
	data := service.TorrentData{TaskID: id, NodeID: record.NodeID, InfoHash: record.InfoHash, Name: record.Name, Metadata: record.Metadata, TotalBytes: record.TotalBytes, ResultFolderID: record.ResultFolderID, Files: []service.TorrentSelectionFile{}, Folders: []service.TorrentFolder{}}
	var files []torrentFileRecord
	if err := db.Where("owner_id = ? AND task_id = ?", owner, id).Order("file_index ASC").Limit(service.MaxTorrentFiles + 1).Find(&files).Error; err != nil {
		return service.TorrentSnapshot{}, err
	}
	for _, file := range files {
		data.Files = append(data.Files, service.TorrentSelectionFile{TorrentFile: service.TorrentFile{Index: file.FileIndex, Path: file.RelativePath, SizeBytes: file.SizeBytes}, Selected: file.Selected, TransferID: file.TransferID})
	}
	var folders []torrentFolderRecord
	if err := db.Where("owner_id = ? AND task_id = ?", owner, id).Order("relative_path ASC").Limit(service.MaxTorrentFiles*service.MaxTorrentPathSegments + 1).Find(&folders).Error; err != nil {
		return service.TorrentSnapshot{}, err
	}
	for _, folder := range folders {
		data.Folders = append(data.Folders, service.TorrentFolder{Path: folder.RelativePath, EntryID: folder.EntryID, ParentID: folder.ParentID, Name: folder.Name})
	}
	if err := validateTorrentData(task, data); err != nil {
		return service.TorrentSnapshot{}, err
	}
	chargedBytes, err := torrentMetadataBytes(data)
	if err != nil {
		return service.TorrentSnapshot{}, err
	}
	if chargedBytes != record.MetadataBytes {
		return service.TorrentSnapshot{}, fmt.Errorf("torrent metadata length invariant")
	}
	result, err := r.facts(db, task, data)
	if err != nil {
		return result, err
	}
	result.Transfers, err = downloadChildrenForKind(db, owner, id, model.DownloadBitTorrent)
	if err != nil {
		return result, err
	}
	var jobs []torrentJobRecord
	if err := db.Where("owner_id = ? AND task_id = ?", owner, id).Order("created_at ASC").Order("gid ASC").Limit(service.MaxTorrentBindings + 1).Find(&jobs).Error; err != nil {
		return result, err
	}
	if len(jobs) > service.MaxTorrentBindings {
		return result, model.ErrTooLarge
	}
	for _, job := range jobs {
		binding := job.model()
		if err := validateTorrentBinding(task, data, binding); err != nil {
			return result, err
		}
		result.Bindings = append(result.Bindings, binding)
	}
	if err := validateTorrentChildren(task, data, result.Transfers); err != nil {
		return result, err
	}
	return result, nil
}

func (r *Torrents) ReadTorrent(ctx context.Context, owner, id string) (service.TorrentSnapshot, error) {
	if owner == "" || model.ValidateTransferID(id) != nil {
		return service.TorrentSnapshot{}, model.ErrInvalid
	}
	var result service.TorrentSnapshot
	err := r.downloads.use(ctx, func(db *gorm.DB) error { var err error; result, err = r.snapshot(db, owner, id); return err })
	return result, err
}

func (r *Torrents) CreateTorrent(ctx context.Context, task model.DownloadTask, data service.TorrentData, admit func(service.TorrentSnapshot) error) (service.TorrentSnapshot, error) {
	if err := model.ValidateDownloadTask(task); err != nil {
		return service.TorrentSnapshot{}, err
	}
	if err := validateTorrentData(task, data); err != nil {
		return service.TorrentSnapshot{}, err
	}
	if admit == nil {
		return service.TorrentSnapshot{}, model.ErrInvalid
	}
	var result service.TorrentSnapshot
	err := r.downloads.transaction(ctx, task.OwnerID, func(db *gorm.DB) error {
		var previous downloadRecord
		err := db.Where("owner_id = ? AND client_key = ?", task.OwnerID, task.ClientKey).First(&previous).Error
		if err == nil {
			if previous.Kind != task.Kind || previous.SourceURI != task.SourceURI || previous.TargetParentID != task.TargetParentID || previous.RequestedName != task.RequestedName {
				return model.ErrConflict
			}
			result, err = r.snapshot(db, task.OwnerID, previous.ID)
			if err != nil {
				return err
			}
			if result.Data.NodeID != data.NodeID || result.Data.InfoHash != data.InfoHash {
				return model.ErrConflict
			}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		facts, err := r.facts(db, task, data)
		if err != nil {
			return err
		}
		chargedBytes, err := torrentMetadataBytes(data)
		if err != nil {
			return err
		}
		if chargedBytes > service.MaxTorrentOwnerMetadataBytes-facts.OwnerMetadataBytes || chargedBytes > service.MaxTorrentGlobalMetadataBytes-facts.GlobalMetadataBytes {
			return model.ErrDownloadMetadataLimited
		}
		if err := admit(facts); err != nil {
			return err
		}
		record := downloadRecord(task)
		if err := db.Create(&record).Error; err != nil {
			return err
		}
		if err := saveTorrentData(db, task, data); err != nil {
			return err
		}
		result, err = r.snapshot(db, task.OwnerID, task.ID)
		return err
	})
	return result, err
}

func (r *Torrents) ChangeTorrent(ctx context.Context, owner, id string, change func(service.TorrentSnapshot) (service.TorrentMutation, error)) (service.TorrentSnapshot, error) {
	if owner == "" || model.ValidateTransferID(id) != nil || change == nil {
		return service.TorrentSnapshot{}, model.ErrInvalid
	}
	var result service.TorrentSnapshot
	err := r.downloads.transaction(ctx, owner, func(db *gorm.DB) error {
		previous, err := r.snapshot(db, owner, id)
		if err != nil {
			return err
		}
		input := previous
		input.Data.Metadata = append([]byte(nil), previous.Data.Metadata...)
		input.Data.Files = append([]service.TorrentSelectionFile(nil), previous.Data.Files...)
		input.Data.Folders = append([]service.TorrentFolder(nil), previous.Data.Folders...)
		input.Bindings = append([]service.TorrentBinding(nil), previous.Bindings...)
		input.Transfers = append([]model.Transfer(nil), previous.Transfers...)
		mutation, err := change(input)
		if err != nil {
			return err
		}
		if err := r.saveMutation(db, previous, mutation); err != nil {
			return err
		}
		if mutation.Delete {
			result = previous
			return nil
		}
		result, err = r.snapshot(db, owner, id)
		return err
	})
	return result, err
}

func (r *Torrents) NextTorrent(ctx context.Context, now time.Time, maxAttempts, nodeConcurrency int) (service.DownloadCandidate, bool, error) {
	if maxAttempts < 1 || maxAttempts > model.MaxDownloadAttempts || nodeConcurrency < 1 || nodeConcurrency > service.MaxDownloadConcurrency {
		return service.DownloadCandidate{}, false, model.ErrInvalid
	}
	var record downloadRecord
	err := r.downloads.use(ctx, func(db *gorm.DB) error {
		return db.Model(&downloadRecord{}).Select("files_download_tasks.*").Joins("JOIN files_torrent_tasks ON files_torrent_tasks.task_id = files_download_tasks.id AND files_torrent_tasks.owner_id = files_download_tasks.owner_id").Where("kind = ? AND (lease_until IS NULL OR lease_until <= ?)", model.DownloadBitTorrent, now).
			Where("(state NOT IN ? OR intent <> ? OR NOT EXISTS (SELECT 1 FROM files_torrent_jobs AS other_job JOIN files_torrent_tasks AS other_torrent ON other_torrent.task_id = other_job.task_id AND other_torrent.owner_id = other_job.owner_id WHERE other_job.node_id = files_torrent_tasks.node_id AND other_torrent.info_hash = files_torrent_tasks.info_hash AND other_job.task_id <> files_download_tasks.id AND other_job.cleaned = ? AND other_job.stopped = ?))", []model.DownloadState{model.DownloadQueued, model.DownloadResolving, model.DownloadFetching, model.DownloadPublishing}, model.DownloadRun, false, false).
			Where("(state NOT IN ? OR intent <> ? OR (SELECT COUNT(DISTINCT task_id) FROM files_torrent_jobs WHERE files_torrent_jobs.node_id = files_torrent_tasks.node_id AND cleaned = ? AND stopped = ?) < ? OR EXISTS (SELECT 1 FROM files_torrent_jobs WHERE files_torrent_jobs.task_id = files_download_tasks.id AND files_torrent_jobs.owner_id = files_download_tasks.owner_id AND cleaned = ? AND stopped = ?))", []model.DownloadState{model.DownloadQueued, model.DownloadResolving, model.DownloadFetching, model.DownloadPublishing}, model.DownloadRun, false, false, nodeConcurrency, false, false).
			Where("((intent = ? AND state IN ?) OR (attempts < ? AND ((intent = ? AND state = ?) OR (intent = ? AND state NOT IN ?) OR (expires_at <= ? AND state NOT IN ?) OR EXISTS (SELECT 1 FROM files_torrent_jobs WHERE files_torrent_jobs.task_id = files_download_tasks.id AND files_torrent_jobs.owner_id = files_download_tasks.owner_id AND cleaned = ? AND (stopped = ? OR files_download_tasks.state IN ? OR (files_download_tasks.state = ? AND phase = ?))))))", model.DownloadRun, []model.DownloadState{model.DownloadQueued, model.DownloadResolving, model.DownloadFetching, model.DownloadPublishing}, maxAttempts, model.DownloadPause, model.DownloadPausing, model.DownloadCancel, []model.DownloadState{model.DownloadCompleted, model.DownloadCanceled, model.DownloadExpired}, now, []model.DownloadState{model.DownloadCompleted, model.DownloadCanceled, model.DownloadExpired}, false, false, []model.DownloadState{model.DownloadCompleted, model.DownloadCanceled, model.DownloadExpired}, model.DownloadSelecting, service.TorrentJobMetadata).
			Order("files_download_tasks.updated_at ASC").Order("files_download_tasks.id ASC").First(&record).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return service.DownloadCandidate{}, false, nil
	}
	if err != nil {
		return service.DownloadCandidate{}, false, err
	}
	return service.DownloadCandidate{ID: record.ID, OwnerID: record.OwnerID}, true, nil
}
