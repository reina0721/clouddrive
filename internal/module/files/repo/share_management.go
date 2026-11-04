package repo

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

func validShareRecord(share model.Share) bool {
	return share.ID != "" && share.OwnerID != "" && share.RootID != "" && share.Permissions.Valid() && share.Revision >= 1 && share.Revision <= model.MaxContentRevision && (share.State == model.ShareEnabled || share.State == model.SharePaused)
}

func (r *Repository) CreateShare(ctx context.Context, owner string, activeLimit, treeLimit int, now time.Time, create func([]model.Entry) (model.Share, error)) (model.Share, error) {
	var result model.Share
	if owner == "" || activeLimit < 1 || activeLimit > service.DefaultShareActiveLimit || treeLimit < 1 || treeLimit > service.DefaultSearchTreeEntries || create == nil {
		return result, model.ErrInvalid
	}
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			var active int64
			if err := db.Model(&shareRecord{}).Where("owner_id = ? AND revoked_at IS NULL AND expires_at > ?", owner, now).Count(&active).Error; err != nil {
				return err
			}
			if active >= int64(activeLimit) {
				return model.ErrBusy
			}
			entries, err := loadBoundedEntries(db, owner, treeLimit)
			if err != nil {
				return err
			}
			created, err := create(entries)
			if err != nil {
				return err
			}
			if !validShareRecord(created) || created.OwnerID != owner || created.Revision != 1 {
				return fmt.Errorf("share creation invariant")
			}
			record := shareRecord(created)
			if err := db.Create(&record).Error; err != nil {
				return err
			}
			result = created
			return nil
		})
	})
	return result, err
}

func (r *Repository) ReadOwnedShare(ctx context.Context, owner, id string) (model.Share, model.Entry, error) {
	var share model.Share
	var root model.Entry
	if owner == "" || model.ValidateTransferID(id) != nil {
		return share, root, model.ErrMissing
	}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			var record shareRecord
			if err := db.First(&record, "id = ? AND owner_id = ?", id, owner).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			share = model.Share(record)
			if !validShareRecord(share) {
				return fmt.Errorf("share policy invariant")
			}
			var rootRecord entryRecord
			err := db.First(&rootRecord, "id = ? AND owner_id = ?", share.RootID, owner).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			if err != nil {
				return err
			}
			root, err = rootRecord.model()
			return err
		})
	})
	return share, root, err
}

func (r *Repository) ChangeSharePolicy(ctx context.Context, owner, id string, activeLimit int, now time.Time, change func(model.Share) (model.Share, error)) (model.Share, error) {
	var result model.Share
	if owner == "" || model.ValidateTransferID(id) != nil || activeLimit < 1 || activeLimit > service.DefaultShareActiveLimit || change == nil {
		return result, model.ErrInvalid
	}
	err := r.access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
		return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
			if err := r.lockOwner(db, owner); err != nil {
				return err
			}
			var record shareRecord
			if err := db.First(&record, "id = ? AND owner_id = ?", id, owner).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.Join(model.ErrMissing, err)
				}
				return err
			}
			previous := model.Share(record)
			if !validShareRecord(previous) {
				return fmt.Errorf("share policy invariant")
			}
			changed, err := change(previous)
			if err != nil {
				return err
			}
			if !validShareRecord(changed) || changed.ID != previous.ID || changed.OwnerID != owner || changed.RootID != previous.RootID || changed.Token != previous.Token || changed.TokenDigest != previous.TokenDigest || !changed.CreatedAt.Equal(previous.CreatedAt) || changed.Revision < previous.Revision || changed.Revision > previous.Revision+1 {
				return fmt.Errorf("share immutable policy invariant")
			}
			if previous.RevokedAt != nil && (changed.RevokedAt == nil || !changed.RevokedAt.Equal(*previous.RevokedAt)) {
				return fmt.Errorf("share revocation invariant")
			}
			modified := changed.Title != previous.Title || changed.State != previous.State || changed.Permissions != previous.Permissions || changed.PasswordHash != previous.PasswordHash || !changed.ExpiresAt.Equal(previous.ExpiresAt) || (changed.RevokedAt != nil) != (previous.RevokedAt != nil)
			if modified && changed.Revision != previous.Revision+1 {
				return fmt.Errorf("share revision invariant")
			}
			if changed.RevokedAt == nil && changed.ExpiresAt.After(now) && !(previous.RevokedAt == nil && previous.ExpiresAt.After(now)) {
				var active int64
				if err := db.Model(&shareRecord{}).Where("owner_id = ? AND id <> ? AND revoked_at IS NULL AND expires_at > ?", owner, id, now).Count(&active).Error; err != nil {
					return err
				}
				if active >= int64(activeLimit) {
					return model.ErrBusy
				}
			}
			updated := shareRecord(changed)
			if err := db.Model(&shareRecord{}).Where("id = ? AND owner_id = ? AND revision = ?", id, owner, previous.Revision).Select("title", "state", "permissions", "revision", "password_hash", "expires_at", "revoked_at").Updates(&updated).Error; err != nil {
				return err
			}
			result = changed
			return nil
		})
	})
	return result, err
}

func (r *Repository) QueryShares(ctx context.Context, owner string, query service.ShareQuery, now time.Time) (service.ShareRecordPage, error) {
	result := service.ShareRecordPage{Items: []model.Share{}, Roots: []model.Entry{}}
	if owner == "" || query.Page < 1 || query.Page > 100000 {
		return result, model.ErrInvalid
	}
	err := r.access.Use(ctx, func(client database.Client) error {
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			if err := r.checkStorage(db); err != nil {
				return err
			}
			base := db.Model(&shareRecord{}).Joins("LEFT JOIN files_entries AS share_roots ON share_roots.id = files_shares.root_id AND share_roots.owner_id = files_shares.owner_id").Where("files_shares.owner_id = ?", owner)
			if query.Search != "" {
				needle := "%" + strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(strings.ToLower(query.Search)) + "%"
				base = base.Where("LOWER(files_shares.title) LIKE ? ESCAPE '!' OR LOWER(share_roots.name) LIKE ? ESCAPE '!'", needle, needle)
			}
			switch query.State {
			case "":
			case "revoked":
				base = base.Where("files_shares.revoked_at IS NOT NULL")
			case "expired":
				base = base.Where("files_shares.revoked_at IS NULL AND files_shares.expires_at <= ?", now)
			case "active", "paused":
				base = base.Where("files_shares.revoked_at IS NULL AND files_shares.expires_at > ? AND files_shares.state = ?", now, query.State)
			default:
				return model.ErrInvalid
			}
			var total int64
			if err := base.Session(&gorm.Session{}).Count(&total).Error; err != nil {
				return err
			}
			result.Total = int(total)
			switch query.Sort {
			case "newest":
				base = base.Order("files_shares.created_at DESC")
			case "oldest":
				base = base.Order("files_shares.created_at ASC")
			case "name":
				base = base.Order("LOWER(CASE WHEN files_shares.title <> '' THEN files_shares.title ELSE COALESCE(share_roots.name, '') END) ASC")
			default:
				return model.ErrInvalid
			}
			var records []shareRecord
			if err := base.Select("files_shares.*").Order("files_shares.id ASC").Offset((query.Page - 1) * service.SharePageSize).Limit(service.SharePageSize).Find(&records).Error; err != nil {
				return err
			}
			ids := []string{}
			for _, record := range records {
				share := model.Share(record)
				if !validShareRecord(share) {
					return fmt.Errorf("share policy invariant")
				}
				result.Items = append(result.Items, share)
				ids = append(ids, share.RootID)
			}
			if len(ids) > 0 {
				var roots []entryRecord
				if err := db.Where("owner_id = ? AND id IN ?", owner, ids).Find(&roots).Error; err != nil {
					return err
				}
				var err error
				result.Roots, err = entryModels(roots)
				if err != nil {
					return err
				}
			}
			return nil
		})
	})
	return result, err
}
