package repo

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"path"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
)

type torrentTaskRecord struct {
	TaskID         string `gorm:"primaryKey"`
	OwnerID        string
	NodeID         string
	InfoHash       string
	Name           string
	Metadata       []byte
	MetadataBytes  int64
	TotalBytes     int64
	ResultFolderID string
}

func (torrentTaskRecord) TableName() string { return "files_torrent_tasks" }

type torrentFileRecord struct {
	TaskID       string `gorm:"primaryKey"`
	OwnerID      string
	FileIndex    int `gorm:"primaryKey"`
	RelativePath string
	SizeBytes    int64
	Selected     bool
	TransferID   string
}

func (torrentFileRecord) TableName() string { return "files_torrent_files" }

type torrentFolderRecord struct {
	TaskID       string `gorm:"primaryKey"`
	OwnerID      string
	EntryID      string `gorm:"primaryKey"`
	RelativePath string
	ParentID     string
	Name         string
}

func (torrentFolderRecord) TableName() string { return "files_torrent_folders" }

// torrentMetadataBytes 同时计入保留清单，完成后清除原始种子也不能绕过元数据预算。
func torrentMetadataBytes(data service.TorrentData) (int64, error) {
	// 固定预算DTO避免业务结构未来增字段时意外改变已持久化的计量语义。
	type budgetFile struct {
		Index      int    `json:"index"`
		Path       string `json:"path"`
		SizeBytes  int64  `json:"sizeBytes"`
		Selected   bool   `json:"selected"`
		TransferID string `json:"transferId"`
	}
	type budgetFolder struct {
		Path     string `json:"path"`
		EntryID  string `json:"entryId"`
		ParentID string `json:"parentId"`
		Name     string `json:"name"`
	}
	manifest := struct {
		Files   []budgetFile   `json:"files"`
		Folders []budgetFolder `json:"folders"`
	}{Files: []budgetFile{}, Folders: []budgetFolder{}}
	for _, file := range data.Files {
		manifest.Files = append(manifest.Files, budgetFile{Index: file.Index, Path: file.Path, SizeBytes: file.SizeBytes, Selected: file.Selected, TransferID: file.TransferID})
	}
	for _, folder := range data.Folders {
		manifest.Folders = append(manifest.Folders, budgetFolder{Path: folder.Path, EntryID: folder.EntryID, ParentID: folder.ParentID, Name: folder.Name})
	}
	encoded, err := json.Marshal(manifest)
	if err != nil {
		return 0, fmt.Errorf("encode torrent manifest budget: %w", err)
	}
	if len(encoded) > service.MaxTorrentMetadataBytes {
		return 0, model.ErrTooLarge
	}
	return int64(len(encoded) + len(data.Metadata)), nil
}

// torrentJobRecord 独立定义ORM字段，不能让嵌套业务对象被GORM猜测成关联。
type torrentJobRecord struct {
	GID               string `gorm:"column:gid;primaryKey"`
	TaskID            string
	OwnerID           string
	NodeID            string
	ClaimToken        string
	Phase             service.TorrentJobPhase
	WorkspaceIdentity string
	NodeSessionID     string
	ReservedBytes     int64
	Submitted         bool
	Accepted          bool
	Stopped           bool
	Cleaned           bool
	CreatedAt         time.Time
}

func (torrentJobRecord) TableName() string { return "files_torrent_jobs" }

func torrentJobFromModel(binding service.TorrentBinding) torrentJobRecord {
	return torrentJobRecord{GID: binding.GID, TaskID: binding.TaskID, OwnerID: binding.OwnerID, NodeID: binding.NodeID, ClaimToken: binding.ClaimToken, Phase: binding.Phase, WorkspaceIdentity: binding.WorkspaceIdentity, NodeSessionID: binding.NodeSessionID, ReservedBytes: binding.ReservedBytes, Submitted: binding.Submitted, Accepted: binding.Accepted, Stopped: binding.Stopped, Cleaned: binding.Cleaned, CreatedAt: binding.CreatedAt}
}
func (record torrentJobRecord) model() service.TorrentBinding {
	return service.TorrentBinding{GID: record.GID, TaskID: record.TaskID, OwnerID: record.OwnerID, NodeID: record.NodeID, ClaimToken: record.ClaimToken, Phase: record.Phase, WorkspaceIdentity: record.WorkspaceIdentity, NodeSessionID: record.NodeSessionID, ReservedBytes: record.ReservedBytes, Submitted: record.Submitted, Accepted: record.Accepted, Stopped: record.Stopped, Cleaned: record.Cleaned, CreatedAt: record.CreatedAt}
}

func validTorrentHex(raw string, bytes int) bool {
	decoded, err := hex.DecodeString(raw)
	return err == nil && len(decoded) == bytes && strings.ToLower(raw) == raw
}

func validateTorrentData(task model.DownloadTask, data service.TorrentData) error {
	if task.Kind != model.DownloadBitTorrent || data.TaskID != task.ID || data.NodeID == "" || len(data.NodeID) > model.MaxDownloadClientKeyBytes || len(data.Metadata) > service.MaxTorrentMetadataBytes || data.TotalBytes < 0 || data.TotalBytes > model.MaxFileContentBytes || len(data.Files) > service.MaxTorrentFiles {
		return model.ErrInvalid
	}
	if data.InfoHash != "" && !validTorrentHex(data.InfoHash, 20) {
		return model.ErrInvalid
	}
	if data.Name != "" && model.ValidateName(data.Name) != nil {
		return model.ErrInvalid
	}
	if data.ResultFolderID != "" && model.ValidateTransferID(data.ResultFolderID) != nil {
		return model.ErrInvalid
	}
	var total int64
	seen := map[string]bool{}
	for index, file := range data.Files {
		if file.Index != index+1 || file.Path == "." || path.IsAbs(file.Path) || path.Clean(file.Path) != file.Path || strings.Contains(file.Path, "\\") || len(file.Path) > service.MaxTorrentPathBytes || file.SizeBytes < 0 || file.SizeBytes > model.MaxFileContentBytes-total || seen[strings.ToLower(file.Path)] {
			return model.ErrInvalid
		}
		for _, segment := range strings.Split(file.Path, "/") {
			if model.ValidateName(segment) != nil {
				return model.ErrInvalid
			}
		}
		seen[strings.ToLower(file.Path)] = true
		total += file.SizeBytes
		if (file.TransferID != "" && model.ValidateTransferID(file.TransferID) != nil) || file.Selected != (file.TransferID != "") {
			return model.ErrInvalid
		}
	}
	if total != data.TotalBytes || len(data.Metadata) > 0 && len(data.Files) == 0 || len(data.Files) > 0 && (data.InfoHash == "" || data.Name == "" || len(data.Metadata) == 0 && task.State != model.DownloadCompleted && task.State != model.DownloadCanceled && task.State != model.DownloadExpired && task.Intent != model.DownloadCancel) {
		return fmt.Errorf("torrent manifest invariant")
	}
	if len(data.Folders) > service.MaxTorrentFiles*service.MaxTorrentPathSegments {
		return model.ErrTooLarge
	}
	folderIDs := map[string]bool{}
	folderPaths := map[string]bool{}
	for _, folder := range data.Folders {
		if model.ValidateTransferID(folder.EntryID) != nil || folderIDs[folder.EntryID] || folder.ParentID != "" && model.ValidateTransferID(folder.ParentID) != nil || model.ValidateName(folder.Name) != nil || path.Clean(folder.Path) != folder.Path || path.IsAbs(folder.Path) || strings.Contains(folder.Path, "\\") || folderPaths[strings.ToLower(folder.Path)] {
			return model.ErrInvalid
		}
		folderIDs[folder.EntryID], folderPaths[strings.ToLower(folder.Path)] = true, true
	}
	if _, err := torrentMetadataBytes(data); err != nil {
		return err
	}
	return nil
}

func validateTorrentBinding(task model.DownloadTask, data service.TorrentData, binding service.TorrentBinding) error {
	if binding.TaskID != task.ID || binding.OwnerID != task.OwnerID || binding.NodeID != data.NodeID || !validTorrentHex(binding.GID, 8) || binding.GID == strings.Repeat("0", 16) || model.ValidateTransferID(binding.ClaimToken) != nil || !validTorrentHex(binding.WorkspaceIdentity, 32) || len(binding.NodeSessionID) < 16 || len(binding.NodeSessionID) > 128 || binding.ReservedBytes < 0 || binding.ReservedBytes > model.MaxFileContentBytes+service.TorrentPayloadOverheadBytes || binding.CreatedAt.IsZero() || (binding.Phase != service.TorrentJobMetadata && binding.Phase != service.TorrentJobPayload) || binding.Cleaned && !binding.Stopped || binding.Accepted && !binding.Submitted {
		return model.ErrInvalid
	}
	return nil
}
