package repo

import (
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"gorm.io/gorm"
)

type transferReservations struct {
	OwnerBytes  int64
	OwnerCount  int64
	GlobalBytes int64
	GlobalCount int64
}

// loadTransferReservations 对offline按DownloadID计并发组，字节仍逐文件求和。
// NULLIF和CASE在三个受支持驱动上语义一致，不把无界历史加载到业务内存。
func loadTransferReservations(db *gorm.DB, owner string) (transferReservations, error) {
	type ownerReservation struct {
		OwnerID                  string
		Bytes, QuotaBytes, Count int64
	}
	var owners []ownerReservation
	query := "owner_id, SUM(size_bytes) AS bytes, SUM(quota_reserved_bytes) AS quota_bytes, COUNT(DISTINCT NULLIF(download_id, '')) + COUNT(CASE WHEN download_id = '' THEN 1 ELSE NULL END) AS count"
	if err := db.Model(&transferRecord{}).Select(query).Where("state NOT IN ? OR cleanup_pending = ?", []model.TransferState{model.TransferCompleted, model.TransferCanceled, model.TransferExpired}, true).Group("owner_id").Scan(&owners).Error; err != nil {
		return transferReservations{}, err
	}
	var result transferReservations
	for _, reservation := range owners {
		if reservation.Bytes < 0 || reservation.QuotaBytes < 0 || reservation.Count < 0 {
			return transferReservations{}, fmt.Errorf("transfer reservation invariant")
		}
		result.GlobalBytes += reservation.Bytes
		result.GlobalCount += reservation.Count
		if reservation.OwnerID == owner {
			result.OwnerBytes, result.OwnerCount = reservation.QuotaBytes, reservation.Count
		}
	}
	// 元数据和待选择阶段还没有Transfer，仍占一个逻辑任务名额。
	// 已终结但留有node清理债务的任务继续保留该名额。
	var pending []struct {
		OwnerID string
		Count   int64
	}
	if err := db.Model(&downloadRecord{}).Select("owner_id, COUNT(*) AS count").Where("kind = ?", model.DownloadBitTorrent).
		Where("NOT EXISTS (SELECT 1 FROM files_transfers WHERE files_transfers.download_id = files_download_tasks.id AND files_transfers.owner_id = files_download_tasks.owner_id)").
		Where("(state NOT IN ? OR EXISTS (SELECT 1 FROM files_torrent_jobs WHERE files_torrent_jobs.task_id = files_download_tasks.id AND files_torrent_jobs.owner_id = files_download_tasks.owner_id AND cleaned = ?))", []model.DownloadState{model.DownloadCompleted, model.DownloadCanceled, model.DownloadExpired}, false).
		Group("owner_id").Scan(&pending).Error; err != nil {
		return transferReservations{}, err
	}
	for _, reservation := range pending {
		if reservation.Count < 0 {
			return transferReservations{}, fmt.Errorf("torrent reservation invariant")
		}
		result.GlobalCount += reservation.Count
		if reservation.OwnerID == owner {
			result.OwnerCount += reservation.Count
		}
	}
	return result, nil
}
