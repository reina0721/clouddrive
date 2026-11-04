package composition

import (
	"io/fs"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	filesmigration "github.com/reina0721/clouddrive/internal/module/files/binding/migration"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
)

func TestSharePolicyV12PreservesReadOnlyLinksAndGuardsRollback(t *testing.T) {
	config := database.DefaultConfig()
	config.Driver, config.DSN = database.DriverSQLite, filepath.Join(t.TempDir(), "v11-to-v12.db")
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := resource.Close(); err != nil {
			t.Error(err)
		}
	}()
	err = database.UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		set := filesmigration.Set()
		paths, err := fs.Glob(set.FS, "sqlite/*.up.sql")
		if err != nil {
			return err
		}
		for _, path := range paths {
			if filepath.Base(path) >= "000012_" {
				continue
			}
			payload, err := fs.ReadFile(set.FS, path)
			if err != nil {
				return err
			}
			if err := db.Exec(string(payload)).Error; err != nil {
				return err
			}
		}
		now := time.Now().UTC()
		link := model.Share{ID: "d25f5cc7-8a0d-4483-9764-7b70580a39fc", OwnerID: "owner", RootID: "root", Token: strings.Repeat("q", 43), TokenDigest: strings.Repeat("a", 64), CreatedAt: now, ExpiresAt: now.Add(time.Hour), UnlockAttempts: 2}
		if err := db.Table("files_shares").Omit("Title", "State", "Permissions", "Revision").Create(&link).Error; err != nil {
			return err
		}
		grant := model.ShareGrant{Digest: strings.Repeat("b", 64), ShareID: link.ID, ExpiresAt: link.ExpiresAt}
		if err := db.Table("files_share_grants").Omit("ShareRevision").Create(&grant).Error; err != nil {
			return err
		}
		var before model.Share
		if err := db.Table("files_shares").Take(&before).Error; err != nil {
			return err
		}
		up, err := fs.ReadFile(set.FS, "sqlite/000012_share_policy.up.sql")
		if err != nil {
			return err
		}
		if err := db.Exec(string(up)).Error; err != nil {
			return err
		}
		var after model.Share
		if err := db.Table("files_shares").Take(&after).Error; err != nil {
			return err
		}
		expected := before
		expected.State, expected.Permissions, expected.Revision = model.ShareEnabled, model.ShareReadOnly, 1
		if !reflect.DeepEqual(after, expected) {
			t.Fatal("v12未显式只读启用或改写了原链接")
		}
		var migrated model.ShareGrant
		if err := db.Table("files_share_grants").Take(&migrated).Error; err != nil {
			return err
		}
		if migrated.ShareRevision != 1 || migrated.Digest != grant.Digest {
			t.Fatal("v12未保留原票据")
		}
		down, err := fs.ReadFile(set.FS, "sqlite/000012_share_policy.down.sql")
		if err != nil {
			return err
		}
		// 每种新语义单独触发guard，失败事务不得删除任何v12字段。
		for _, change := range []map[string]any{{"title": "已配置"}, {"permissions": model.ShareEditor}, {"state": model.SharePaused}, {"revision": 2}} {
			if err := db.Table("files_shares").Where("id = ?", link.ID).Updates(change).Error; err != nil {
				return err
			}
			guard := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error })
			if guard == nil || !strings.Contains(strings.ToLower(guard.Error()), "check constraint") {
				t.Fatal("新分享策略未阻止有损回滚")
			}
			if !db.Migrator().HasColumn("files_shares", "permissions") {
				t.Fatal("被拒绝回滚删除了策略字段")
			}
			if err := db.Table("files_shares").Where("id = ?", link.ID).Updates(map[string]any{"title": "", "permissions": model.ShareReadOnly, "state": model.ShareEnabled, "revision": 1}).Error; err != nil {
				return err
			}
		}
		if err := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error }); err != nil {
			return err
		}
		var restored model.Share
		if err := db.Table("files_shares").Take(&restored).Error; err != nil {
			return err
		}
		if !reflect.DeepEqual(before, restored) {
			t.Fatal("无新语义的合成回滚改写了旧链接")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
