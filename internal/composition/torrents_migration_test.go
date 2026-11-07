package composition

import (
	"encoding/json"
	"errors"
	"io/fs"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	filesmigration "github.com/reina0721/clouddrive/internal/module/files/binding/migration"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"gorm.io/gorm"
)

func torrentMigrationSnapshot(db *gorm.DB, tables []string) (map[string][]string, error) {
	result := map[string][]string{}
	for _, table := range tables {
		var rows []map[string]any
		if err := db.Table(table).Find(&rows).Error; err != nil {
			return nil, err
		}
		result[table] = []string{}
		for _, row := range rows {
			encoded, err := json.Marshal(row)
			if err != nil {
				return nil, err
			}
			result[table] = append(result[table], string(encoded))
		}
		sort.Strings(result[table])
	}
	return result, nil
}

func TestTorrentV17PreservesV16RowsAndRejectsDestructiveRollback(t *testing.T) {
	offlineFixtureSQL(t, filepath.Join(t.TempDir(), "v16-to-v17.db"), func(db *gorm.DB) error {
		set := filesmigration.Set()
		paths, err := fs.Glob(set.FS, "sqlite/*.up.sql")
		if err != nil {
			return err
		}
		for _, path := range paths {
			if filepath.Base(path) >= "000017_" {
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
		task := model.DownloadTask{ID: "77ef740c-12da-4b91-a8ec-02a753710b47", OwnerID: "owner", Kind: model.DownloadHTTP, SourceURI: "https://source.example/file", SourceOrigin: "https://source.example", ClientKey: "torrent-migration-http", State: model.DownloadPaused, Intent: model.DownloadPause, Revision: 3, CreatedAt: now, UpdatedAt: now, ExpiresAt: now.Add(time.Hour)}
		if err := db.Table("files_download_tasks").Create(&task).Error; err != nil {
			return err
		}
		transfer := v10TransferFixture{ID: "d25f5cc7-8a0d-4483-9764-7b70580a39fc", OwnerID: task.OwnerID, Name: "preserved.bin", NormalizedName: "preserved.bin", SizeBytes: 3, SizeKnown: true, QuotaReservedBytes: 3, Source: model.TransferSourceTus, ContentSHA256: strings.Repeat("a", 64), IdempotencyKey: "preserved-upload-key", State: model.TransferPaused, CreatedAt: now, UpdatedAt: now, ExpiresAt: now.Add(time.Hour), Revision: 7, ObjectKey: "preserved-object"}
		if err := db.Table("files_transfers").Create(&transfer).Error; err != nil {
			return err
		}
		var tables []string
		if err := db.Raw("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'files_%' ORDER BY name").Scan(&tables).Error; err != nil {
			return err
		}
		before, err := torrentMigrationSnapshot(db, tables)
		if err != nil {
			return err
		}
		up, err := fs.ReadFile(set.FS, "sqlite/000017_bittorrent.up.sql")
		if err != nil {
			return err
		}
		if err := db.Exec(string(up)).Error; err != nil {
			return err
		}
		after, err := torrentMigrationSnapshot(db, tables)
		if err != nil {
			return err
		}
		if !reflect.DeepEqual(before, after) {
			t.Fatal("v17改变了既有v16文件、上传或HTTP任务事实")
		}
		// 即使BT扩展行尚未写入，也不能删除仍有BT header的表结构。
		bt := task
		bt.ID, bt.Kind, bt.ClientKey = "bba0af60-52a2-4b63-b282-a022835cb438", model.DownloadBitTorrent, "torrent-migration-bt"
		if err := db.Table("files_download_tasks").Create(&bt).Error; err != nil {
			return err
		}
		down, err := fs.ReadFile(set.FS, "sqlite/000017_bittorrent.down.sql")
		if err != nil {
			return err
		}
		rollbackErr := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error })
		if rollbackErr == nil {
			t.Fatal("存在BT任务时回滚未被拒绝")
		}
		for _, table := range []string{"files_torrent_tasks", "files_torrent_files", "files_torrent_folders", "files_torrent_jobs"} {
			if !db.Migrator().HasTable(table) {
				t.Fatalf("拒绝回滚仍删除了表 %s", table)
			}
		}
		var count int64
		if err := db.Table("files_download_tasks").Where("id = ?", bt.ID).Count(&count).Error; err != nil {
			return err
		}
		if count != 1 {
			return errors.New("拒绝回滚仍删除了BT任务")
		}
		return nil
	})
}
