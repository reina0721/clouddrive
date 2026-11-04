package composition

import (
	filesmigration "github.com/reina0721/clouddrive/internal/module/files/binding/migration"
	"github.com/reina0721/clouddrive/pkg/database"
	"gorm.io/gorm"
	"io/fs"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestHistoryV10PreservesAppliedRowsAndGuardsRollback(t *testing.T) {
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "v9-to-v10.db")
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := resource.Close(); err != nil {
			t.Error(err)
		}
	}()
	validation := database.UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		set := filesmigration.Set()
		paths, err := fs.Glob(set.FS, "sqlite/*.up.sql")
		if err != nil {
			return err
		}
		for _, path := range paths {
			if filepath.Base(path) >= "000010_" {
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
		if err := db.Exec("INSERT INTO files_entries(id,owner_id,parent_id,kind,name,normalized_name,object_key,size_bytes,media_type,created_at,updated_at,upload_key,content_sha,content_revision,share_token) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", "entry", "owner", "", "file", "existing.txt", "existing.txt", "preserved-object", 17, "text/plain", now, now, "preserved-upload", strings.Repeat("a", 64), 7, "").Error; err != nil {
			return err
		}
		type oldRow struct {
			ID, OwnerID, ParentID, Kind, Name, NormalizedName, ObjectKey, MediaType, UploadKey, ContentSHA, ShareToken string
			SizeBytes, ContentRevision                                                                                 int64
			CreatedAt, UpdatedAt                                                                                       time.Time
		}
		var before, after oldRow
		if err := db.Table("files_entries").Where("id = ?", "entry").Take(&before).Error; err != nil {
			return err
		}
		up, err := fs.ReadFile(set.FS, "sqlite/000010_history.up.sql")
		if err != nil {
			return err
		}
		if err := db.Exec(string(up)).Error; err != nil {
			return err
		}
		if err := db.Table("files_entries").Where("id = ?", "entry").Take(&after).Error; err != nil {
			return err
		}
		if !reflect.DeepEqual(before, after) {
			t.Fatal("v10改写了既有文件元数据")
		}
		var initial struct {
			HistoryJSON     string
			HistoryRevision int64
		}
		if err := db.Table("files_entries").Select("history_json, history_revision").Where("id = ?", "entry").Take(&initial).Error; err != nil {
			return err
		}
		if initial.HistoryJSON != "[]" || initial.HistoryRevision != 0 {
			t.Fatal("旧行初始历史不明确")
		}
		if err := db.Exec("UPDATE files_entries SET history_json = ?, history_revision = ? WHERE id = ?", `[{"revision":1}]`, 1, "entry").Error; err != nil {
			return err
		}
		down, err := fs.ReadFile(set.FS, "sqlite/000010_history.down.sql")
		if err != nil {
			return err
		}
		downErr := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error })
		if downErr == nil || !strings.Contains(strings.ToLower(downErr.Error()), "check constraint") {
			t.Fatal("含历史时未由数据guard拒绝down", downErr)
		}
		if !db.Migrator().HasColumn("files_entries", "history_json") {
			t.Fatal("被拒绝的回滚仍删除了历史列")
		}
		var preserved struct {
			HistoryJSON     string
			HistoryRevision int64
		}
		if err := db.Table("files_entries").Select("history_json, history_revision").Where("id = ?", "entry").Take(&preserved).Error; err != nil {
			return err
		}
		if preserved.HistoryRevision != 1 || preserved.HistoryJSON != `[{"revision":1}]` {
			t.Fatal("失败回滚丢失历史")
		}
		// 仅清除本测试创建的临时库记录，验证空历史时正常回滚；不操作用户数据库。
		if err := db.Exec("UPDATE files_entries SET history_json = '[]', history_revision = 0").Error; err != nil {
			return err
		}
		if err := db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(down)).Error }); err != nil {
			return err
		}
		if db.Migrator().HasColumn("files_entries", "history_json") {
			t.Fatal("空历史回滚未移除本批新增列")
		}
		return nil
	})
	if validation != nil {
		t.Fatal(validation)
	}
}
