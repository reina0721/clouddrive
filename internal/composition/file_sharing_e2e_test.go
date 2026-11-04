package composition

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/idgen"
)

// publicShareRequest 使用无 Cookie 客户端，失败诊断不输出 capability URL 或票据。
func publicShareRequest(t *testing.T, base, method, path string, body any, grant string, status int, origins ...string) []byte {
	t.Helper()
	var payload []byte
	var err error
	if body != nil {
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	request, err := http.NewRequestWithContext(t.Context(), method, base+path, bytes.NewReader(payload))
	if err != nil {
		t.Fatal("无法构造分享测试请求")
	}
	request.Header.Set("Origin", base)
	if len(origins) > 0 {
		request.Header.Set("Origin", origins[0])
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if grant != "" {
		request.Header.Set("X-Share-Grant", grant)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("分享请求未完成，错误类型 %T", err)
	}
	result, readErr := io.ReadAll(response.Body)
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != status {
		t.Fatalf("分享请求返回 %d，预期 %d", response.StatusCode, status)
	}
	if status == http.StatusOK && !strings.Contains(response.Header.Get("Cache-Control"), "no-store") {
		t.Fatal("分享成功响应缺少禁止缓存策略")
	}
	return result
}

func TestFileSharingPublicPasswordScopeRevocationAndRestart(t *testing.T) {
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
	payload := "iam:\n  local:\n    setupToken: " + setup + "\n" + strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "shares.db")), "mode: development-anonymous", "mode: session", 1)
	payload += "files:\n  sharing:\n    attemptLimit: 2\n"
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "sharing-owner@clouddrive.test", "name": "分享验收", "password": password}, 200)
	root := owner.request(t, "POST", "/native/files/folders", map[string]string{"parentId": "", "name": "秘密目录名"}, 200)["id"].(string)
	file, err := uploadFileHTTP(t.Context(), owner, root, "shared.txt", "shared-file-upload-key", []byte("public authorized bytes"))
	if err != nil {
		t.Fatal(err)
	}
	outside, err := uploadFileHTTP(t.Context(), owner, "", "private.txt", "outside-file-upload-key", []byte("private bytes"))
	if err != nil {
		t.Fatal(err)
	}
	sharePassword, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	share := owner.request(t, "POST", "/native/files/shares", map[string]string{"rootId": root, "password": sharePassword}, 200)
	shareID := share["id"].(string)
	token := share["token"].(string)
	path := "/api/v1/file-shares/" + token
	locked := publicShareRequest(t, owner.base, "GET", path, nil, "", 200)
	if bytes.Contains(locked, []byte("秘密目录名")) || bytes.Contains(locked, []byte("ownerId")) || bytes.Contains(locked, []byte("objectKey")) {
		t.Fatal("上锁分享泄漏了私有元数据")
	}
	publicShareRequest(t, owner.base, "GET", path+"/content/"+file.ID, nil, "", 403)
	publicShareRequest(t, owner.base, "POST", path+"/unlock", map[string]string{"password": "incorrect"}, "", 403)
	publicShareRequest(t, owner.base, "POST", path+"/unlock", map[string]string{"password": sharePassword}, "", 403, "https://untrusted.example")
	unlock := publicShareRequest(t, owner.base, "POST", path+"/unlock", map[string]string{"password": sharePassword}, "", 200)
	var access struct {
		Ticket string `json:"ticket"`
	}
	if err := json.Unmarshal(unlock, &access); err != nil || access.Ticket == "" {
		t.Fatal("未签发访问票据")
	}
	publicShareRequest(t, owner.base, "POST", path+"/unlock", map[string]string{"password": sharePassword}, "", 429)
	// 第二名真实 IAM 用户即使有文件权限，也不能创建或撤销别人的分享。
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "Share users", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	owner.request(t, "POST", "/users", map[string]any{"email": "sharing-other@clouddrive.test", "name": "另一分享用户", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	other := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	other.request(t, "GET", "/auth/csrf", nil, 200)
	other.request(t, "POST", "/auth/login", map[string]string{"email": "sharing-other@clouddrive.test", "password": password}, 200)
	other.request(t, "POST", "/native/files/shares", map[string]string{"rootId": root}, 404)
	other.request(t, "POST", "/native/files/shares/"+shareID+"/revoke", nil, 404)
	// 无密码链接也必须以服务端时钟在准确到期后拒绝读取。
	shortExpiry := time.Now().UTC().Add(2 * time.Second)
	short := owner.request(t, "POST", "/native/files/shares", map[string]string{"rootId": file.ID, "expiresAt": shortExpiry.Format(time.RFC3339Nano)}, 200)
	shortPath := "/api/v1/file-shares/" + short["token"].(string)
	publicShareRequest(t, owner.base, "GET", shortPath, nil, "", 200)
	time.Sleep(time.Until(shortExpiry) + 10*time.Millisecond)
	publicShareRequest(t, owner.base, "GET", shortPath+"/content/"+file.ID, nil, "", 404)
	content := publicShareRequest(t, owner.base, "GET", path+"/content/"+file.ID, nil, access.Ticket, 200)
	if string(content) != "public authorized bytes" {
		t.Fatal("分享下载字节不一致")
	}
	publicShareRequest(t, owner.base, "GET", path+"/content/"+outside.ID, nil, access.Ticket, 404)
	publicShareRequest(t, owner.base, "GET", path+"/entries?parent="+outside.ID, nil, access.Ticket, 404)
	publicShareRequest(t, owner.base, "GET", "/api/v1/files/"+file.ID+"/content", nil, "", 401)
	listing := publicShareRequest(t, owner.base, "GET", path+"/entries", nil, access.Ticket, 200)
	if !bytes.Contains(listing, []byte("shared.txt")) || bytes.Contains(listing, []byte("private.txt")) {
		t.Fatal("分享目录范围错误")
	}
	owner.request(t, "POST", "/native/files/"+root+"/trash", nil, 200)
	publicShareRequest(t, owner.base, "GET", path, nil, access.Ticket, 404)
	owner.request(t, "POST", "/native/files/"+root+"/restore", map[string]any{}, 200)
	if err := coordinator.Stop(t.Context()); err != nil {
		t.Fatal(err)
	}
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	publicShareRequest(t, owner.base, "POST", path+"/unlock", map[string]string{"password": sharePassword}, "", 429)
	content = publicShareRequest(t, owner.base, "GET", path+"/content/"+file.ID, nil, access.Ticket, 200)
	if string(content) != "public authorized bytes" {
		t.Fatal("重启后分享或票据未持久化")
	}
	owner.request(t, "POST", "/native/files/shares/"+shareID+"/revoke", nil, 200)
	publicShareRequest(t, owner.base, "GET", path+"/content/"+file.ID, nil, access.Ticket, 404)
	expired := time.Now().UTC().Add(-time.Second).Format(time.RFC3339)
	owner.request(t, "POST", "/native/files/shares", map[string]string{"rootId": file.ID, "expiresAt": expired}, 422)
}
