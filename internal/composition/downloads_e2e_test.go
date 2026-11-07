package composition

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
)

func waitDownloadState(t *testing.T, owner *consoleTestClient, path, state string) map[string]any {
	t.Helper()
	return waitDownloadStateWhen(t, owner, path, state, func(map[string]any) bool { return true })
}

func waitDownloadStateWhen(t *testing.T, owner *consoleTestClient, path, state string, ready func(map[string]any) bool) map[string]any {
	t.Helper()
	deadline := time.NewTimer(15 * time.Second)
	defer deadline.Stop()
	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()
	for {
		value := owner.request(t, "GET", path, nil, 200)
		if value["state"] == state && ready(value) {
			return value
		}
		if value["state"] == "failed" && state != "failed" {
			t.Fatalf("离线任务失败，分类 %v", value["failureCode"])
		}
		select {
		case <-deadline.C:
			t.Fatalf("离线任务未就绪，预期状态 %s，当前 %v，待清理 %v", state, value["state"], value["cleanupPending"])
		case <-ticker.C:
		}
	}
}

func offlineFixtureSQL(t *testing.T, path string, work func(*gorm.DB) error) {
	t.Helper()
	config := database.DefaultConfig()
	config.Driver, config.DSN = database.DriverSQLite, path
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	workErr := database.UseGORM(t.Context(), resource.Client(), work)
	if err := errors.Join(workErr, resource.Close()); err != nil {
		t.Fatal(err)
	}
}

func TestOfflineDownloadPersistentPauseResumePublicationAndRecordRemoval(t *testing.T) {
	content := bytes.Repeat([]byte("download-source-"), (4<<20)/16)
	var resumed atomic.Int64
	var sourceRequests atomic.Int64
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sourceRequests.Add(1)
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" {
			t.Error("下载来源收到应用凭据")
		}
		start := 0
		w.Header().Set("ETag", `"offline-test"`)
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", `attachment; filename="automatic.bin"`)
		if header := r.Header.Get("Range"); header != "" {
			if r.Header.Get("If-Range") != `"offline-test"` {
				t.Error("续传没有强验证器")
			}
			parsed, err := strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(header, "bytes="), "-"))
			if err != nil || parsed < 0 || parsed > len(content) {
				w.WriteHeader(416)
				return
			}
			start = parsed
			resumed.Add(1)
			w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, len(content)-1, len(content)))
		}
		w.Header().Set("Content-Length", strconv.Itoa(len(content)-start))
		if start > 0 {
			w.WriteHeader(206)
		}
		for offset := start; offset < len(content); {
			end := min(offset+8192, len(content))
			if _, err := w.Write(content[offset:end]); err != nil {
				return
			}
			w.(http.Flusher).Flush()
			offset = end
			select {
			case <-r.Context().Done():
				return
			case <-time.After(8 * time.Millisecond):
			}
		}
	}))
	t.Cleanup(source.Close)
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	setup, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	payload := generationConfig(directory, 120, 32<<20, filepath.Join(directory, "downloads.db"))
	payload = strings.Replace(payload, "mode: development-anonymous", "mode: session", 1)
	payload = strings.Replace(payload, "scheduler:\n  enabled: false", "scheduler:\n  enabled: true", 1)
	payload = strings.Replace(payload, "files:\n", "files:\n  offline:\n    source:\n      allowedNetworks: [127.0.0.1/32]\n", 1)
	payload = "iam:\n  local:\n    setupToken: " + setup + "\n" + payload
	writeGenerationConfig(t, configPath, payload)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Error(err)
		}
	})
	owner := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "offline-owner@clouddrive.test", "name": "离线验收", "password": password}, 200)
	created := owner.request(t, "POST", "/native/files/downloads", map[string]string{"uri": source.URL + "/file?signature=never-log", "parentId": "", "name": "saved.bin", "clientKey": "offline-persistent-fixture"}, 200)
	path := "/native/files/downloads/" + created["id"].(string)
	encoded, err := json.Marshal(created)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "never-log") || strings.Contains(string(encoded), "leaseToken") {
		t.Fatal("普通任务DTO泄露私有来源或租约")
	}
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "Offline users", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	owner.request(t, "POST", "/users", map[string]any{"email": "offline-other@clouddrive.test", "name": "隔离验收", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	other := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	other.request(t, "GET", "/auth/csrf", nil, 200)
	other.request(t, "POST", "/auth/login", map[string]string{"email": "offline-other@clouddrive.test", "password": password}, 200)
	other.request(t, "GET", path, nil, 404)
	other.request(t, "GET", path+"/source", nil, 404)
	other.request(t, "POST", path+"/cancel", map[string]any{"revision": 1}, 404)
	feed := owner.request(t, "GET", "/native/files/background-tasks?kind=http&search=SAVED.BIN", nil, 200)
	tasks := feed["items"].([]any)
	if len(tasks) != 1 || tasks[0].(map[string]any)["id"] != created["id"] || tasks[0].(map[string]any)["sourceName"] != "saved.bin" {
		t.Fatal("后台任务汇总未返回本人的 HTTP 下载")
	}
	if encoded, err := json.Marshal(feed); err != nil || strings.Contains(string(encoded), "never-log") || strings.Contains(string(encoded), "leaseToken") {
		t.Fatal("后台任务汇总响应泄露私有来源或租约，或无法序列化")
	}
	otherFeed := other.request(t, "GET", "/native/files/background-tasks", nil, 200)
	if len(otherFeed["items"].([]any)) != 0 {
		t.Fatal("后台任务汇总暴露他人下载")
	}
	privateSource, sourceHeaders := transferBytes(t, owner, "GET", "/files/downloads/"+created["id"].(string)+"/source", nil, nil, 200)
	if sourceHeaders.Get("Cache-Control") != "no-store" || !bytes.Contains(privateSource, []byte("never-log")) {
		t.Fatal("显式原始来源读取未隔离缓存或丢失私有来源")
	}
	// 相同创建键必须指向同一任务，不增加后台文件与预算。
	repeated := owner.request(t, "POST", "/native/files/downloads", map[string]string{"uri": source.URL + "/file?signature=never-log", "parentId": "", "name": "saved.bin", "clientKey": "offline-persistent-fixture"}, 200)
	if repeated["id"] != created["id"] {
		t.Fatal("幂等创建重复任务")
	}
	deadline := time.Now().Add(10 * time.Second)
	var receiving map[string]any
	for time.Now().Before(deadline) {
		receiving = owner.request(t, "GET", path, nil, 200)
		if received, ok := receiving["receivedBytes"].(float64); ok && received > 0 {
			break
		}
		select {
		case <-t.Context().Done():
			t.Fatal(t.Context().Err())
		case <-time.After(25 * time.Millisecond):
		}
	}
	if receiving["state"] != "fetching" || receiving["receivedBytes"] == float64(0) {
		t.Fatalf("未获得真实下载进度，状态 %v，失败分类 %v", receiving["state"], receiving["failureCode"])
	}
	owner.request(t, "POST", path+"/pause", map[string]any{"revision": receiving["revision"]}, 200)
	paused := waitDownloadState(t, owner, path, "paused")
	if paused["resumable"] != true || paused["receivedBytes"].(float64) <= 0 {
		t.Fatal("暂停未保留可验证前缀")
	}
	owner.request(t, "POST", path+"/resume", map[string]any{"revision": receiving["revision"]}, 409)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	stopErr := coordinator.Stop(ctx)
	cancel()
	if stopErr != nil {
		t.Fatal(stopErr)
	}
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	afterRestart := owner.request(t, "GET", path, nil, 200)
	if afterRestart["receivedBytes"] != paused["receivedBytes"] || afterRestart["state"] != "paused" {
		t.Fatal("重启丢失下载前缀或暂停意图")
	}
	offlineFixtureSQL(t, filepath.Join(directory, "downloads.db"), func(db *gorm.DB) error {
		return db.Exec("CREATE TRIGGER offline_cleanup_fault BEFORE UPDATE OF cleanup_pending ON files_transfers WHEN OLD.cleanup_pending = 1 AND NEW.cleanup_pending = 0 AND OLD.source = 'offline' BEGIN SELECT RAISE(ABORT, 'fixture cleanup failure'); END").Error
	})
	owner.request(t, "POST", path+"/resume", map[string]any{"revision": afterRestart["revision"]}, 200)
	completed := waitDownloadState(t, owner, path, "completed")
	if resumed.Load() == 0 || completed["resultAvailable"] != true || completed["receivedBytes"] != float64(len(content)) {
		t.Fatal("未使用真实断点完成发布")
	}
	entryID := completed["entryId"].(string)
	if completed["cleanupPending"] != true || completed["failureCode"] != "cleanup" {
		t.Fatal("清理失败未保留已发布事实与清理债")
	}
	finishedBeforeCleanup := completed["finishedAt"]
	offlineFixtureSQL(t, filepath.Join(directory, "downloads.db"), func(db *gorm.DB) error { return db.Exec("DROP TRIGGER offline_cleanup_fault").Error })
	cleanupDeadline := time.NewTimer(5 * time.Second)
	defer cleanupDeadline.Stop()
	for {
		completed = owner.request(t, "GET", path, nil, 200)
		if completed["cleanupPending"] == false {
			break
		}
		select {
		case <-cleanupDeadline.C:
			t.Fatal("清理债未由既有调度恢复")
		case <-time.After(25 * time.Millisecond):
		}
	}
	if completed["finishedAt"] != finishedBeforeCleanup {
		t.Fatal("清理重试改变了实际完成时间")
	}
	// 仅在隔离夹具库重建“文件已发布、任务尚未确认”的崩溃窗口，验证下一次领取只对账。
	requestsBeforeReconcile := sourceRequests.Load()
	offlineFixtureSQL(t, filepath.Join(directory, "downloads.db"), func(db *gorm.DB) error {
		return db.Exec("UPDATE files_download_tasks SET state = ?, lease_token = '', lease_until = NULL, finished_at = NULL WHERE id = ?", "publishing", completed["id"]).Error
	})
	reconciled := waitDownloadState(t, owner, path, "completed")
	if reconciled["entryId"] != entryID || sourceRequests.Load() != requestsBeforeReconcile {
		t.Fatal("发布后恢复重复请求来源或创建第二条目")
	}
	actual, _ := transferBytes(t, owner, "GET", "/files/"+entryID+"/content", nil, nil, 200)
	if sha256.Sum256(actual) != sha256.Sum256(content) {
		t.Fatal("离线发布字节与来源不一致")
	}
	listing := owner.request(t, "GET", "/native/files/transfers", nil, 200)
	if len(listing["items"].([]any)) != 0 {
		t.Fatal("离线子传输暴露在浏览器上传控制中")
	}
	owner.request(t, "POST", path+"/remove", map[string]any{"revision": completed["revision"]}, 200)
	owner.request(t, "GET", path, nil, 404)
	afterRemoval, _ := transferBytes(t, owner, "GET", "/files/"+entryID+"/content", nil, nil, 200)
	if !bytes.Equal(afterRemoval, content) {
		t.Fatal("移除记录删除了已发布文件")
	}
}

func TestOfflineDownloadFailureRetargetUnknownSizeBatchAndCancel(t *testing.T) {
	var reject atomic.Bool
	reject.Store(true)
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/unused" {
			w.(http.Flusher).Flush()
			<-r.Context().Done()
			return
		}
		if r.URL.Path == "/failed" && reject.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("ETag", `"stable"`)
		w.Header().Set("Content-Disposition", `attachment; filename="automatic.txt"`)
		if r.URL.Path == "/unknown" {
			w.(http.Flusher).Flush()
		}
		if _, err := w.Write([]byte("actual offline bytes")); err != nil {
			t.Error(err)
		}
	}))
	t.Cleanup(source.Close)
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	setup, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	payload := generationConfig(directory, 120, 32<<20, filepath.Join(directory, "offline-controls.db"))
	payload = strings.Replace(payload, "mode: development-anonymous", "mode: session", 1)
	payload = strings.Replace(payload, "scheduler:\n  enabled: false", "scheduler:\n  enabled: true", 1)
	payload = strings.Replace(payload, "files:\n", "files:\n  offline:\n    source:\n      allowedNetworks: [127.0.0.1/32]\n", 1)
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setup+"\n"+payload)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Error(err)
		}
	})
	owner := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "offline-controls@clouddrive.test", "name": "离线控制验收", "password": password}, 200)
	create := func(route, name, key string) map[string]any {
		return owner.request(t, "POST", "/native/files/downloads", map[string]string{"uri": source.URL + route, "parentId": "", "name": name, "clientKey": key}, 200)
	}
	failed := create("/failed", "", "offline-retry-target-fixture")
	failedPath := "/native/files/downloads/" + failed["id"].(string)
	failed = waitDownloadState(t, owner, failedPath, "failed")
	if failed["failureCode"] != "source-status" || failed["sourceStatus"] != float64(503) {
		t.Fatal("未保留来源状态失败分类")
	}
	folder := owner.request(t, "POST", "/native/files/folders", map[string]string{"parentId": "", "name": "目标目录"}, 200)
	changed := owner.request(t, "PUT", failedPath+"/target", map[string]any{"revision": failed["revision"], "parentId": folder["id"], "name": "fixed.txt"}, 200)
	if changed["parentId"] != folder["id"] || changed["name"] != "fixed.txt" {
		t.Fatal("任务与子传输目标不同步")
	}
	owner.request(t, "POST", failedPath+"/retry", map[string]any{"revision": failed["revision"]}, 409)
	reject.Store(false)
	owner.request(t, "POST", failedPath+"/retry", map[string]any{"revision": changed["revision"]}, 200)
	fixed := waitDownloadState(t, owner, failedPath, "completed")
	if fixed["name"] != "fixed.txt" || fixed["parentId"] != folder["id"] {
		t.Fatal("重试未保存到修正后的目标")
	}
	unknown := create("/unknown", "", "offline-unknown-size-fixture")
	unknownPath := "/native/files/downloads/" + unknown["id"].(string)
	unknown = waitDownloadState(t, owner, unknownPath, "completed")
	if unknown["name"] != "automatic.txt" || unknown["declaredBytes"] != float64(len("actual offline bytes")) {
		t.Fatal("未知长度来源未使用真实EOF封口与自动文件名")
	}
	search := owner.request(t, "GET", "/native/files/downloads?search=automatic.txt", nil, 200)
	if len(search["items"].([]any)) != 1 {
		t.Fatal("自动文件名不能被任务搜索找到")
	}
	batch := owner.request(t, "POST", "/native/files/downloads/batch-create", map[string]any{"items": []map[string]string{
		{"uri": source.URL + "/unused", "parentId": "", "name": "cancel.bin", "clientKey": "offline-batch-cancel-fixture"},
		{"uri": "file:///not-an-http-source", "parentId": "", "name": "blocked.bin", "clientKey": "offline-batch-blocked-fixture"},
	}}, 200)
	results := batch["items"].([]any)
	accepted := results[0].(map[string]any)
	if accepted["errorCode"] != "" || results[1].(map[string]any)["errorCode"] != "files_offline_source_blocked" {
		t.Fatal("批量创建没有逐项报告真实结果")
	}
	canceled := accepted["task"].(map[string]any)
	canceledPath := "/native/files/downloads/" + canceled["id"].(string)
	owner.request(t, "POST", canceledPath+"/cancel", map[string]any{"revision": canceled["revision"]}, 200)
	canceled = waitDownloadState(t, owner, canceledPath, "canceled")
	if canceled["cleanupPending"] != false || canceled["entryId"] != "" {
		t.Fatal("取消没有清理候选或意外发布文件")
	}
	offlineFixtureSQL(t, filepath.Join(directory, "offline-controls.db"), func(db *gorm.DB) error {
		return db.Exec("CREATE TRIGGER offline_delete_fault BEFORE DELETE ON files_transfers BEGIN SELECT RAISE(ABORT, 'fixture record failure'); END").Error
	})
	owner.request(t, "POST", unknownPath+"/remove", map[string]any{"revision": unknown["revision"]}, 500)
	unknown = owner.request(t, "GET", unknownPath, nil, 200)
	if unknown["state"] != "completed" || unknown["cleanupPending"] != false || unknown["failureCode"] != "" {
		t.Fatal("记录删除失败伪造了下载或候选清理失败")
	}
	offlineFixtureSQL(t, filepath.Join(directory, "offline-controls.db"), func(db *gorm.DB) error { return db.Exec("DROP TRIGGER offline_delete_fault").Error })
	cleared := owner.request(t, "POST", "/native/files/downloads/batch-control", map[string]any{"action": "remove", "items": []map[string]any{
		{"id": fixed["id"], "revision": fixed["revision"]}, {"id": unknown["id"], "revision": unknown["revision"]}, {"id": canceled["id"], "revision": canceled["revision"]},
	}}, 200)
	for _, item := range cleared["items"].([]any) {
		if item.(map[string]any)["errorCode"] != "" {
			t.Fatal("批量清理记录失败")
		}
	}
	owner.request(t, "GET", "/native/files/"+fixed["entryId"].(string), nil, 200)
	owner.request(t, "GET", "/native/files/"+unknown["entryId"].(string), nil, 200)
}

func TestOfflineMetadataBudgetAndDisabledDispatcherStillAllowCleanup(t *testing.T) {
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.(http.Flusher).Flush(); <-r.Context().Done() }))
	t.Cleanup(source.Close)
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	setup, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	payload := generationConfig(directory, 120, 32<<20, filepath.Join(directory, "offline-budget.db"))
	payload = strings.Replace(payload, "mode: development-anonymous", "mode: session", 1)
	payload = strings.Replace(payload, "scheduler:\n  enabled: false", "scheduler:\n  enabled: true", 1)
	payload = strings.Replace(payload, "files:\n", "files:\n  search:\n    treeEntries: 2\n  offline:\n    source:\n      allowedNetworks: [127.0.0.1/32]\n", 1)
	payload = "iam:\n  local:\n    setupToken: " + setup + "\n" + payload
	writeGenerationConfig(t, configPath, payload)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Error(err)
		}
	})
	owner := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "offline-budget@clouddrive.test", "name": "预算清理验收", "password": password}, 200)
	created := owner.request(t, "POST", "/native/files/downloads", map[string]string{"uri": source.URL + "/hold", "parentId": "", "name": "held.txt", "clientKey": "offline-tree-budget-fixture"}, 200)
	path := "/native/files/downloads/" + created["id"].(string)
	owner.request(t, "POST", path+"/pause", map[string]any{"revision": created["revision"]}, 200)
	paused := waitDownloadState(t, owner, path, "paused")
	for index := range 3 {
		owner.request(t, "POST", "/native/files/folders", map[string]string{"name": fmt.Sprintf("目录%d", index), "parentId": ""}, 200)
	}
	limited := owner.request(t, "GET", "/native/files/downloads", nil, 200)
	if limited["metadataLimited"] != true || len(limited["items"].([]any)) != 1 {
		t.Fatal("超预算时任务元数据不可读或静默截断目录")
	}
	owner.request(t, "POST", path+"/resume", map[string]any{"revision": paused["revision"]}, 413)
	owner.request(t, "POST", path+"/restart", map[string]any{"revision": paused["revision"]}, 413)
	owner.request(t, "PUT", path+"/target", map[string]any{"revision": paused["revision"], "parentId": "", "name": "other.txt"}, 413)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	stopErr := coordinator.Stop(ctx)
	cancel()
	if stopErr != nil {
		t.Fatal(stopErr)
	}
	writeGenerationConfig(t, configPath, strings.Replace(payload, "scheduler:\n  enabled: true", "scheduler:\n  enabled: false", 1))
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	listing := owner.request(t, "GET", "/native/files/downloads", nil, 200)
	if listing["available"] != false || listing["metadataLimited"] != true {
		t.Fatal("禁用调度或目录超预算未显式报告")
	}
	owner.request(t, "POST", path+"/cancel", map[string]any{"revision": paused["revision"]}, 200)
	canceled := waitDownloadState(t, owner, path, "canceled")
	if canceled["cleanupPending"] != false {
		t.Fatal("禁用调度后取消仍遗留候选")
	}
	owner.request(t, "POST", path+"/remove", map[string]any{"revision": canceled["revision"]}, 200)
	remaining := owner.request(t, "GET", "/native/files/downloads", nil, 200)
	if remaining["totalCount"] != float64(0) {
		t.Fatal("超目录预算后不能移除已清理记录")
	}
	offlineFixtureSQL(t, filepath.Join(directory, "offline-budget.db"), func(db *gorm.DB) error {
		var count int64
		if err := db.Table("files_entries").Count(&count).Error; err != nil {
			return err
		}
		if count != 3 {
			return fmt.Errorf("清理任务改动了既有目录: %d", count)
		}
		return nil
	})
}

func TestOfflineAutomaticCleanupStopsAtAttemptBudgetAndManualRemovalRecovers(t *testing.T) {
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := w.Write([]byte("bounded cleanup")); err != nil {
			t.Error(err)
		}
	}))
	t.Cleanup(source.Close)
	directory := t.TempDir()
	dbPath := filepath.Join(directory, "cleanup-budget.db")
	configPath := filepath.Join(directory, "config.yaml")
	setup, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	payload := generationConfig(directory, 120, 32<<20, dbPath)
	payload = strings.Replace(payload, "mode: development-anonymous", "mode: session", 1)
	payload = strings.Replace(payload, "scheduler:\n  enabled: false", "scheduler:\n  enabled: true", 1)
	payload = strings.Replace(payload, "files:\n", "files:\n  offline:\n    maxAttempts: 2\n    source:\n      allowedNetworks: [127.0.0.1/32]\n", 1)
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setup+"\n"+payload)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Error(err)
		}
	})
	owner := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "cleanup-budget@clouddrive.test", "name": "有界清理验收", "password": password}, 200)
	offlineFixtureSQL(t, dbPath, func(db *gorm.DB) error {
		return db.Exec("CREATE TRIGGER cleanup_budget_fault BEFORE UPDATE OF cleanup_pending ON files_transfers WHEN OLD.cleanup_pending = 1 AND NEW.cleanup_pending = 0 AND OLD.source = 'offline' BEGIN SELECT RAISE(ABORT, 'fixture cleanup budget'); END").Error
	})
	created := owner.request(t, "POST", "/native/files/downloads", map[string]string{"uri": source.URL, "name": "bounded.txt", "parentId": "", "clientKey": "bounded-cleanup-fixture"}, 200)
	path := "/native/files/downloads/" + created["id"].(string)
	completed := waitDownloadState(t, owner, path, "completed")
	deadline := time.NewTimer(5 * time.Second)
	defer deadline.Stop()
	for completed["attempts"] != float64(2) {
		select {
		case <-deadline.C:
			t.Fatal("未执行预算内清理")
		case <-time.After(25 * time.Millisecond):
		}
		completed = owner.request(t, "GET", path, nil, 200)
	}
	// 等待本次领取释放，随后跨越两个调度周期，确认不是无界重试。
	time.Sleep(250 * time.Millisecond)
	var firstUpdated time.Time
	offlineFixtureSQL(t, dbPath, func(db *gorm.DB) error {
		return db.Table("files_download_tasks").Select("updated_at").Where("id = ?", created["id"]).Scan(&firstUpdated).Error
	})
	time.Sleep(2200 * time.Millisecond)
	offlineFixtureSQL(t, dbPath, func(db *gorm.DB) error {
		var current struct {
			Attempts  int
			UpdatedAt time.Time
		}
		if err := db.Table("files_download_tasks").Select("attempts", "updated_at").Where("id = ?", created["id"]).Scan(&current).Error; err != nil {
			return err
		}
		if current.Attempts != 2 || !current.UpdatedAt.Equal(firstUpdated) {
			return fmt.Errorf("清理超过自动尝试预算: %d", current.Attempts)
		}
		return db.Exec("DROP TRIGGER cleanup_budget_fault").Error
	})
	completed = owner.request(t, "GET", path, nil, 200)
	if completed["cleanupPending"] != true || completed["failureCode"] != "cleanup" {
		t.Fatal("预算耗尽未保留清理债")
	}
	owner.request(t, "POST", path+"/remove", map[string]any{"revision": completed["revision"]}, 200)
	owner.request(t, "GET", path, nil, 404)
	owner.request(t, "GET", "/native/files/"+completed["entryId"].(string), nil, 200)
}
