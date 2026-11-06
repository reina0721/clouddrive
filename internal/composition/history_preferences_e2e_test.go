package composition

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestHistoryPreferencesHTTPQuotaChangeAndAtomicPublication(t *testing.T) {
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
	payload := "iam:\n  local:\n    setupToken: " + setup + "\n" + strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "history.db")), "mode: development-anonymous", "mode: session", 1)
	payload = strings.Replace(payload, "files:\n", "files:\n  maxFileBytes: 16\n  quotaBytes: 24\n", 1)
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "retention-owner@clouddrive.test", "name": "版本保留验收", "password": password}, 200)
	base := "/native/files"
	original := owner.request(t, "GET", base+"/preferences/history", nil, 200)
	if original["enabled"] != true || original["maxVersions"] != float64(0) {
		t.Fatal("新账号没有沿用已有保留行为")
	}
	file := owner.request(t, "POST", base+"/text", map[string]string{"parentId": "", "name": "quota.txt", "key": "history-quota-fixture", "text": "firstbytes"}, 200)
	id := file["id"].(string)
	owner.request(t, "PUT", base+"/"+id+"/text", map[string]any{"expectedRevision": 1, "text": "abcdefghij"}, 200)
	rule := func(revision int, enabled bool, status int) map[string]any {
		return owner.request(t, "PUT", base+"/preferences/history", map[string]any{"revision": revision, "enabled": enabled, "extensions": []string{}, "maxVersions": 0}, status)
	}
	rule(0, false, 200)
	content := []byte("ABCDEFGHIJ")
	digest := sha256.Sum256(content)
	transfer := owner.request(t, "POST", base+"/transfers", map[string]any{"parentId": "", "name": "quota.txt", "key": "history-quota-transfer", "sizeBytes": len(content), "sha256": hex.EncodeToString(digest[:]), "expectedEntryId": id, "expectedContentRevision": 2}, 200)
	transferID := transfer["id"].(string)
	patch := func(chunkID string) {
		t.Helper()
		req, err := http.NewRequestWithContext(t.Context(), http.MethodPatch, owner.base+"/api/console/v1"+base+"/transfers/"+chunkID+"/data", bytes.NewReader(content))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", owner.base)
		req.Header.Set("Content-Type", "application/offset+octet-stream")
		req.Header.Set("X-CSRF-Token", owner.csrf)
		req.Header.Set("Tus-Resumable", "1.0.0")
		req.Header.Set("Upload-Offset", "0")
		for name, value := range owner.cookies {
			req.AddCookie(&http.Cookie{Name: name, Value: value})
		}
		response, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		_, readErr := io.Copy(io.Discard, response.Body)
		if err := errors.Join(readErr, response.Body.Close()); err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != 204 {
			t.Fatalf("真实分块失败: %d", response.StatusCode)
		}
	}
	patch(transferID)
	// admission关闭保留时可预留；发布前开启后，事务必须重核30>24而非沿用旧规则。
	rule(1, true, 200)
	owner.request(t, "POST", base+"/transfers/"+transferID+"/commit", nil, 409)
	versions := owner.request(t, "GET", base+"/"+id+"/versions", nil, 200)
	if versions["contentRevision"] != float64(2) || versions["total"] != float64(2) || versions["ownerUsedBytes"] != float64(20) {
		t.Fatal("失败发布改变了当前或历史")
	}
	pending := owner.request(t, "GET", base+"/transfers/"+transferID, nil, 200)
	if pending["offsetBytes"] != float64(10) {
		t.Fatal("失败发布丢失完整候选")
	}
	rule(2, false, 200)
	owner.request(t, "POST", base+"/transfers/"+transferID+"/commit", nil, 200)
	versions = owner.request(t, "GET", base+"/"+id+"/versions", nil, 200)
	if versions["contentRevision"] != float64(3) || versions["total"] != float64(2) || versions["ownerUsedBytes"] != float64(20) {
		t.Fatal("同一候选重试未使用新策略")
	}
	rule(2, true, 409)
	// 明确数量上限会淘汰旧关联；接近配额时仍应允许净占用不增长的覆盖。
	owner.request(t, "PUT", base+"/preferences/history", map[string]any{"revision": 3, "enabled": true, "extensions": []string{}, "maxVersions": 1}, 200)
	bounded := owner.request(t, "POST", base+"/transfers", map[string]any{"parentId": "", "name": "quota.txt", "key": "history-bounded-transfer", "sizeBytes": len(content), "sha256": hex.EncodeToString(digest[:]), "expectedEntryId": id, "expectedContentRevision": 3}, 200)
	second := owner.request(t, "POST", base+"/transfers", map[string]any{"parentId": "", "name": "quota.txt", "key": "history-bounded-second", "sizeBytes": len(content), "sha256": hex.EncodeToString(digest[:]), "expectedEntryId": id, "expectedContentRevision": 3}, 200)
	patch(bounded["id"].(string))
	patch(second["id"].(string))
	owner.request(t, "POST", base+"/transfers/"+bounded["id"].(string)+"/commit", nil, 200)
	owner.request(t, "POST", base+"/transfers/"+second["id"].(string)+"/commit", nil, 409)
	versions = owner.request(t, "GET", base+"/"+id+"/versions", nil, 200)
	if versions["contentRevision"] != float64(4) || versions["total"] != float64(2) || versions["ownerUsedBytes"] != float64(20) {
		t.Fatal("共享同一目标释放量的候选绕过CAS或丢失历史")
	}
	owner.request(t, "POST", base+"/transfers/"+second["id"].(string)+"/cancel", nil, 200)
	// 第二账号没有拥有者策略，也不能通过客户端传owner越权改写。
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "版本保留普通角色", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	otherPassword, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	owner.request(t, "POST", "/users", map[string]any{"email": "retention-other@clouddrive.test", "password": otherPassword, "name": "其他账号", "roleIds": []string{roleID}, "status": "active"}, 200)
	other := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	other.request(t, "GET", "/auth/csrf", nil, 200)
	other.request(t, "POST", "/auth/login", map[string]string{"email": "retention-other@clouddrive.test", "password": otherPassword}, 200)
	isolated := other.request(t, "GET", base+"/preferences/history", nil, 200)
	if isolated["revision"] != float64(0) || isolated["enabled"] != true {
		t.Fatal("账号策略没有隔离")
	}
	other.request(t, "PUT", base+"/preferences/history", map[string]any{"revision": 0, "enabled": false, "extensions": []string{}, "maxVersions": 1, "ownerId": file["ownerId"]}, 400)
}
