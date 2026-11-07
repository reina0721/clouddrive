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
	storageclient "github.com/reina0721/clouddrive/pkg/storage/client"
	"github.com/reina0721/clouddrive/pkg/storage/local"
	"gorm.io/gorm"
)

type blobTestRemover func(context.Context, string) error

func (f blobTestRemover) Delete(ctx context.Context, key string) error { return f(ctx, key) }

func TestPublishedBlobReclamation(t *testing.T) {
	ctx := t.Context()
	cfg := database.DefaultConfig()
	cfg.Driver, cfg.DSN = database.DriverSQLite, filepath.Join(t.TempDir(), "reclamation.db")
	db, err := database.NewGORM(ctx, &cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Error(err)
		}
	})
	migrations := filesmigration.Set()
	apply := func(name string) {
		t.Helper()
		sql, err := fs.ReadFile(migrations.FS, name)
		if err != nil {
			t.Fatal(err)
		}
		if err := database.UseGORM(ctx, db.Client(), func(g *gorm.DB) error { return g.Exec(string(sql)).Error }); err != nil {
			t.Fatal(err)
		}
	}
	const upgrade = "sqlite/000022_blob_reclamation.up.sql"
	paths, err := fs.Glob(migrations.FS, "sqlite/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range paths {
		if path != upgrade {
			apply(path)
		}
	}
	store, err := local.New(local.Config{BasePath: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := store.Close(); err != nil {
			t.Error(err)
		}
	})
	clock := &archiveTestClock{now: time.Date(2026, 11, 7, 12, 0, 0, 0, time.UTC)}
	access := archiveTestAccess{db.Client()}
	newRepository := func() *Repository {
		t.Helper()
		repository, err := New(access, "reclamation-primary", clock)
		if err != nil {
			t.Fatal(err)
		}
		return repository
	}
	repository := newRepository()
	if err := repository.ValidateStorage(ctx, "reclamation-primary"); err != nil {
		t.Fatal(err)
	}
	id := func() string {
		t.Helper()
		value, err := idgen.UUID().New()
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	put := func(identifier string) string {
		t.Helper()
		key := "files/" + identifier
		if err := store.Put(ctx, key, []byte("synthetic"), storageclient.PutOptions{}); err != nil {
			t.Fatal(err)
		}
		return key
	}
	exists := func(key string, want bool) {
		t.Helper()
		got, err := store.Exists(ctx, key)
		if err != nil || got != want {
			t.Fatalf("对象存在状态为 %v，期望 %v，错误 %v", got, want, err)
		}
	}
	const owner, otherOwner = "owner", "other-owner"
	entry := func(account string) model.Entry {
		identifier := id()
		return model.Entry{ID: identifier, OwnerID: account, Kind: model.File, Name: identifier, NormalizedName: identifier,
			CreatedAt: clock.Now(), UpdatedAt: clock.Now(), ContentRevision: 1, ObjectKey: put(identifier), SizeBytes: 9}
	}
	legacyOrphan := put(id())
	apply(upgrade)
	apply("sqlite/000022_blob_reclamation.down.sql")
	apply(upgrade)
	save := func(value model.Entry) {
		t.Helper()
		if _, err := repository.Change(ctx, value.OwnerID, func([]model.Entry) (model.Entry, error) { return value, nil }); err != nil {
			t.Fatal(err)
		}
	}
	purge := func(value model.Entry) {
		t.Helper()
		if err := repository.RemoveTrash(ctx, value.OwnerID, 100, func([]model.Entry) ([]string, error) {
			return []string{value.ID}, nil
		}); err != nil {
			t.Fatal(err)
		}
	}
	list := func(reclaimer *service.BlobReclamation, page int) service.BlobCandidatePage {
		t.Helper()
		result, err := reclaimer.List(ctx, page)
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	newReclaimer := func(remover service.BlobObjectRemover, automatic bool) *service.BlobReclamation {
		t.Helper()
		policy := service.DefaultBlobReclamationPolicy()
		policy.Automatic = automatic
		value, err := service.NewBlobReclamation(newRepository(), remover, clock, policy)
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	reclaimer := newReclaimer(store, false)
	if page := list(reclaimer, 1); page.Total != 0 || page.Automatic {
		t.Fatal("迁移回填了未知对象或默认开启自动回收")
	}
	original := entry(owner)
	other := entry(otherOwner)
	unusedFixture := other.ObjectKey
	other.ObjectKey = original.ObjectKey
	save(original)
	save(other)
	purge(original)
	if page := list(reclaimer, 1); page.Total != 0 {
		t.Fatal("跨账号副本仍引用对象")
	}
	clock.now = clock.now.Add(service.BlobReclamationGrace)
	if err := reclaimer.Remove(ctx, original.ID); !errors.Is(err, model.ErrConflict) {
		t.Fatal(err)
	}
	exists(original.ObjectKey, true)
	purge(other)
	page := list(newReclaimer(store, false), 1)
	if page.Total != 1 || page.Items[0].Ready || page.Items[0].ID != original.ID ||
		!page.Items[0].ReadyAt.Equal(clock.Now().Add(service.BlobReclamationGrace)) {
		t.Fatalf("候选持久化、去重或最后解除时间错误: %+v", page)
	}
	if err := reclaimer.Remove(ctx, original.ID); !errors.Is(err, model.ErrConflict) {
		t.Fatal(err)
	}
	clock.now = clock.now.Add(service.BlobReclamationGrace)
	if err := reclaimer.Dispatch(ctx); err != nil {
		t.Fatal(err)
	}
	exists(original.ObjectKey, true)
	if err := reclaimer.Remove(ctx, original.ID); err != nil {
		t.Fatal(err)
	}
	exists(original.ObjectKey, false)
	if err := reclaimer.Remove(ctx, original.ID); !errors.Is(err, model.ErrMissing) {
		t.Fatal(err)
	}

	versioned := entry(owner)
	save(versioned)
	old := model.CurrentSnapshot(versioned)
	versioned.ObjectKey = put(id())
	versioned.ContentRevision++
	versioned.HistoryRevision++
	versioned.History = []model.VersionSnapshot{old}
	save(versioned)
	if list(reclaimer, 1).Total != 0 {
		t.Fatal("覆盖仍保留历史时错误登记")
	}
	versioned.HistoryRevision++
	versioned.History = nil
	save(versioned)
	if list(reclaimer, 1).Total != 1 {
		t.Fatal("删除历史没有登记")
	}
	exists(old.ObjectKey, true)
	replacement := versioned.ObjectKey
	versioned.ObjectKey = put(id())
	versioned.ContentRevision++
	save(versioned)
	if list(reclaimer, 1).Total != 2 {
		t.Fatal("覆盖且无历史保留时没有登记")
	}
	exists(replacement, true)
	exists(versioned.ObjectKey, true)

	// 单次故障不得清除候选或阻塞同批后续的对象。
	clock.now = clock.now.Add(service.BlobReclamationGrace)
	denied := errors.New("test storage unavailable")
	worker := newReclaimer(blobTestRemover(func(ctx context.Context, key string) error {
		if key == old.ObjectKey {
			return denied
		}
		return store.Delete(ctx, key)
	}), true)
	if err := worker.Dispatch(ctx); !errors.Is(err, denied) {
		t.Fatal(err)
	}
	if result := list(worker, 1); result.Total != 1 || !result.Automatic || !result.Items[0].Ready {
		t.Fatal(result)
	}
	exists(old.ObjectKey, true)
	exists(replacement, false)
	if err := worker.Dispatch(ctx); err != nil {
		t.Fatal("退避期间重复调度", err)
	}
	if err := store.Delete(ctx, old.ObjectKey); err != nil {
		t.Fatal(err)
	}
	if err := reclaimer.Remove(ctx, old.ObjectKey[len("files/"):]); err != nil {
		t.Fatal("缺失对象应幂等处理", err)
	}
	exists(legacyOrphan, true)
	exists(unusedFixture, true)
	exists(versioned.ObjectKey, true)

	retention, err := service.NewTrashRetention(repository, clock, service.DefaultPolicy())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := retention.Save(ctx, owner, model.TrashRetention{Days: 1}); err != nil {
		t.Fatal(err)
	}
	expiring, restored := entry(owner), entry(owner)
	trashTime := clock.Now()
	expiring.TrashedAt, restored.TrashedAt = &trashTime, &trashTime
	save(expiring)
	save(restored)
	restored.TrashedAt = nil
	save(restored)
	clock.now = clock.now.Add(24 * time.Hour)
	if err := retention.Dispatch(ctx); err != nil {
		t.Fatal(err)
	}
	if result := list(reclaimer, 1); result.Total != 1 || result.Items[0].ID != expiring.ID {
		t.Fatal("到期移除未登记，或恢复后的文件被登记")
	}
	exists(restored.ObjectKey, true)

	for range 20 {
		value := entry(otherOwner)
		save(value)
		purge(value)
	}
	if first, second := list(reclaimer, 1), list(reclaimer, 2); len(first.Items) != 20 || len(second.Items) != 1 || second.Total != 21 {
		t.Fatalf("分页异常: 第一页 %d，第二页 %d，总计 %d", len(first.Items), len(second.Items), second.Total)
	}
	clock.now = clock.now.Add(service.BlobReclamationGrace)
	if err := worker.Dispatch(ctx); err != nil {
		t.Fatal(err)
	}
	if result := list(reclaimer, 1); result.Total != 5 {
		t.Fatalf("后台批次超过 16 项: %d", result.Total)
	}
	if err := worker.Dispatch(ctx); err != nil {
		t.Fatal(err)
	}
	if list(reclaimer, 1).Total != 0 {
		t.Fatal("后续调度未清空剩余候选")
	}
	exists(expiring.ObjectKey, false)
	exists(restored.ObjectKey, true)
}
