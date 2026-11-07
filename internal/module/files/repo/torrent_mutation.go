package repo

import (
	"bytes"
	"fmt"
	"path"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func validateTorrentChildren(task model.DownloadTask, data service.TorrentData, children []model.Transfer) error {
	selected := map[string]service.TorrentSelectionFile{}
	folders := map[string]service.TorrentFolder{}
	for _, folder := range data.Folders {
		folders[folder.Path] = folder
	}
	for _, file := range data.Files {
		if file.TransferID != "" {
			if _, duplicate := selected[file.TransferID]; duplicate {
				return model.ErrInvalid
			}
			selected[file.TransferID] = file
		}
	}
	if len(selected) != len(children) {
		return fmt.Errorf("torrent child cardinality invariant")
	}
	for _, child := range children {
		file, exists := selected[child.ID]
		parent := task.TargetParentID
		if directory := path.Dir(file.Path); directory != "." {
			folder, found := folders[directory]
			if !found {
				return model.ErrInvalid
			}
			parent = folder.EntryID
		}
		name := path.Base(file.Path)
		if len(data.Files) == 1 && path.Dir(file.Path) == "." && task.RequestedName != "" {
			name = task.RequestedName
		}
		if !exists || !file.Selected || child.OwnerID != task.OwnerID || child.DownloadID != task.ID || child.Source != model.TransferSourceOffline || model.ValidateTransferID(child.ID) != nil || child.ParentID != parent || child.Name != name || child.NormalizedName == "" || child.SizeBytes != file.SizeBytes || !child.SizeKnown || child.QuotaReservedBytes != file.SizeBytes || !child.State.Valid() || child.Revision < 1 || child.Revision > model.MaxContentRevision || child.ObjectKey != "files/"+child.ID || !child.ExpiresAt.Equal(task.ExpiresAt) || child.CreatedAt.IsZero() || child.UpdatedAt.Before(child.CreatedAt) || child.ExpectedEntryID != "" || child.ConnectionID != "" || child.ShareID != "" || len(child.DAVCondition.Lists) != 0 {
			return fmt.Errorf("torrent child identity invariant")
		}
		if child.ContentSHA256 != "" && !validTorrentHex(child.ContentSHA256, 32) {
			return model.ErrInvalid
		}
	}
	if len(selected) > 0 {
		for _, file := range data.Files {
			if file.Selected && file.TransferID == "" {
				return model.ErrInvalid
			}
		}
		for _, folder := range data.Folders {
			parent := task.TargetParentID
			if directory := path.Dir(folder.Path); directory != "." {
				ancestor, found := folders[directory]
				if !found {
					return model.ErrInvalid
				}
				parent = ancestor.EntryID
			}
			if folder.ParentID != parent {
				return model.ErrInvalid
			}
		}
	} else if len(data.Folders) > 0 {
		return model.ErrInvalid
	}
	return nil
}

func saveTorrentData(db *gorm.DB, task model.DownloadTask, data service.TorrentData) error {
	if err := validateTorrentData(task, data); err != nil {
		return err
	}
	metadataBytes, err := torrentMetadataBytes(data)
	if err != nil {
		return err
	}
	record := torrentTaskRecord{TaskID: task.ID, OwnerID: task.OwnerID, NodeID: data.NodeID, InfoHash: data.InfoHash, Name: data.Name, Metadata: append([]byte{}, data.Metadata...), MetadataBytes: metadataBytes, TotalBytes: data.TotalBytes, ResultFolderID: data.ResultFolderID}
	if err := db.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "task_id"}}, DoUpdates: clause.AssignmentColumns([]string{"info_hash", "name", "metadata", "metadata_bytes", "total_bytes", "result_folder_id"})}).Create(&record).Error; err != nil {
		return err
	}
	for _, file := range data.Files {
		record := torrentFileRecord{TaskID: task.ID, OwnerID: task.OwnerID, FileIndex: file.Index, RelativePath: file.Path, SizeBytes: file.SizeBytes, Selected: file.Selected, TransferID: file.TransferID}
		if err := db.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "task_id"}, {Name: "file_index"}}, DoUpdates: clause.AssignmentColumns([]string{"selected", "transfer_id"})}).Create(&record).Error; err != nil {
			return err
		}
	}
	for _, folder := range data.Folders {
		record := torrentFolderRecord{TaskID: task.ID, OwnerID: task.OwnerID, EntryID: folder.EntryID, RelativePath: folder.Path, ParentID: folder.ParentID, Name: folder.Name}
		if err := db.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "task_id"}, {Name: "entry_id"}}, DoUpdates: clause.AssignmentColumns([]string{"parent_id", "name"})}).Create(&record).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *Torrents) saveMutation(db *gorm.DB, previous service.TorrentSnapshot, mutation service.TorrentMutation) error {
	task, data := mutation.Task, mutation.Data
	if task.ID != previous.Task.ID || task.OwnerID != previous.Task.OwnerID || task.Kind != previous.Task.Kind {
		return model.ErrInvalid
	}
	if err := validateTorrentData(task, data); err != nil {
		return err
	}
	if data.NodeID != previous.Data.NodeID {
		return model.ErrInvalid
	}
	if mutation.Claim != nil {
		claim := *mutation.Claim
		if claim.TaskID != previous.Task.ID || claim.OwnerID != previous.Task.OwnerID || claim.Token != previous.Task.LeaseToken || !previous.Task.LeaseValid(r.downloads.transfers.clock.Now().UTC()) {
			return model.ErrDownloadLeaseLost
		}
	}
	if previous.Data.InfoHash != "" && data.InfoHash != previous.Data.InfoHash || previous.Data.Name != "" && data.Name != previous.Data.Name || len(previous.Data.Metadata) > 0 && !bytes.Equal(previous.Data.Metadata, data.Metadata) && !((task.State == model.DownloadCompleted || task.State == model.DownloadCanceled || task.State == model.DownloadExpired) && len(data.Metadata) == 0) {
		return fmt.Errorf("torrent metadata immutable invariant")
	}
	if len(previous.Data.Files) > 0 {
		if len(previous.Data.Files) != len(data.Files) {
			return model.ErrInvalid
		}
		for index, file := range previous.Data.Files {
			updated := data.Files[index]
			if file.TorrentFile != updated.TorrentFile || file.TransferID != "" && (file.TransferID != updated.TransferID || file.Selected != updated.Selected) {
				return fmt.Errorf("torrent file immutable invariant")
			}
		}
	}
	if len(previous.Data.Folders) > 0 {
		if len(previous.Data.Folders) != len(data.Folders) {
			return model.ErrInvalid
		}
		known := map[string]service.TorrentFolder{}
		for _, folder := range previous.Data.Folders {
			known[folder.EntryID] = folder
		}
		for _, folder := range data.Folders {
			before, exists := known[folder.EntryID]
			if !exists || before.Path != folder.Path || path.Dir(folder.Path) != "." && before != folder {
				return model.ErrInvalid
			}
		}
	}
	if err := validateTorrentChildren(task, data, mutation.Transfers); err != nil {
		return err
	}
	if len(mutation.Bindings) > service.MaxTorrentBindings {
		return model.ErrTooLarge
	}
	knownBindings := map[string]service.TorrentBinding{}
	for _, binding := range previous.Bindings {
		knownBindings[binding.GID] = binding
	}
	seenBindings := map[string]bool{}
	for _, binding := range mutation.Bindings {
		if err := validateTorrentBinding(task, data, binding); err != nil {
			return err
		}
		if seenBindings[binding.GID] {
			return model.ErrInvalid
		}
		seenBindings[binding.GID] = true
		before, exists := knownBindings[binding.GID]
		if exists {
			identityBefore, identityAfter := before, binding
			identityBefore.Submitted, identityAfter.Submitted = false, false
			identityBefore.Accepted, identityBefore.Stopped, identityBefore.Cleaned = false, false, false
			identityAfter.Accepted, identityAfter.Stopped, identityAfter.Cleaned = false, false, false
			if identityBefore != identityAfter || before.Submitted && !binding.Submitted || before.Accepted && !binding.Accepted || before.Stopped && !binding.Stopped || before.Cleaned && !binding.Cleaned {
				return fmt.Errorf("torrent job immutable invariant")
			}
			if (before.Submitted != binding.Submitted || before.Accepted != binding.Accepted || before.Stopped != binding.Stopped || before.Cleaned != binding.Cleaned) && mutation.Claim == nil {
				return model.ErrDownloadLeaseLost
			}
			if !before.Submitted && binding.Submitted && binding.ClaimToken != previous.Task.LeaseToken {
				return model.ErrDownloadLeaseLost
			}
			if before.Stopped && !before.Submitted && binding.Submitted {
				return model.ErrConflict
			}
			if before.Stopped && !before.Accepted && binding.Accepted {
				return model.ErrConflict
			}
		} else if mutation.Claim == nil || binding.ClaimToken != task.LeaseToken || !task.LeaseValid(r.downloads.transfers.clock.Now().UTC()) {
			return model.ErrDownloadLeaseLost
		}
	}
	for gid := range knownBindings {
		if !seenBindings[gid] {
			return fmt.Errorf("torrent cleanup ledger cannot be discarded")
		}
	}
	if mutation.Delete {
		if !previous.Task.State.Finished() || previous.Task.LeaseValid(r.downloads.transfers.clock.Now().UTC()) {
			return model.ErrConflict
		}
		for _, binding := range previous.Bindings {
			if !binding.Cleaned {
				return model.ErrConflict
			}
		}
		for _, child := range previous.Transfers {
			if !child.Terminal() || child.CleanupPending {
				return model.ErrConflict
			}
		}
		for _, record := range []any{&torrentJobRecord{}, &torrentFolderRecord{}, &torrentFileRecord{}, &torrentTaskRecord{}} {
			if err := db.Where("owner_id = ? AND task_id = ?", task.OwnerID, task.ID).Delete(record).Error; err != nil {
				return err
			}
		}
		if err := db.Where("owner_id = ? AND download_id = ?", task.OwnerID, task.ID).Delete(&transferRecord{}).Error; err != nil {
			return err
		}
		return db.Where("owner_id = ? AND id = ?", task.OwnerID, task.ID).Delete(&downloadRecord{}).Error
	}
	beforeBytes, err := torrentMetadataBytes(previous.Data)
	if err != nil {
		return err
	}
	afterBytes, err := torrentMetadataBytes(data)
	if err != nil {
		return err
	}
	if growth := afterBytes - beforeBytes; growth > 0 && (growth > service.MaxTorrentOwnerMetadataBytes-previous.OwnerMetadataBytes || growth > service.MaxTorrentGlobalMetadataBytes-previous.GlobalMetadataBytes) {
		return model.ErrDownloadMetadataLimited
	}
	if err := saveDownloadChanges(db, previous.Task, task); err != nil {
		return err
	}
	if err := saveTorrentData(db, task, data); err != nil {
		return err
	}
	knownChildren := map[string]model.Transfer{}
	for _, child := range previous.Transfers {
		knownChildren[child.ID] = child
	}
	for _, child := range mutation.Transfers {
		if before, exists := knownChildren[child.ID]; exists {
			if before.Source != child.Source || before.DownloadID != child.DownloadID || before.OwnerID != child.OwnerID || before.SizeBytes != child.SizeBytes || before.ObjectKey != child.ObjectKey || before.IdempotencyKey != child.IdempotencyKey || !before.CreatedAt.Equal(child.CreatedAt) || child.Revision < before.Revision || child.Revision > before.Revision+1 {
				return model.ErrConflict
			}
			if before.Terminal() && (before.State != child.State || before.EntryID != child.EntryID || before.ContentSHA256 != child.ContentSHA256 || before.ParentID != child.ParentID || before.Name != child.Name || before.NormalizedName != child.NormalizedName || !before.CleanupPending && child.CleanupPending) {
				return model.ErrConflict
			}
		}
		record, err := transferRecordFromModel(child)
		if err != nil {
			return err
		}
		if _, exists := knownChildren[child.ID]; exists {
			if err := db.Model(&transferRecord{}).Where("owner_id = ? AND id = ?", task.OwnerID, child.ID).Select("*").Updates(&record).Error; err != nil {
				return err
			}
		} else if err := db.Create(&record).Error; err != nil {
			return err
		}
		delete(knownChildren, child.ID)
	}
	if len(knownChildren) != 0 {
		return fmt.Errorf("torrent child cannot be discarded")
	}
	for _, binding := range mutation.Bindings {
		record := torrentJobFromModel(binding)
		if _, exists := knownBindings[binding.GID]; exists {
			if err := db.Model(&torrentJobRecord{}).Where("owner_id = ? AND task_id = ? AND gid = ?", task.OwnerID, task.ID, binding.GID).Select("submitted", "accepted", "stopped", "cleaned").Updates(&record).Error; err != nil {
				return err
			}
		} else if err := db.Create(&record).Error; err != nil {
			return err
		}
	}
	if len(mutation.Entries) > 0 {
		if mutation.Claim == nil || previous.Task.Intent != model.DownloadRun {
			return model.ErrDownloadLeaseLost
		}
		if previous.MetadataLimited {
			return model.ErrDownloadMetadataLimited
		}
		if task.State != model.DownloadCompleted || previous.Task.State == model.DownloadCompleted || len(mutation.Entries) != len(data.Folders)+len(mutation.Transfers) {
			return model.ErrInvalid
		}
		for _, entry := range mutation.Entries {
			if _, exists := model.Find(previous.Entries, entry.ID); exists {
				return model.ErrConflict
			}
		}
		if err := validateTorrentEntries(data, mutation.Transfers, mutation.Entries); err != nil {
			return err
		}
		return r.downloads.transfers.Repository.saveEntryChanges(db, task.OwnerID, previous.Entries, mutation.Entries, model.FileWriteAuthority{})
	}
	if task.State == model.DownloadCompleted && previous.Task.State != model.DownloadCompleted {
		return model.ErrInvalid
	}
	return nil
}

func validateTorrentEntries(data service.TorrentData, children []model.Transfer, entries []model.Entry) error {
	byID := map[string]model.Entry{}
	for _, entry := range entries {
		if _, exists := byID[entry.ID]; exists {
			return model.ErrInvalid
		}
		byID[entry.ID] = entry
	}
	for _, folder := range data.Folders {
		entry, exists := byID[folder.EntryID]
		if !exists || entry.Kind != model.Folder || entry.Name != folder.Name || entry.ParentID != folder.ParentID || entry.SizeBytes != 0 {
			return model.ErrInvalid
		}
	}
	for _, child := range children {
		entry, exists := byID[child.EntryID]
		if !exists || child.State != model.TransferCompleted || child.EntryID != child.ID || entry.Kind != model.File || entry.Name != child.Name || entry.NormalizedName != child.NormalizedName || entry.ParentID != child.ParentID || entry.SizeBytes != child.SizeBytes || entry.ObjectKey != child.ObjectKey || entry.ContentSHA != child.ContentSHA256 || child.ContentSHA256 == "" {
			return model.ErrInvalid
		}
	}
	return nil
}
