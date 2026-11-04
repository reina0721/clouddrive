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

func TestOfflineV11PreservesExistingTransfersAndGuardsRollback(t *testing.T) {
	config := database.DefaultConfig()
	config.Driver, config.DSN = database.DriverSQLite, filepath.Join(t.TempDir(), "v10-to-v11.db")
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
			if filepath.Base(path) >= "000011_" {
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
		legacy := model.Transfer{ID: "d25f5cc7-8a0d-4483-9764-7b70580a39fc", OwnerID: "owner", Name: "existing.bin", NormalizedName: "existing.bin", SizeBytes: 3, SizeKnown: true, QuotaReservedBytes: 3, Source: model.TransferSourceTus, ContentSHA256: strings.Repeat("a", 64), IdempotencyKey: "preserved-key", State: model.TransferPaused, CreatedAt: now, UpdatedAt: now, ExpiresAt: now.Add(time.Hour), Revision: 7, ObjectKey: "preserved-object"}
		if err := db.Table("files_transfers").Omit("DownloadID", "ShareID", "ShareRevision", "ShareGrantDigest").Create(&legacy).Error; err != nil {
			return err
		}
		var before, after model.Transfer
		if err := db.Table("files_transfers").Where("id = ?", legacy.ID).Take(&before).Error; err != nil {
			return err
		}
		up, err := fs.ReadFile(set.FS, "sqlite/000011_offline_downloads.up.sql")
		if err != nil {
			return err
		}
		if err := db.Exec(string(up)).Error; err != nil {
			return err
		}
		if err := db.Table("files_transfers").Where("id = ?", legacy.ID).Take(&after).Error; err != nil {
			return err
		}
		if !reflect.DeepEqual(before, after) || after.DownloadID != "" {
			t.Fatal("v11改变了既有上传的预算、内容或续传状态")
		}
		task := model.DownloadTask{ID: "77ef740c-12da-4b91-a8ec-02a753710b47", OwnerID: "owner", Kind: model.DownloadHTTP, SourceURI: "https://source.example/file", SourceOrigin: "https://source.example", ClientKey: "offline-migration-key", State: model.DownloadQueued, Intent: model.DownloadRun, Revision: 1, CreatedAt: now, UpdatedAt: now, ExpiresAt: now.Add(time.Hour)}
		if err := db.Table("files_download_tasks").Create(&task).Error; err != nil {
			return err
		}
		down, err := fs.ReadFile(set.FS, "sqlite/000011_offline_downloads.down.sql")
		if err != nil {
			return err
		}
		guardErr := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error })
		if guardErr == nil || !strings.Contains(strings.ToLower(guardErr.Error()), "check constraint") {
			t.Fatal("有任务时未拒绝v11回滚")
		}
		if !db.Migrator().HasTable("files_download_tasks") || !db.Migrator().HasColumn("files_transfers", "download_id") {
			t.Fatal("被拒绝的回滚仍改变了离线结构")
		}
		// 只清理本合成库的专用记录，再验证完全没有离线数据时可回滚。
		if err := db.Table("files_download_tasks").Where("id = ?", task.ID).Delete(&model.DownloadTask{}).Error; err != nil {
			return err
		}
		if err := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error }); err != nil {
			return err
		}
		if db.Migrator().HasColumn("files_transfers", "download_id") || db.Migrator().HasTable("files_download_tasks") {
			t.Fatal("空离线数据回滚未完成")
		}
		var restored model.Transfer
		if err := db.Table("files_transfers").Where("id = ?", legacy.ID).Take(&restored).Error; err != nil {
			return err
		}
		if !reflect.DeepEqual(before, restored) {
			t.Fatal("空数据回滚改写了既有上传")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
