package repo

import (
	"errors"
	"io/fs"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	filesmigration "github.com/reina0721/clouddrive/internal/module/files/binding/migration"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
)

func TestTrashRetentionUpgradeAndExpiry(t *testing.T) {
	ctx := t.Context()
	cfg := database.DefaultConfig()
	cfg.Driver, cfg.DSN = database.DriverSQLite, filepath.Join(t.TempDir(), "trash-v19.db")
	resource, err := database.NewGORM(ctx, &cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := resource.Close(); err != nil {
			t.Error(err)
		}
	})
	client := resource.Client()
	migrations := filesmigration.Set()
	apply := func(name string) error {
		sql, err := fs.ReadFile(migrations.FS, name)
		if err != nil {
			return err
		}
		return database.UseGORM(ctx, client, func(db *gorm.DB) error {
			return db.Transaction(func(tx *gorm.DB) error { return tx.Exec(string(sql)).Error })
		})
	}
	const upgrade = "sqlite/000020_trash_retention.up.sql"
	const downgrade = "sqlite/000020_trash_retention.down.sql"
	paths, err := fs.Glob(migrations.FS, "sqlite/*.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range paths {
		if path != upgrade {
			if err := apply(path); err != nil {
				t.Fatal(path, err)
			}
		}
	}

	const owner, other = "trash-owner", "another-owner"
	now := &archiveTestClock{now: time.Date(2026, 11, 7, 12, 0, 0, 0, time.UTC)}
	ids := idgen.UUID()
	newEntry := func(account, parent, name string, kind model.Kind) model.Entry {
		t.Helper()
		id, err := ids.New()
		if err != nil {
			t.Fatal(err)
		}
		return model.Entry{ID: id, OwnerID: account, ParentID: parent, Name: name, NormalizedName: name, Kind: kind, CreatedAt: now.Now(), UpdatedAt: now.Now(), ContentRevision: 1}
	}
	legacy := newEntry(owner, "", "legacy", model.Folder)
	legacyTrash := now.Now().Add(-30 * 24 * time.Hour)
	legacy.TrashedAt = &legacyTrash
	record, err := entryRecordFromModel(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if err := database.UseGORM(ctx, client, func(db *gorm.DB) error {
		return db.Omit("TrashExpiresAt", "TrashRetryAt").Create(&record).Error
	}); err != nil {
		t.Fatal(err)
	}
	for _, migration := range []string{upgrade, downgrade, upgrade} {
		if err := apply(migration); err != nil {
			t.Fatal(migration, err)
		}
	}
	repository, err := New(archiveTestAccess{client}, "trash-retention-storage", now)
	if err != nil {
		t.Fatal(err)
	}
	if err := repository.ValidateStorage(ctx, "trash-retention-storage"); err != nil {
		t.Fatal(err)
	}
	policy := service.Policy{SearchTreeEntries: service.DefaultSearchTreeEntries, MaxBatchEntries: service.DefaultMaxBatchEntries}
	retention, err := service.NewTrashRetention(repository, now, policy)
	if err != nil {
		t.Fatal(err)
	}
	manual, err := service.NewTrashPurge(repository, policy)
	if err != nil {
		t.Fatal(err)
	}
	read := func(account string) map[string]model.Entry {
		t.Helper()
		entries, err := repository.ReadBounded(ctx, account, policy.SearchTreeEntries)
		if err != nil {
			t.Fatal(err)
		}
		index := make(map[string]model.Entry, len(entries))
		for _, entry := range entries {
			index[entry.ID] = entry
		}
		return index
	}
	saveEntry := func(entry model.Entry, trashed bool) model.Entry {
		t.Helper()
		entry.UpdatedAt = now.Now()
		entry.TrashedAt = nil
		if trashed {
			at := now.Now()
			entry.TrashedAt = &at
		}
		saved, err := repository.Change(ctx, entry.OwnerID, func([]model.Entry) (model.Entry, error) {
			return entry, nil
		})
		if err != nil {
			t.Fatal(err)
		}
		return saved
	}
	save := func(account string, days int, revision int64) model.TrashRetention {
		t.Helper()
		setting, err := retention.Save(ctx, account, model.TrashRetention{Days: days, Revision: revision})
		if err != nil || setting.Days != days || setting.Revision != revision+1 {
			t.Fatalf("规则保存失败: %+v, %v", setting, err)
		}
		return setting
	}
	dispatch := func() {
		t.Helper()
		if err := retention.Dispatch(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if setting, err := retention.Get(ctx, owner); err != nil || setting != (model.TrashRetention{}) {
		t.Fatalf("旧账号默认规则异常: %+v, %v", setting, err)
	}
	parent := saveEntry(newEntry(owner, "", "parent", model.Folder), false)
	protected := saveEntry(newEntry(owner, parent.ID, "manual-child", model.Folder), true)
	expirable := saveEntry(newEntry(owner, "", "expirable", model.Folder), false)
	implicit := newEntry(owner, expirable.ID, "implicit-child", model.File)
	implicit.SizeBytes, implicit.ObjectKey, implicit.ContentRevision, implicit.HistoryRevision = 9, "current-object", 2, 1
	implicit.History = []model.VersionSnapshot{
		{Revision: 1, Name: implicit.Name, ObjectKey: "shared-version", SizeBytes: 7, UpdatedAt: now.Now()},
	}
	implicit = saveEntry(implicit, false)
	copy := newEntry(owner, "", "independent-copy", model.File)
	copy.SizeBytes, copy.ObjectKey = 7, "shared-version"
	copy = saveEntry(copy, false)
	otherEntry := saveEntry(newEntry(other, "", "other", model.Folder), true)
	if protected.TrashExpiresAt != nil || otherEntry.TrashExpiresAt != nil {
		t.Fatal("默认回收规则应为手动")
	}
	setting := save(owner, 1, 0)
	for _, invalid := range []int{-1, model.MaxTrashRetentionDays + 1} {
		if _, err := retention.Save(ctx, owner, model.TrashRetention{Days: invalid, Revision: setting.Revision}); !errors.Is(err, model.ErrInvalid) {
			t.Fatal("越界保留天数未被拒绝", err)
		}
	}
	if _, err := retention.Save(ctx, owner, model.TrashRetention{Days: 2}); !errors.Is(err, model.ErrConflict) {
		t.Fatal("旧修订未被拒绝", err)
	}
	if err := apply(downgrade); err == nil {
		t.Fatal("回滚没有保护已保存的策略")
	}
	parent = saveEntry(parent, true)
	expirable = saveEntry(expirable, true)
	if expirable.TrashExpiresAt == nil || !expirable.TrashExpiresAt.Equal(now.Now().Add(24*time.Hour)) {
		t.Fatal("首次回收截止时间不正确")
	}
	longParent := saveEntry(newEntry(owner, "", "long-parent", model.Folder), true)
	setting = save(owner, model.MaxTrashRetentionDays, setting.Revision)
	longChild := saveEntry(newEntry(owner, longParent.ID, "long-child", model.Folder), true)
	restored := saveEntry(newEntry(owner, "", "restore", model.Folder), true)
	restored = saveEntry(restored, false)
	if restored.TrashedAt != nil || restored.TrashExpiresAt != nil || restored.TrashRetryAt != nil {
		t.Fatal("恢复没有取消期限")
	}
	setting = save(owner, 2, setting.Revision)
	restored = saveEntry(restored, true)
	if restored.TrashExpiresAt == nil || !restored.TrashExpiresAt.Equal(now.Now().Add(48*time.Hour)) {
		t.Fatal("重新回收未按最新规则保存期限")
	}
	setting = save(owner, 0, setting.Revision)
	if setting, err := retention.Get(ctx, other); err != nil || setting != (model.TrashRetention{}) {
		t.Fatalf("另一账号的规则受影响: %+v, %v", setting, err)
	}
	if saved, err := retention.Get(ctx, owner); err != nil || saved != setting {
		t.Fatalf("再次读取未得到持久规则: %+v, %v", saved, err)
	}
	used := func(entries map[string]model.Entry) int64 {
		all := make([]model.Entry, 0, len(entries))
		for _, entry := range entries {
			all = append(all, entry)
		}
		return model.Used(all)
	}
	before := read(owner)
	if err := retention.Dispatch(ctx); err != nil || read(owner)[expirable.ID].ID == "" {
		t.Fatal("到期前已清理", err)
	}
	now.now = now.Now().Add(24 * time.Hour)
	dispatch()
	entries := read(owner)
	if entries[expirable.ID].ID != "" || entries[implicit.ID].ID != "" {
		t.Fatal("到期目录及隐含子项未清理")
	}
	if used(before)-used(entries) != 16 || entries[copy.ID].ObjectKey != "shared-version" {
		t.Fatal("到期没有准确释放逻辑占用，或影响独立副本")
	}
	for _, kept := range []model.Entry{legacy, parent, protected, longParent, longChild, restored} {
		if entries[kept.ID].ID == "" {
			t.Fatal("应保留的条目已消失", kept.Name)
		}
	}
	if entries[legacy.ID].TrashExpiresAt != nil || read(other)[otherEntry.ID].ID == "" ||
		entries[parent.ID].TrashRetryAt == nil || !entries[parent.ID].TrashRetryAt.After(now.Now()) {
		t.Fatal("旧记录、账号隔离或延迟重试失效")
	}
	selection := service.TrashPurgeSelectionInput{Scope: service.TrashPurgeSelection, IDs: []string{protected.ID}}
	preview, err := manual.Preview(ctx, owner, selection)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manual.Confirm(ctx, owner, selection, preview.Snapshot); err != nil {
		t.Fatal(err)
	}
	now.now = *entries[parent.ID].TrashRetryAt
	dispatch()
	if entries := read(owner); entries[parent.ID].ID != "" || entries[longParent.ID].ID == "" {
		t.Fatal("上级重试或较晚到期保护不正确")
	}
	selection.IDs = []string{longParent.ID, restored.ID}
	preview, err = manual.Preview(ctx, owner, selection)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manual.Confirm(ctx, owner, selection, preview.Snapshot); err != nil {
		t.Fatal(err)
	}

	const large, small = "budget-owner", "small-owner"
	save(large, 1, 0)
	save(small, 1, 0)
	big := saveEntry(newEntry(large, "", "budget-root", model.Folder), true)
	saveEntry(newEntry(large, big.ID, "budget-child", model.Folder), false)
	tiny := saveEntry(newEntry(small, "", "single-item", model.Folder), true)
	now.now = now.Now().Add(24 * time.Hour)
	constrained, err := service.NewTrashRetention(repository, now, service.Policy{SearchTreeEntries: 1})
	if err != nil {
		t.Fatal(err)
	}
	if err := constrained.Dispatch(ctx); err == nil {
		t.Fatal("目录预算失败未报告")
	}
	if read(small)[tiny.ID].ID != "" {
		t.Fatal("失败账号阻塞了独立账号")
	}
	if got := read(large)[big.ID]; got.TrashRetryAt == nil || !got.TrashRetryAt.After(now.Now()) {
		t.Fatal("失败的树未完整保留并延迟重试")
	}
	now.now = *read(large)[big.ID].TrashRetryAt
	dispatch()
	if len(read(large)) != 0 {
		t.Fatal("重试未移除到期的完整目录")
	}

	const batchOwner = "batch-owner"
	save(batchOwner, 1, 0)
	for index := range service.TrashExpiryBatch + 1 {
		saveEntry(newEntry(batchOwner, "", "batch-"+strconv.Itoa(index), model.Folder), true)
	}
	now.now = now.Now().Add(24 * time.Hour)
	dispatch()
	if len(read(batchOwner)) != 1 {
		t.Fatal("单轮到期任务未遵守候选上限")
	}
	dispatch()
	if len(read(batchOwner)) != 0 {
		t.Fatal("下一轮未处理剩余候选")
	}
}
