package composition

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestFilesystemSettingsApplyAfterRestart(t *testing.T) {
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
	config := generationConfig(directory, 120, 32<<20, filepath.Join(directory, "filesystem.db"))
	config = strings.Replace(config, "mode: development-anonymous", "mode: session", 1)
	config = strings.Replace(config, "files:\n", "files:\n  maxTextBytes: 64\n  maxBatchEntries: 10\n", 1)
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setupToken+"\n"+config)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	stop := func() {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Fatal(err)
		}
	}
	defer stop()
	admin := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	admin.request(t, "GET", "/auth/csrf", nil, 200)
	admin.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setupToken, "email": "settings-admin@clouddrive.test", "name": "参数管理员", "password": password}, 200)
	const files = "/native/files"
	const endpoint = files + "/settings"
	anonymous := &consoleTestClient{base: admin.base, cookies: map[string]string{}}
	anonymous.request(t, "GET", endpoint, nil, 401)
	role := admin.request(t, "POST", "/roles", map[string]any{"name": "Settings observer", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	admin.request(t, "POST", "/users", map[string]any{"email": "settings-observer@clouddrive.test", "name": "参数观察员", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	observer := &consoleTestClient{base: admin.base, cookies: map[string]string{}}
	loginObserver := func() {
		t.Helper()
		observer.request(t, "GET", "/auth/csrf", nil, 200)
		observer.request(t, "POST", "/auth/login", map[string]string{"email": "settings-observer@clouddrive.test", "password": password}, 200)
	}
	loginObserver()
	observer.request(t, "GET", endpoint, nil, 403)
	admin.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:settings:read"}}, 200)
	loginObserver()
	observed := observer.request(t, "GET", endpoint, nil, 200)
	if observed["canSave"] != false || observed["revision"] != float64(0) ||
		observed["defaults"].(map[string]any)["textBytes"] != float64(64) || observed["pendingRestart"] != false {
		t.Fatalf("默认值或只读授权错误: %v", observed)
	}
	input := func(revision int, overrides map[string]any) map[string]any {
		return map[string]any{"revision": revision, "overrides": overrides}
	}
	observer.request(t, "PUT", endpoint, input(0, map[string]any{}), 403)
	const icons = files + "/icon-rules"
	iconBody := func(revision int, inherit bool, items ...map[string]any) map[string]any {
		if items == nil {
			items = []map[string]any{}
		}
		return map[string]any{"revision": revision, "inherit": inherit, "items": items}
	}
	anonymous.request(t, "GET", icons+"/active", nil, 401)
	observer.request(t, "GET", icons+"/active", nil, 403)
	if view := observer.request(t, "GET", icons, nil, 200); view["canSave"] != false ||
		view["inherit"] != true || len(view["defaults"].([]any)) == 0 {
		t.Fatalf("只读视图或内置图标未提供: %v", view)
	}
	observer.request(t, "PUT", icons, iconBody(0, true), 403)
	const apps = files + "/applications"
	appBody := func(revision int, rules, defaults []map[string]any) map[string]any {
		return map[string]any{"revision": revision, "apps": rules, "defaults": defaults}
	}
	noRules := []map[string]any{}
	anonymous.request(t, "GET", apps, nil, 401)
	anonymous.request(t, "GET", apps+"/active", nil, 401)
	observer.request(t, "GET", apps+"/active", nil, 403)
	appView := observer.request(t, "GET", apps, nil, 200)
	if appView["canSave"] != false || len(appView["items"].([]any)) != 8 || len(appView["defaults"].([]any)) != 2 {
		t.Fatalf("内置应用或只读视图错误: %v", appView)
	}
	observer.request(t, "PUT", apps, appBody(0, noRules, noRules), 403)
	admin.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{
		"expectedRoleVersion": 2, "permissionKeys": []string{"files:read"},
	}, 200)
	loginObserver()
	observer.request(t, "GET", icons, nil, 403)
	observer.request(t, "GET", icons+"/active", nil, 200)
	observer.request(t, "GET", apps, nil, 403)
	observer.request(t, "GET", apps+"/active", nil, 200)
	observer.request(t, "PUT", apps, appBody(0, noRules, noRules), 403)
	md := map[string]any{"extension": " .MD ", "app": "text"}
	mdRule := map[string]any{"id": "markdown", "enabled": true, "platform": "desktop"}
	admin.request(t, "PUT", apps, appBody(0, []map[string]any{mdRule, mdRule}, noRules), 422)
	admin.request(t, "PUT", apps, appBody(0, noRules, []map[string]any{md, {"extension": "md", "app": "markdown"}}), 422)
	admin.request(t, "PUT", apps, appBody(0, noRules, []map[string]any{{"extension": "md", "app": "pdf"}}), 422)
	admin.request(t, "PUT", apps, appBody(0, []map[string]any{{"id": "text", "enabled": false, "platform": "all"}}, []map[string]any{md}), 422)
	appView = admin.request(t, "PUT", apps, appBody(0, []map[string]any{mdRule}, []map[string]any{md}), 200)
	if appView["revision"] != float64(1) || appView["canSave"] != true {
		t.Fatalf("应用设置未保存: %v", appView)
	}
	admin.request(t, "PUT", apps, appBody(0, noRules, noRules), 409)
	activeApps := observer.request(t, "GET", apps+"/active", nil, 200)
	if activeApps["defaults"].([]any)[0].(map[string]any)["extension"] != "md" || activeApps["canSave"] != nil {
		t.Fatalf("活动应用未应用归一规则或暴露管理字段: %v", activeApps)
	}
	archiveRule := map[string]any{"shape": "archive", "extensions": []string{" .CUSTOM ", "other"}, "light": "#123ABC", "dark": "#445566"}
	admin.request(t, "PUT", icons, iconBody(0, false, archiveRule, archiveRule), 422)
	admin.request(t, "PUT", icons, iconBody(0, false, map[string]any{
		"shape": "file", "extensions": []string{"../x"}, "light": "#123abc",
	}), 422)
	admin.request(t, "PUT", icons, iconBody(0, false, map[string]any{
		"shape": "file", "extensions": []string{"x"}, "light": "current",
	}), 422)
	for _, address := range []string{"http://icons.example.test/pic.svg", "https://127.0.0.1/pic.svg",
		"https://assets.local/pic.svg", "https://a:b@icons.example.test/pic.svg", "https://icons.example.test/pic.svg?token=sample",
		"https://icons.example.test/pic.svg#part", "https://icons.example.test/read"} {
		admin.request(t, "PUT", icons, iconBody(0, false, map[string]any{
			"shape": "image-url", "extensions": []string{"x"}, "imageUrl": address,
		}), 422)
	}
	remoteIcon := map[string]any{"shape": "image-url", "extensions": []string{"remote"}, "imageUrl": "https://icons.example.test/pic.svg"}
	admin.request(t, "PUT", icons, iconBody(0, false, archiveRule, remoteIcon), 200)
	admin.request(t, "PUT", icons, iconBody(0, true), 409)
	activeIcons := observer.request(t, "GET", icons+"/active", nil, 200)["items"].([]any)
	firstIcon := activeIcons[0].(map[string]any)
	if len(activeIcons) != 2 || firstIcon["light"] != "#123abc" || firstIcon["extensions"].([]any)[0] != "custom" {
		t.Fatalf("图标规则未立即生效或归一失败: %v", activeIcons)
	}
	admin.request(t, "PUT", endpoint, input(0, map[string]any{"textBytes": 65}), 422)
	admin.request(t, "PUT", endpoint, input(0, map[string]any{"batchEntries": 11}), 422)
	admin.request(t, "PUT", endpoint, input(0, map[string]any{"blobScanSeconds": 59}), 400)
	admin.request(t, "PUT", endpoint, input(0, map[string]any{"trashScanSeconds": 86401}), 400)
	admin.request(t, "PUT", endpoint, input(0, map[string]any{"pagination": "offset"}), 400)
	admin.request(t, "PUT", endpoint, input(0, map[string]any{"maxPageSize": 201}), 400)
	create := func(name, text string, status int) map[string]any {
		t.Helper()
		return admin.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": name + ".txt", "key": generate(), "text": text}, status)
	}
	existing := create("history-fixture", "old", 200)["id"].(string)
	admin.request(t, "PUT", files+"/"+existing+"/text", map[string]any{"expectedRevision": 1, "text": "mid"}, 200)
	first := create("trash-one", "before", 200)["id"].(string)
	second := create("trash-two", "before", 200)["id"].(string)
	for _, id := range []string{first, second} {
		admin.request(t, "POST", files+"/"+id+"/trash", nil, 200)
	}
	selection := map[string]any{"scope": "selection", "ids": []string{first, second}}
	admin.request(t, "POST", files+"/trash/purge-preview", selection, 200)
	overrides := map[string]any{
		"textBytes": 4, "batchEntries": 1, "historyEnabled": false, "historyPerFile": 2,
		"trashScanSeconds": 80, "blobScanSeconds": 120, "automaticBlob": true,
		"pagination": "cursor", "maxPageSize": 1,
	}
	saved := admin.request(t, "PUT", endpoint, input(0, overrides), 200)
	if saved["revision"] != float64(1) || saved["pendingRestart"] != true || saved["canSave"] != true ||
		saved["active"].(map[string]any)["textBytes"] != float64(64) ||
		saved["configured"].(map[string]any)["textBytes"] != float64(4) {
		t.Fatalf("保存前后状态边界不一致: %v", saved)
	}
	admin.request(t, "PUT", endpoint, input(0, map[string]any{"textBytes": 5}), 409)
	if persisted := admin.request(t, "GET", endpoint, nil, 200); persisted["revision"] != float64(1) || persisted["pendingRestart"] != true {
		t.Fatalf("刷新后丢失保存参数: %v", persisted)
	}
	create("still-active", "allowed before restart", 200)
	legacy := admin.request(t, "GET", files+"?pagination=auto&pageSize=50", nil, 200)
	if legacy["cursorPage"] != nil || legacy["pageSize"] != float64(50) {
		t.Fatalf("未重启即启用了分页设置: %v", legacy)
	}
	stop()
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	admin.base = "http://" + coordinator.Diagnostics().BoundAddress
	active := admin.request(t, "GET", endpoint, nil, 200)
	appView = admin.request(t, "GET", apps, nil, 200)
	if appView["revision"] != float64(1) || appView["defaults"].([]any)[0].(map[string]any)["app"] != "text" {
		t.Fatalf("重启后未保留默认应用: %v", appView)
	}
	for _, item := range appView["items"].([]any) {
		view := item.(map[string]any)
		if view["id"] == "markdown" && view["platform"] != "desktop" {
			t.Fatalf("重启后未保留应用平台: %v", view)
		}
	}
	if view := admin.request(t, "GET", icons, nil, 200); view["revision"] != float64(1) ||
		view["inherit"] != false || len(view["items"].([]any)) != 2 {
		t.Fatalf("重启后未保留自定义图标: %v", view)
	}
	admin.request(t, "PUT", icons, iconBody(1, false), 200)
	if empty := admin.request(t, "GET", icons+"/active", nil, 200)["items"].([]any); len(empty) != 0 {
		t.Fatalf("空自定义不应加载内置规则: %v", empty)
	}
	admin.request(t, "PUT", icons, iconBody(2, true), 200)
	if defaults := admin.request(t, "GET", icons+"/active", nil, 200)["items"].([]any); len(defaults) == 0 {
		t.Fatal("恢复内置规则未生效")
	}
	if active["pendingRestart"] != false || active["blobSchedulerAvailable"] != false || active["trashSchedulerAvailable"] != false {
		t.Fatalf("新实例未应用设置或越过部署调度权限: %v", active)
	}
	for name, expected := range overrides {
		if integer, ok := expected.(int); ok {
			expected = float64(integer)
		}
		if active["active"].(map[string]any)[name] != expected {
			t.Fatalf("重启后参数 %s 未生效: %v", name, active["active"])
		}
	}
	firstPage := admin.request(t, "GET", files+"?pagination=auto&pageSize=50", nil, 200)
	cursor := firstPage["cursorPage"].(map[string]any)["next"].(string)
	secondPage := admin.request(t, "GET", files+"?pagination=auto&pageSize=50&cursor="+cursor, nil, 200)
	numbered := admin.request(t, "GET", files+"?pagination=numbered&page=2&pageSize=50", nil, 200)
	if firstPage["pageSize"] != float64(1) || secondPage["pageSize"] != float64(1) || numbered["cursorPage"] != nil ||
		secondPage["items"].([]any)[0].(map[string]any)["id"] != numbered["items"].([]any)[0].(map[string]any)["id"] {
		t.Fatal("工作区上限、游标和旧链接不一致")
	}
	admin.request(t, "GET", files+"?pagination=auto&pageSize=50&sort=updated&cursor="+cursor, nil, 409)
	if blobs := admin.request(t, "GET", files+"/blob-reclamation", nil, 200); blobs["automatic"] != false {
		t.Fatal("部署已禁用调度，自动清理仍报告开启")
	}
	create("limit-reject", "12345", 413)
	create("limit-accept", "1234", 200)
	admin.request(t, "POST", files+"/trash/purge-preview", selection, 422)
	admin.request(t, "POST", files+"/trash/purge-preview", map[string]any{"scope": "selection", "ids": []string{first}}, 200)
	admin.request(t, "PUT", files+"/"+existing+"/text", map[string]any{"expectedRevision": 2, "text": "new"}, 200)
	history := admin.request(t, "GET", files+"/"+existing+"/versions", nil, 200)
	if history["historyEnabled"] != false || history["perFile"] != float64(2) || history["total"] != float64(2) {
		t.Fatalf("旧历史或版本保留规则不符: %v", history)
	}
	reset := admin.request(t, "PUT", endpoint, input(1, map[string]any{}), 200)
	if reset["revision"] != float64(2) || reset["pendingRestart"] != true ||
		len(reset["overrides"].(map[string]any)) != 0 || reset["configured"].(map[string]any)["textBytes"] != float64(64) {
		t.Fatalf("未恢复继承: %v", reset)
	}
}
