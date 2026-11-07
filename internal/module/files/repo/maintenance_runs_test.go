package repo

import (
	"context"
	"errors"
	"io/fs"
	"path/filepath"
	"testing"
	"time"

	filesmigration "github.com/reina0721/clouddrive/internal/module/files/binding/migration"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
)

func TestMaintenanceRunsRetainAndCleanTerminalRecords(t *testing.T) {
	ctx := t.Context()
	cfg := database.DefaultConfig()
	cfg.Driver, cfg.DSN = database.DriverSQLite, filepath.Join(t.TempDir(), "maintenance.db")
	resource, err := database.NewGORM(ctx, &cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := resource.Close(); err != nil {
			t.Error(err)
		}
	})
	migrations := filesmigration.Set()
	paths, err := fs.Glob(migrations.FS, "sqlite/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range paths {
		sql, err := fs.ReadFile(migrations.FS, path)
		if err != nil {
			t.Fatal(err)
		}
		if err := database.UseGORM(ctx, resource.Client(), func(db *gorm.DB) error { return db.Exec(string(sql)).Error }); err != nil {
			t.Fatal(path, err)
		}
	}
	clock := &archiveTestClock{now: time.Now().UTC()}
	repository, err := New(archiveTestAccess{resource.Client()}, "maintenance-test-storage", clock)
	if err != nil {
		t.Fatal(err)
	}
	if err := repository.ValidateStorage(ctx, "maintenance-test-storage"); err != nil {
		t.Fatal(err)
	}
	maintenance, err := service.NewMaintenanceRuns(repository, clock, idgen.UUID())
	if err != nil {
		t.Fatal(err)
	}
	noWork := func(context.Context) error { return nil }
	trash := service.BackgroundTaskKind(service.MaintenanceTrashExpiry)
	blob := service.BackgroundTaskKind(service.MaintenanceBlobReclaim)
	query := service.AdminTaskQuery{Origin: service.AdminTaskOriginSystem, Kind: trash, Status: service.BackgroundStatusAll,
		Sort: service.AdminTaskByCreated, Direction: service.InventoryDescending, Page: 1}
	list := func() service.AdminTaskPage {
		t.Helper()
		page, err := repository.QueryAdminTasks(ctx, query, clock.Now())
		if err != nil {
			t.Fatal(err)
		}
		return page
	}
	if page := list(); page.Total != 0 {
		t.Fatal("v26 不应回填历史")
	}
	if err := maintenance.Record(ctx, service.MaintenanceTrashExpiry, noWork); err != nil {
		t.Fatal(err)
	}
	oldest := list().Items[0]
	for range service.MaintenanceHistoryLimit {
		clock.now = clock.now.Add(time.Second)
		if err := maintenance.Record(ctx, service.MaintenanceTrashExpiry, noWork); err != nil {
			t.Fatal(err)
		}
	}
	if page := list(); page.Total != service.MaintenanceHistoryLimit || len(page.Items) != service.AdminTaskPageSize {
		t.Fatalf("保留上限或分页错误: total=%d page=%d", page.Total, len(page.Items))
	}
	if _, err := repository.ReadAdminTask(ctx, trash, oldest.ID, clock.Now()); !errors.Is(err, model.ErrMissing) {
		t.Fatalf("最旧记录未淘汰: %v", err)
	}
	callbackErr := errors.New("private fixture failure")
	err = maintenance.Record(ctx, service.MaintenanceBlobReclaim, func(context.Context) error {
		clock.now = clock.now.Add(125 * time.Millisecond)
		return callbackErr
	})
	if !errors.Is(err, callbackErr) {
		t.Fatalf("维护错误链丢失: %v", err)
	}
	clock.now = clock.now.Add(time.Second)
	canceled, cancel := context.WithCancel(ctx)
	err = maintenance.Record(canceled, service.MaintenanceBlobReclaim, func(run context.Context) error {
		cancel()
		return run.Err()
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("维护取消语义丢失: %v", err)
	}
	query.Kind = blob
	if page := list(); page.Total != 2 || page.Items[0].State != "canceled" {
		t.Fatalf("取消记录或分类型保留错误: %+v", page)
	}
	query.Status, query.CleanupBefore = service.BackgroundStatusFailed, clock.Now().Add(time.Second)
	page := list()
	if page.Total != 1 {
		t.Fatalf("失败筛选或清理预览错误: %d", page.Total)
	}
	item := page.Items[0]
	if item.OwnerID != "" || item.NodeID != "" || item.FailureCode != "maintenance_failed" ||
		item.DurationMS == nil || *item.DurationMS != 125 || !item.Cleanable {
		t.Fatalf("管理投影错误: %+v", item)
	}
	query.Origin = service.AdminTaskOriginUser
	if page := list(); page.Total != 0 {
		t.Fatal("用户来源包含系统任务")
	}
	if err := repository.RemoveMaintenanceRunIfUnchanged(ctx, service.MaintenanceBlobReclaim, item.ID, item.UpdatedAt.Add(-time.Second)); !errors.Is(err, model.ErrConflict) {
		t.Fatalf("旧快照应被拒绝: %v", err)
	}
	if err := repository.RemoveMaintenanceRunIfUnchanged(ctx, service.MaintenanceBlobReclaim, item.ID, item.UpdatedAt); err != nil {
		t.Fatal(err)
	}
	if _, err := repository.ReadAdminTask(ctx, blob, item.ID, clock.Now()); !errors.Is(err, model.ErrMissing) {
		t.Fatalf("历史清理失败: %v", err)
	}
}
