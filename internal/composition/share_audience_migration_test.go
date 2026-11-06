package composition

import (
	filesmigration "github.com/reina0721/clouddrive/internal/module/files/binding/migration"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
)

func TestShareAudienceV13DefaultsAndRollbackGuard(t *testing.T) {
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "v12-to-v13.db")
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := resource.Close(); err != nil {
			t.Error(err)
		}
	})
	err = database.UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		set := filesmigration.Set()
		paths, err := fs.Glob(set.FS, "sqlite/*.up.sql")
		if err != nil {
			return err
		}
		for _, path := range paths {
			if filepath.Base(path) >= "000013_" {
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
		if err := db.Exec("INSERT INTO files_shares (id,owner_id,root_id,token,token_digest,password_hash,created_at,expires_at) VALUES ('share','owner','root',? ,?,'',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", strings.Repeat("a", 43), strings.Repeat("b", 64)).Error; err != nil {
			return err
		}
		up, err := fs.ReadFile(set.FS, "sqlite/000013_share_audience.up.sql")
		if err != nil {
			return err
		}
		if err := db.Exec(string(up)).Error; err != nil {
			return err
		}
		var record struct {
			AudienceJSON          string
			Permissions, Revision int64
		}
		if err := db.Table("files_shares").Take(&record).Error; err != nil {
			return err
		}
		if record.AudienceJSON != "{}" || record.Permissions != 7 || record.Revision != 1 {
			t.Fatal("v13没有保留原默认分享语义")
		}
		down, err := fs.ReadFile(set.FS, "sqlite/000013_share_audience.down.sql")
		if err != nil {
			return err
		}
		if err := db.Exec(`UPDATE files_shares SET audience_json = '{"anonymous":0}'`).Error; err != nil {
			return err
		}
		guard := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error })
		if guard == nil {
			t.Fatal("有受众规则时允许有损回滚")
		}
		if !db.Migrator().HasColumn("files_shares", "audience_json") {
			t.Fatal("回滚拒绝后删除了受众字段")
		}
		if err := db.Exec("UPDATE files_shares SET audience_json = '{}' ").Error; err != nil {
			return err
		}
		if err := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error }); err != nil {
			return err
		}
		var count int64
		if err := db.Table("files_shares").Count(&count).Error; err != nil {
			return err
		}
		if count != 1 {
			t.Fatal("无损回滚丢失原分享")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
