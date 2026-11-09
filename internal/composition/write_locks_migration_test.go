package composition

import (
	filesmigration "github.com/reina0721/clouddrive/internal/module/files/binding/migration"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"io/fs"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestWOPIV27PreservesDAVRowsAndGuardsRollback(t *testing.T) {
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "v27.db")
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
			if filepath.Base(path) >= "000027_" {
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
		if err := db.Exec("INSERT INTO files_write_locks (id,owner_id,connection_id,connection_revision,root_path,depth,owner_xml,created_at,expires_at,revision) VALUES (?,?,?,?,?,?,?,?,?,?)",
			"dav", "owner", "connection", 2, "/file.txt", "0", "<owner/>", now, now.Add(time.Hour), 3).Error; err != nil {
			return err
		}
		up, err := fs.ReadFile(set.FS, "sqlite/000027_wopi_write_locks.up.sql")
		if err != nil {
			return err
		}
		if err := db.Exec(string(up)).Error; err != nil {
			return err
		}
		var lock model.WriteLock
		if err := db.Table("files_write_locks").Where("id = ?", "dav").Take(&lock).Error; err != nil {
			return err
		}
		if lock.ConnectionID != "connection" || lock.ConnectionRevision != 2 || lock.OwnerXML != "<owner/>" ||
			lock.Revision != 3 || lock.WOPISessionID != "" || lock.WOPIContentRevision != 0 {
			t.Fatal("v27 未保留原有 WebDAV 锁")
		}
		down, err := fs.ReadFile(set.FS, "sqlite/000027_wopi_write_locks.down.sql")
		if err != nil {
			return err
		}
		if err := db.Table("files_write_locks").Where("id = ?", "dav").Update("wopi_session_id", "session").Error; err != nil {
			return err
		}
		if err := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error }); err == nil {
			t.Fatal("仍有 WOPI 会话时允许了回退")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestWriteLocksV16PreservesTransfersAndGuardsRollback(t *testing.T) {
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "v16.db")
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
			if filepath.Base(path) >= "000016_" {
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
		before := v10TransferFixture{ID: "d25f5cc7-8a0d-4483-9764-7b70580a39fc", OwnerID: "owner", Name: "existing.txt", NormalizedName: "existing.txt", SizeBytes: 3, SizeKnown: true, QuotaReservedBytes: 3, Source: model.TransferSourceTus, ContentSHA256: strings.Repeat("a", 64), IdempotencyKey: "preserved", State: model.TransferPaused, CreatedAt: now, UpdatedAt: now, ExpiresAt: now.Add(time.Hour), Revision: 2, ObjectKey: "preserved-object"}
		if err := db.Table("files_transfers").Create(&before).Error; err != nil {
			return err
		}
		var original v10TransferFixture
		if err := db.Table("files_transfers").Where("id = ?", before.ID).Take(&original).Error; err != nil {
			return err
		}
		up, err := fs.ReadFile(set.FS, "sqlite/000016_write_locks.up.sql")
		if err != nil {
			return err
		}
		if err := db.Exec(string(up)).Error; err != nil {
			return err
		}
		var after v10TransferFixture
		if err := db.Table("files_transfers").Where("id = ?", before.ID).Take(&after).Error; err != nil {
			return err
		}
		if !reflect.DeepEqual(original, after) {
			t.Fatal("v16改写了既有传输")
		}
		var document string
		if err := db.Table("files_transfers").Select("dav_condition_document").Where("id = ?", before.ID).Scan(&document).Error; err != nil {
			return err
		}
		if document != "" {
			t.Fatal("旧传输条件未采用明确空值")
		}
		down, err := fs.ReadFile(set.FS, "sqlite/000016_write_locks.down.sql")
		if err != nil {
			return err
		}
		if err := db.Exec("INSERT INTO files_write_locks (id,owner_id,connection_id,connection_revision,root_path,depth,owner_xml,created_at,expires_at,revision) VALUES (?,?,?,?,?,?,?,?,?,?)", "lock", "owner", "connection", 1, "/", "0", "", now, now.Add(time.Hour), 1).Error; err != nil {
			return err
		}
		if err := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error }); err == nil {
			t.Fatal("有锁记录仍允许丢弃锁表")
		}
		if err := db.Exec("DELETE FROM files_write_locks WHERE id = ?", "lock").Error; err != nil {
			return err
		}
		if err := db.Table("files_transfers").Where("id = ?", before.ID).Update("dav_condition_document", "{}").Error; err != nil {
			return err
		}
		if err := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error }); err == nil {
			t.Fatal("有持久If条件仍允许丢弃条件列")
		}
		if err := db.Table("files_transfers").Where("id = ?", before.ID).Update("dav_condition_document", "").Error; err != nil {
			return err
		}
		if err := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error }); err != nil {
			return err
		}
		if db.Migrator().HasTable("files_write_locks") || db.Migrator().HasColumn("files_transfers", "dav_condition_document") {
			t.Fatal("没有锁数据的回滚未完成")
		}
		var restored v10TransferFixture
		if err := db.Table("files_transfers").Where("id = ?", before.ID).Take(&restored).Error; err != nil {
			return err
		}
		if !reflect.DeepEqual(original, restored) {
			t.Fatal("回滚改写了既有传输")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
