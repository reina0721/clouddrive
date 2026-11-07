package composition

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestStoragePolicyUsageAndUploadRestart(t *testing.T) {
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
	setup, password := generate(), generate()
	config := strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "storage-policy.db")),
		"mode: development-anonymous", "mode: session", 1)
	config = strings.Replace(config, "files:\n", "files:\n  maxFileBytes: 64\n", 1)
	config = strings.Replace(config, "  transfers:\n", "  transfers:\n    chunkBytes: 8\n", 1)
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setup+"\n"+config)
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
	const files = "/native/files"
	const policy = files + "/storage-policy"
	admin := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	admin.request(t, "GET", "/auth/csrf", nil, 200)
	admin.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "storage-admin@clouddrive.test", "name": "存储管理验收", "password": password}, 200)
	anonymous := &consoleTestClient{base: admin.base, cookies: map[string]string{}}
	anonymous.request(t, "GET", policy+"/usage", nil, 401)
	role := admin.request(t, "POST", "/roles", map[string]any{"name": "Storage observers", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	admin.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:storage-policy:read"}}, 200)
	admin.request(t, "POST", "/users", map[string]any{"email": "storage-observer@clouddrive.test", "name": "存储观察员", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	observer := &consoleTestClient{base: admin.base, cookies: map[string]string{}}
	observer.request(t, "GET", "/auth/csrf", nil, 200)
	observer.request(t, "POST", "/auth/login", map[string]string{"email": "storage-observer@clouddrive.test", "password": password}, 200)
	observed := observer.request(t, "GET", policy, nil, 200)
	if observed["backend"] != "local" || observed["canSave"] != false || observed["revision"] != float64(0) {
		t.Fatalf("默认后端和读权限错误: %v", observed)
	}
	if raw := audienceHTTP(t, observer, "GET", "/api/console/v1"+policy, nil, 200); bytes.Contains(raw, []byte(directory)) || bytes.Contains(raw, []byte(setup)) {
		t.Fatal("策略响应暴露部署目录或凭据")
	}
	input := func(revision int, overrides map[string]any) map[string]any {
		return map[string]any{"revision": revision, "overrides": overrides}
	}
	observer.request(t, "PUT", policy, input(0, map[string]any{}), 403)
	admin.request(t, "PUT", policy, input(0, map[string]any{"chunkBytes": 9}), 422)
	admin.request(t, "PUT", policy, input(0, map[string]any{"maxFileBytes": 65}), 422)
	create := func(name, text string, status int) map[string]any {
		t.Helper()
		return admin.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": name + ".txt", "key": generate(), "text": text}, status)
	}
	source := create("source", "old", 200)["id"].(string)
	admin.request(t, "POST", files+"/"+source+"/copy", map[string]string{"parentId": "", "name": "copy.txt"}, 200)
	admin.request(t, "PUT", files+"/"+source+"/text", map[string]any{"expectedRevision": 1, "text": "new!"}, 200)
	pending := create("pending", "purge", 200)["id"].(string)
	admin.request(t, "POST", files+"/"+pending+"/trash", nil, 200)
	purge := map[string]any{"scope": "selection", "ids": []string{pending}}
	purge["snapshot"] = admin.request(t, "POST", files+"/trash/purge-preview", purge, 200)["snapshot"]
	admin.request(t, "POST", files+"/trash/purge", purge, 200)
	usage := observer.request(t, "GET", policy+"/usage", nil, 200)
	for key, expected := range map[string]int{"blobCount": 2, "blobBytes": 7, "currentReferences": 2, "historyReferences": 1, "pendingCount": 1, "pendingBytes": 5} {
		if usage[key] != float64(expected) {
			t.Fatalf("Blob 统计不一致: %s=%v，预期 %d", key, usage[key], expected)
		}
	}
	content := []byte("original")
	digest := sha256.Sum256(content)
	createTransfer := func(name, key string, status int) map[string]any {
		t.Helper()
		return admin.request(t, "POST", files+"/transfers", map[string]any{
			"parentId": "", "name": name, "key": key, "sizeBytes": len(content), "sha256": hex.EncodeToString(digest[:]),
		}, status)
	}
	retainedKey := generate()
	transfer := createTransfer("retained.bin", retainedKey, 200)["id"].(string)
	patch := func(start, end, status int) {
		t.Helper()
		transferBytes(t, admin, "PATCH", "/files/transfers/"+transfer+"/data", content[start:end], map[string]string{
			"Content-Type": "application/offset+octet-stream", "Tus-Resumable": "1.0.0", "Upload-Offset": strconv.Itoa(start),
		}, status)
	}
	patch(0, 2, 204)
	saved := admin.request(t, "PUT", policy, input(0, map[string]any{"maxFileBytes": 4, "chunkBytes": 2}), 200)
	if saved["pendingRestart"] != true || saved["active"].(map[string]any)["maxFileBytes"] != float64(64) {
		t.Fatal("保存提前改变了生效限额")
	}
	admin.request(t, "PUT", policy, input(0, map[string]any{}), 409)
	admin.request(t, "PUT", files+"/settings", input(0, map[string]any{"textBytes": 16}), 200)
	stop()
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	admin.base = "http://" + coordinator.Diagnostics().BoundAddress
	active := admin.request(t, "GET", policy, nil, 200)
	if active["pendingRestart"] != false || active["active"].(map[string]any)["maxFileBytes"] != float64(4) ||
		active["active"].(map[string]any)["chunkBytes"] != float64(2) {
		t.Fatal("限额未在新实例统一生效")
	}
	if settings := admin.request(t, "GET", files+"/settings", nil, 200); settings["active"].(map[string]any)["textBytes"] != float64(16) {
		t.Fatal("存储策略与文件系统设置互相覆盖")
	}
	create("under-limit", "1234", 200)
	create("too-large", "12345", 413)
	createTransfer("over-limit.bin", generate(), 413)
	if replay := createTransfer("retained.bin", retainedKey, 200); replay["id"] != transfer || replay["offsetBytes"] != float64(2) {
		t.Fatal("现有限额阻断了旧会话的幂等重放")
	}
	patch(2, 5, 413)
	patch(2, 4, 204)
	patch(4, 6, 204)
	patch(6, 8, 204)
	completed := admin.request(t, "POST", files+"/transfers/"+transfer+"/commit", nil, 200)
	if completed["state"] != "completed" || completed["entryId"] == "" {
		t.Fatal("重启后旧暂存未能发布")
	}
	reset := admin.request(t, "PUT", policy, input(1, map[string]any{"chunkBytes": 2}), 200)
	if reset["configured"].(map[string]any)["maxFileBytes"] != float64(64) ||
		reset["configured"].(map[string]any)["chunkBytes"] != float64(2) {
		t.Fatal("未单独恢复默认限额")
	}
}
