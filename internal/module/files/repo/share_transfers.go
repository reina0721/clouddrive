package repo

import (
	"context"
	"errors"
	"fmt"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"gorm.io/gorm"
)

func loadTransferShare(db *gorm.DB, snapshot *service.TransferSnapshot, owner, id, grantDigest string) error {
	var record shareRecord
	if err := db.First(&record, "id = ? AND owner_id = ?", id, owner).Error; err != nil {
		return err
	}
	share, decodeErr := record.model()
	if decodeErr != nil {
		return decodeErr
	}
	if !validShareRecord(share) {
		return fmt.Errorf("share policy invariant")
	}
	snapshot.Share = &share
	if grantDigest != "" {
		var record grantRecord
		err := db.First(&record, "digest = ? AND share_id = ?", grantDigest, id).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err == nil {
			grant := model.ShareGrant(record)
			snapshot.ShareGrant = &grant
		}
	}
	return nil
}
func (r *Transfers) ChangeShareTransfer(ctx context.Context, owner, key string, access service.ShareAccess, change func(service.TransferSnapshot) (model.Transfer, *model.Entry, error)) (model.Transfer, error) {
	if access.ShareID == "" || access.ShareRevision < 1 || access.Action != service.ShareActionUpload {
		return model.Transfer{}, model.ErrInvalid
	}
	return r.changeTransfer(ctx, owner, "", key, nil, &access, change)
}
