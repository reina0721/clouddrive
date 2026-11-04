package composition

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestVersionsHTTPPersistencePrivacyAndAtomicity(t *testing.T) {
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
	payload := "iam:\n  local:\n    setupToken: " + setup + "\n" + strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "versions.db")), "mode: development-anonymous", "mode: session", 1)
	writeGenerationConfig(t, configPath, payload)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Error(err)
		}
	}()
	owner := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "annotation-owner@clouddrive.test", "name": "整理验收", "password": password}, 200)

	file := owner.request(t, "POST", "/native/files/text", map[string]string{"name": "version.txt", "parentId": "", "key": "version-http-fixture", "text": "old bytes"}, 200)["id"].(string)
	path := "/native/files/" + file
	owner.request(t, "PUT", path+"/text", map[string]any{"expectedRevision": 1, "text": "current"}, 200)
	read := func() map[string]any { return owner.request(t, "GET", path+"/versions", nil, 200) }
	initial := read()
	if initial["total"] != float64(2) || initial["contentRevision"] != float64(2) || initial["fileHistoryBytes"] != float64(9) {
		t.Fatal("版本列表或占用错误")
	}
	encoded, err := json.Marshal(initial)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "objectKey") || strings.Contains(string(encoded), "contentSHA") || strings.Contains(string(encoded), "history_json") {
		t.Fatal("版本DTO泄露内部存储字段")
	}
	raw := func(method, relative string, headers map[string]string, status int) ([]byte, http.Header) {
		t.Helper()
		req, err := http.NewRequestWithContext(t.Context(), method, owner.base+"/api/console/v1"+relative, nil)
		if err != nil {
			t.Fatal(err)
		}
		for key, value := range headers {
			req.Header.Set(key, value)
		}
		for key, value := range owner.cookies {
			req.AddCookie(&http.Cookie{Name: key, Value: value})
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		content, readErr := io.ReadAll(res.Body)
		if err = errors.Join(readErr, res.Body.Close()); err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != status {
			t.Fatalf("版本原始内容状态%d，预期%d", res.StatusCode, status)
		}
		return content, res.Header
	}
	content, headers := raw("GET", path+"/versions/1/content", map[string]string{"Range": "bytes=0-2"}, 206)
	if string(content) != "old" || headers.Get("Content-Range") != "bytes 0-2/9" {
		t.Fatal("历史字节范围错误")
	}
	content, headers = raw("HEAD", path+"/versions/1/content", nil, 200)
	if len(content) != 0 || headers.Get("Content-Length") != "9" {
		t.Fatal("历史HEAD错误")
	}
	if headers.Get("ETag") == "" {
		t.Fatal("历史内容缺少条件请求标识")
	}
	content, _ = raw("GET", path+"/versions/1/content", map[string]string{"If-None-Match": headers.Get("ETag")}, 304)
	if len(content) != 0 {
		t.Fatal("历史条件下载仍发送内容")
	}
	mutation := map[string]any{"expectedContentRevision": 2, "expectedHistoryRevision": 1}
	owner.request(t, "POST", path+"/versions/1/restore", map[string]any{"expectedContentRevision": 1, "expectedHistoryRevision": 1}, 409)
	owner.request(t, "POST", path+"/versions/1/restore", mutation, 200)
	promoted := read()
	if promoted["total"] != float64(2) || promoted["contentRevision"] != float64(3) || promoted["fileHistoryBytes"] != float64(7) {
		t.Fatal("恢复提升没有保留恢复前当前内容")
	}
	raw("GET", path+"/versions/1/content", nil, 404)
	content, _ = raw("GET", path+"/versions/3/content", nil, 200)
	if string(content) != "old bytes" {
		t.Fatal("恢复后内容错误")
	}
	copied := owner.request(t, "POST", path+"/versions/2/copy", map[string]string{"parentId": "", "name": "saved.txt"}, 200)
	copyPath := "/native/files/" + copied["id"].(string)
	if owner.request(t, "GET", copyPath+"/versions", nil, 200)["total"] != float64(1) {
		t.Fatal("另存新文件带入无关历史")
	}
	owner.request(t, "DELETE", path+"/versions", map[string]any{"mode": "selected", "revisions": []int{2, 3}, "expectedContentRevision": 3, "expectedHistoryRevision": 2}, 422)
	if read()["total"] != float64(2) {
		t.Fatal("失败删除部分生效")
	}
	credential := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "版本协议", "rootId": "", "readOnly": false, "blockSystemFiles": true}, 200)
	davRequest(t, owner, credential, "PUT", "version.txt", strings.NewReader("dav bytes"), nil, 204)
	if read()["total"] != float64(3) {
		t.Fatal("WebDAV PUT 未保存历史")
	}
	davRequest(t, owner, credential, "COPY", "saved.txt", nil, map[string]string{"Destination": owner.base + credential["endpointPath"].(string) + "version.txt", "Overwrite": "T"}, 204)
	if read()["total"] != float64(4) {
		t.Fatal("WebDAV COPY 覆盖未保存历史")
	}
	owner.request(t, "POST", path+"/trash", nil, 200)
	owner.request(t, "GET", path+"/versions", nil, 404)
	owner.request(t, "POST", path+"/restore", map[string]string{}, 200)
	if read()["total"] != float64(4) {
		t.Fatal("回收恢复丢失历史")
	}
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "版本成员", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	owner.request(t, "PUT", "/native/iam/roles/"+role["id"].(string)+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	owner.request(t, "POST", "/users", map[string]any{"email": "version-member@clouddrive.test", "name": "版本成员", "password": password, "roleIds": []string{role["id"].(string)}, "status": "active"}, 200)
	member := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "version-member@clouddrive.test", "password": password}, 200)
	member.request(t, "GET", path+"/versions", nil, 404)
	member.request(t, "POST", path+"/versions/2/copy", map[string]string{"name": "stolen.txt", "parentId": ""}, 404)
	stopCtx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	stopErr := coordinator.Stop(stopCtx)
	cancel()
	if stopErr != nil {
		t.Fatal(stopErr)
	}
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	persisted := read()
	if persisted["total"] != float64(4) || persisted["contentRevision"] != float64(5) {
		t.Fatal("重启丢失历史")
	}
	owner.request(t, "DELETE", path+"/versions", map[string]any{"mode": "all-history", "revisions": []int{}, "expectedContentRevision": 5, "expectedHistoryRevision": 4}, 200)
	if read()["total"] != float64(1) {
		t.Fatal("清空历史没有保留当前")
	}
}
