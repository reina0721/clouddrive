package composition

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestAdminTasksRetainPublishedFiles(t *testing.T) {
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	generate := func() string {
		t.Helper()
		value, err := idgen.UUID().New()
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	setupToken, password := generate(), generate()
	config := strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "admin-tasks.db")),
		"mode: development-anonymous", "mode: session", 1)
	config = strings.Replace(config, "scheduler:\n  enabled: false", "scheduler:\n  enabled: true", 1)
	config = strings.Replace(config, "files:\n", "files:\n  offline:\n    source:\n      allowedNetworks: [127.0.0.1/32]\n", 1)
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setupToken+"\n"+config)
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
	const files = "/native/files"
	const catalog = files + "/admin-tasks"
	const console = "/api/console/v1"
	const memberEmail = "task-catalog-member@clouddrive.test"
	admin := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	admin.request(t, "GET", "/auth/csrf", nil, 200)
	admin.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setupToken, "email": "task-catalog-admin@clouddrive.test", "name": "管理任务测试", "password": password}, 200)
	role := admin.request(t, "POST", "/roles", map[string]any{"name": "Task catalog observer", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	rolePath := "/native/iam/roles/" + roleID + "/permissions"
	admin.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	admin.request(t, "POST", "/users", map[string]any{"email": memberEmail, "name": "任务成员", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	member := &consoleTestClient{base: admin.base, cookies: map[string]string{}}
	login := func() {
		t.Helper()
		member.request(t, "GET", "/auth/csrf", nil, 200)
		member.request(t, "POST", "/auth/login", map[string]string{"email": memberEmail, "password": password}, 200)
	}
	login()
	member.request(t, "GET", catalog, nil, 403)
	root := member.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": "task-input.txt", "key": generate(), "text": "task fixture"}, 200)["id"].(string)
	job := audienceTyped[service.ArchiveTask](t, member, "POST", console+files+"/archive-tasks/zip", service.ZIPTaskInput{
		ClientKey: generate(), SourceIDs: []string{root}, Name: "retained.zip",
	}, 202)
	for deadline := time.Now().Add(15 * time.Second); job.State != service.ArchiveTaskCompleted && time.Now().Before(deadline); {
		time.Sleep(150 * time.Millisecond)
		job = audienceTyped[service.ArchiveTask](t, member, "GET", console+files+"/archive-tasks/"+job.ID, nil, 200)
		if job.State.Terminal() && job.State != service.ArchiveTaskCompleted {
			t.Fatalf("ZIP 终态不正确: %s", job.State)
		}
	}
	if job.ResultEntryID == "" || job.State != service.ArchiveTaskCompleted {
		t.Fatal("ZIP 未发布")
	}
	itemPath := catalog + "/zip/" + job.ID
	item := audienceTyped[service.AdminTask](t, admin, "GET", console+itemPath, nil, 200)
	if item.Kind != service.BackgroundTaskZIP || !item.Cleanable || item.OwnerID == "" || item.NodeID != "" {
		t.Fatal("管理任务投影错误")
	}
	query := catalog + "?ownerId=" + url.QueryEscape(item.OwnerID) + "&taskId=" + job.ID + "&kind=zip&status=completed&sort=id&direction=asc"
	page := audienceTyped[service.AdminTaskPage](t, admin, "GET", console+query, nil, 200)
	if page.Total != 1 || len(page.Items) != 1 || page.Items[0].ID != job.ID {
		t.Fatal("组合筛选不正确")
	}
	preview := catalog + "/cleanup-preview?kind=zip&before=" + url.QueryEscape(time.Now().UTC().Format(time.RFC3339Nano))
	if result := audienceTyped[service.AdminTaskPage](t, admin, "GET", console+preview, nil, 200); result.Total != 1 || len(result.Items) != 1 || result.Items[0].ID != job.ID {
		t.Fatal("清理预览范围错误")
	}
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeContent(w, r, "fixture.txt", time.Time{}, strings.NewReader("download fixture"))
	}))
	t.Cleanup(source.Close)
	const sourceMarker = "task-source-is-private"
	download := member.request(t, "POST", files+"/downloads", map[string]string{
		"uri": source.URL + "/fixture.txt?proof=" + sourceMarker, "name": "retained-download.txt", "parentId": "", "clientKey": generate(),
	}, 200)
	downloadID := download["id"].(string)
	download = waitDownloadState(t, member, files+"/downloads/"+downloadID, "completed")
	downloadItemPath := catalog + "/http/" + downloadID
	if raw := audienceHTTP(t, admin, "GET", console+downloadItemPath, nil, 200); bytes.Contains(raw, []byte(sourceMarker)) || bytes.Contains(raw, []byte("leaseToken")) {
		t.Fatal("管理任务泄露私有来源或租约")
	}
	downloadItem := audienceTyped[service.AdminTask](t, admin, "GET", console+downloadItemPath, nil, 200)
	if !downloadItem.Cleanable || downloadItem.Revision < 1 {
		t.Fatal("已完成 HTTP 下载未提供有效清理版本")
	}
	admin.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 2, "permissionKeys": []string{"files:read", "files:write", "files:task-admin:read"}}, 200)
	login()
	if member.request(t, "GET", catalog, nil, 200)["canCleanup"] != false {
		t.Fatal("读取权限错误获得清理能力")
	}
	member.request(t, "GET", preview, nil, 403)
	clean := func(client *consoleTestClient, status int, targets ...service.AdminTaskTarget) map[string]any {
		t.Helper()
		return client.request(t, "POST", catalog+"/cleanup", map[string]any{"targets": targets}, status)
	}
	clean(member, 403, item.AdminTaskTarget)
	stale := item.AdminTaskTarget
	stale.UpdatedAt = stale.UpdatedAt.Add(-time.Second)
	result := clean(admin, 200, stale)
	if result["items"].([]any)[0].(map[string]any)["status"] != float64(409) {
		t.Fatal("旧版本未被拒绝")
	}
	missing := item.AdminTaskTarget
	missing.ID = generate()
	result = clean(admin, 200, item.AdminTaskTarget, downloadItem.AdminTaskTarget, missing)
	items := result["items"].([]any)
	if items[0].(map[string]any)["status"] != float64(200) || items[1].(map[string]any)["status"] != float64(200) || items[2].(map[string]any)["status"] != float64(404) {
		t.Fatal("逐项清理结果错误")
	}
	admin.request(t, "GET", itemPath, nil, 404)
	admin.request(t, "GET", downloadItemPath, nil, 404)
	member.request(t, "GET", files+"/"+job.ResultEntryID, nil, 200)
	member.request(t, "GET", files+"/"+download["entryId"].(string), nil, 200)
}
