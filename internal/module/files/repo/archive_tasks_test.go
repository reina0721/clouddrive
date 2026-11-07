package repo

import (
	"context"
	"errors"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
	"time"

	filesmigration "github.com/reina0721/clouddrive/internal/module/files/binding/migration"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
)

type archiveTestAccess struct{ database.Client }

func (a archiveTestAccess) Use(_ context.Context, use func(database.Client) error) error {
	return use(a.Client)
}

func (a archiveTestAccess) WithinTx(ctx context.Context, use func(context.Context, database.Client, database.Tx) error) error {
	return a.Client.WithinTx(ctx, func(ctx context.Context, tx database.Tx) error { return use(ctx, a.Client, tx) })
}

type archiveTestClock struct{ now time.Time }

func (c *archiveTestClock) Now() time.Time      { return c.now }
func (c *archiveTestClock) Sleep(time.Duration) {}

func TestArchiveTaskClaimsPublicationAndV18Rollback(t *testing.T) {
	ctx := t.Context()
	cfg := database.DefaultConfig()
	cfg.Driver, cfg.DSN = database.DriverSQLite, filepath.Join(t.TempDir(), "archive-v18.db")
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
	apply := func(name string) error {
		sql, err := fs.ReadFile(migrations.FS, name)
		if err != nil {
			return err
		}
		return database.UseGORM(ctx, resource.Client(), func(db *gorm.DB) error {
			return db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(sql)).Error })
		})
	}
	paths, err := fs.Glob(migrations.FS, "sqlite/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	const upgrade = "sqlite/000018_archive_tasks.up.sql"
	const zipUpgrade = "sqlite/000019_zip_tasks.up.sql"
	for _, path := range paths {
		if path == upgrade || path == zipUpgrade {
			continue
		}
		if err := apply(path); err != nil {
			t.Fatal(path, err)
		}
	}
	now := &archiveTestClock{now: time.Now().UTC().Truncate(time.Millisecond)}
	repository, err := New(archiveTestAccess{resource.Client()}, "archive-test-storage", now)
	if err != nil {
		t.Fatal(err)
	}
	if err := repository.ValidateStorage(ctx, "archive-test-storage"); err != nil {
		t.Fatal(err)
	}
	ids := idgen.UUID()
	newID := func() string {
		id, err := ids.New()
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	legacy := model.Entry{ID: newID(), OwnerID: "owner-a", Kind: model.Folder, Name: "existing", NormalizedName: "existing", CreatedAt: now.Now(), UpdatedAt: now.Now(), ContentRevision: 1}
	if _, err := repository.Change(ctx, legacy.OwnerID, func([]model.Entry) (model.Entry, error) {
		return legacy, nil
	}); err != nil {
		t.Fatal(err)
	}
	if err := apply(upgrade); err != nil {
		t.Fatal(err)
	}
	if err := apply(zipUpgrade); err != nil {
		t.Fatal(err)
	}

	validate := func([]model.Entry) (service.ArchiveTaskSource, error) {
		return service.ArchiveTaskSource{Name: "source.zip"}, nil
	}
	enqueue := func() (service.ArchiveTaskClaim, string) {
		task := service.ArchiveTaskClaim{ID: newID(), OwnerID: legacy.OwnerID, Kind: service.ArchiveTaskExtract, SourceID: newID(), RequestJSON: "{}"}
		key := newID()
		queued, err := repository.CreateArchiveTask(ctx, task, key, service.DefaultSearchTreeEntries, validate)
		if err != nil || queued.State != service.ArchiveTaskQueued {
			t.Fatalf("排队失败 %v %v", queued.State, err)
		}
		return task, key
	}
	cancelled, key := enqueue()
	repeated := cancelled
	repeated.ID = newID()
	if replay, err := repository.CreateArchiveTask(ctx, repeated, key, service.DefaultSearchTreeEntries, validate); err != nil || replay.ID != cancelled.ID {
		t.Fatal("同一请求未返回原任务", err)
	}
	repeated.RequestJSON = "changed"
	if _, err := repository.CreateArchiveTask(ctx, repeated, key, service.DefaultSearchTreeEntries, validate); !errors.Is(err, model.ErrConflict) {
		t.Fatal("幂等键接受了其他输入", err)
	}
	if _, err := repository.ReadArchiveTask(ctx, "owner-b", cancelled.ID); !errors.Is(err, model.ErrMissing) {
		t.Fatal("其他账号读取了任务", err)
	}
	if err := repository.CancelArchiveTask(ctx, "owner-b", cancelled.ID); !errors.Is(err, model.ErrMissing) {
		t.Fatal("其他账号取消了任务", err)
	}
	if err := repository.CancelArchiveTask(ctx, cancelled.OwnerID, cancelled.ID); err != nil {
		t.Fatal(err)
	}

	expiring, _ := enqueue()
	now.now = now.now.Add(time.Millisecond)
	waiting, _ := enqueue()
	first, err := repository.ClaimArchiveTask(ctx, newID())
	if err != nil || first.ID != expiring.ID {
		t.Fatal("首个有效任务未按序领取", err)
	}
	if claim, err := repository.ClaimArchiveTask(ctx, newID()); err != nil || claim.ID != "" {
		t.Fatal("领取绕过并行上限", err)
	}
	if err := repository.CancelArchiveTask(ctx, first.OwnerID, first.ID); !errors.Is(err, model.ErrConflict) {
		t.Fatal("运行任务可以被取消", err)
	}
	firstKey := "files/" + newID()
	if err := repository.RecordArchiveCandidates(ctx, first, []string{firstKey}); err != nil {
		t.Fatal(err)
	}
	now.now = now.now.Add(service.ArchiveTaskLease + time.Second)
	restarted, err := New(archiveTestAccess{resource.Client()}, "archive-test-storage", now)
	if err != nil {
		t.Fatal(err)
	}
	second, err := restarted.ClaimArchiveTask(ctx, newID())
	if err != nil || second.ID != waiting.ID {
		t.Fatal("重建仓储后排队任务丢失", err)
	}
	if expired, err := restarted.ReadArchiveTask(ctx, first.OwnerID, first.ID); err != nil || expired.FailureCode != service.ArchiveFailureInterrupted || !expired.CleanupPending {
		t.Fatal("过期领取未保留中断及清理证据", err)
	}
	if err := restarted.PublishArchiveTask(ctx, first, service.DefaultSearchTreeEntries, service.ArchiveTask{}, nil); !errors.Is(err, model.ErrConflict) {
		t.Fatal("过期工作者可以发布", err)
	}
	cleanup, err := restarted.ClaimArchiveCleanup(ctx, newID())
	if err != nil || cleanup.ID != first.ID || len(cleanup.Keys) != 1 || cleanup.Keys[0] != firstKey {
		t.Fatal("清理未准确领取候选", err)
	}
	if err := restarted.SettleArchiveCleanup(ctx, cleanup, nil); err != nil {
		t.Fatal(err)
	}

	entry := model.Entry{ID: newID(), OwnerID: waiting.OwnerID, Kind: model.File, Name: "published.txt", NormalizedName: "published.txt", ContentRevision: 1, ContentSHA: strings.Repeat("a", 64), SizeBytes: 1, CreatedAt: now.Now(), UpdatedAt: now.Now()}
	entry.ObjectKey = "files/" + entry.ID
	if err := restarted.RecordArchiveCandidates(ctx, second, []string{entry.ObjectKey}); err != nil {
		t.Fatal(err)
	}
	if err := restarted.PublishArchiveTask(ctx, second, service.DefaultSearchTreeEntries, service.ArchiveTask{CreatedCount: 1}, func(entries []model.Entry) ([]model.Entry, error) {
		if _, exists := model.Find(entries, legacy.ID); !exists {
			return nil, errors.New("v18迁移丢失旧目录")
		}
		return []model.Entry{entry}, nil
	}); err != nil {
		t.Fatal(err)
	}
	if done, err := restarted.ReadArchiveTask(ctx, second.OwnerID, second.ID); err != nil || done.State != service.ArchiveTaskCompleted || done.CreatedCount != 1 || done.CleanupPending {
		t.Fatal("成功回执未随文件事务提交", err)
	}
	const rollback = "sqlite/000018_archive_tasks.down.sql"
	if err := apply(rollback); err == nil {
		t.Fatal("有任务记录时未阻止回退")
	}
	if err := restarted.RemoveArchiveTask(ctx, second.OwnerID, second.ID); err != nil {
		t.Fatal(err)
	}
	entries, err := restarted.Read(ctx, second.OwnerID)
	if _, exists := model.Find(entries, entry.ID); err != nil || !exists {
		t.Fatal("清除记录移除了真实文件", err)
	}
	for _, task := range []service.ArchiveTaskClaim{first, cancelled} {
		if err := restarted.RemoveArchiveTask(ctx, task.OwnerID, task.ID); err != nil {
			t.Fatal(err)
		}
	}
	if err := apply(rollback); err != nil {
		t.Fatal("空任务表无法回退", err)
	}
}
