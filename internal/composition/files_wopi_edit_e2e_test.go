package composition

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/reina0721/clouddrive/internal/module/files/service"
)

func verifyWOPIEdit(t *testing.T, admin *consoleTestClient) {
	t.Helper()
	const files = "/native/files"
	const apps = files + "/applications"
	const origin = "https://editor.example.test"
	const appID = "web-1234567890ab1234567890ab12345678"
	const filename = "wopi-save.md"
	application := map[string]any{
		"id": appID, "name": "WOPI 编辑器", "urlTemplate": "", "extensions": []string{"md"},
		"enabled": true, "platform": "all", "maxBytes": 0, "newTab": false, "protocol": "wopi",
		"wopi": map[string]any{"discoveryUrl": origin + "/hosting/discovery", "editEnabled": true,
			"actions": []map[string]string{{"extension": "md", "url": origin + "/view", "editUrl": origin + "/edit"}}},
	}
	current := admin.request(t, "GET", apps, nil, 200)
	update := map[string]any{"revision": current["revision"], "apps": []any{}, "webApps": []any{application}, "defaults": []any{}}
	saved := admin.request(t, "PUT", apps, update, 200)
	file := admin.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": filename, "text": "old", "key": "wopi-edit-fixture"}, 200)
	id := file["id"].(string)
	path := admin.base + "/wopi/files/" + id
	launch := func(mode string, revision int) map[string]any {
		t.Helper()
		request := map[string]any{"application": appID, "origin": origin, "contentRevision": revision}
		if mode != "" {
			request["mode"] = mode
		}
		return admin.request(t, "POST", files+"/"+id+"/web-preview", request, 200)
	}
	readOnly := launch("", 1)["token"].(string)
	editor := launch("edit", 1)
	token := editor["token"].(string)
	second := launch("edit", 1)["token"].(string)
	if editor["wopi"].(map[string]any)["actionUrl"] != origin+"/edit" {
		t.Fatal("编辑会话未选择编辑动作")
	}
	metadata, _ := publicFileContentRequest(t, path+"?access_token="+token, "GET", nil, 200)
	var info service.WOPIFileInfo
	if err := json.Unmarshal([]byte(metadata), &info); err != nil || !info.UserCanWrite ||
		info.ReadOnly || !info.SupportsLocks || !info.SupportsUpdate {
		t.Fatal("编辑会话未公布真实写能力")
	}
	call := func(access, operation, value, previous string, contents []byte, status int) http.Header {
		t.Helper()
		target := path
		if operation == "PUT" {
			target += "/contents"
		}
		request, err := http.NewRequestWithContext(t.Context(), "POST", target+"?access_token="+access, bytes.NewReader(contents))
		if err != nil {
			t.Fatal("无法构造 WOPI 请求")
		}
		request.Header.Set("X-WOPI-Override", operation)
		request.Header.Set("X-WOPI-Lock", value)
		if previous != "" {
			request.Header.Set("X-WOPI-OldLock", previous)
		}
		if operation == "PUT" {
			request.Header.Set("Content-Type", "application/octet-stream")
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal("WOPI 请求失败")
		}
		body, readErr := io.ReadAll(response.Body)
		if err := errors.Join(readErr, response.Body.Close()); err != nil {
			t.Fatal("读取 WOPI 响应失败")
		}
		if response.StatusCode != status {
			t.Fatalf("WOPI %s 状态 %d，预期 %d: %s", operation, response.StatusCode, status, body)
		}
		return response.Header
	}
	call(readOnly, "LOCK", "read-only", "", nil, 404)
	call(token, "LOCK", "", "", nil, 400)
	call(token, "GET_LOCK", "", "", nil, 200)
	call(token, "PUT", "editor-lock", "", []byte("blocked"), 409)
	connection := admin.request(t, "POST", files+"/connections", map[string]any{"name": "WOPI 互斥验收", "rootId": "", "readOnly": false, "blockSystemFiles": true}, 200)
	davToken := acquireDAVLock(t, admin, connection, filename, "0", 200)
	if got := call(token, "LOCK", "editor-lock", "", nil, 409).Get("X-WOPI-Lock"); got != "" {
		t.Fatal("外部 WOPI 读取了 WebDAV 状态凭据")
	}
	davRequest(t, admin, connection, "UNLOCK", filename, nil, map[string]string{"Lock-Token": davToken}, 204)
	call(token, "LOCK", "editor-lock", "", nil, 200)
	davRequest(t, admin, connection, "PUT", filename, strings.NewReader("blocked"), nil, 423)
	listed := admin.request(t, "GET", files+"/write-locks", nil, 200)["items"].([]any)
	if len(listed) != 1 || listed[0].(map[string]any)["protocol"] != "wopi" ||
		listed[0].(map[string]any)["wopiValue"] != nil {
		t.Fatal("写锁清单未正确呈现 WOPI 锁或暴露了客户端标识")
	}
	if got := call(token, "GET_LOCK", "", "", nil, 200).Get("X-WOPI-Lock"); got != "editor-lock" {
		t.Fatalf("读取锁返回 %q", got)
	}
	if got := call(second, "LOCK", "other", "", nil, 409).Get("X-WOPI-Lock"); got != "editor-lock" {
		t.Fatalf("争用返回锁 %q", got)
	}
	call(token, "REFRESH_LOCK", "editor-lock", "", nil, 200)
	call(token, "LOCK", "new-lock", "editor-lock", nil, 200)
	call(token, "UNLOCK", "editor-lock", "", nil, 409)
	admin.request(t, "PUT", files+"/"+id+"/text", map[string]any{"text": "parallel", "expectedRevision": 1}, 423)
	admin.request(t, "POST", files+"/"+id+"/trash", nil, 423)
	call(token, "PUT", "new-lock", "", make([]byte, service.MaxWOPIWriteBytes+1), 413)
	first := []byte{0, 1, 2, 255}
	if got := call(token, "PUT", "new-lock", "", first, 200).Get("X-WOPI-ItemVersion"); got != "2" {
		t.Fatal("第一次保存未返回版本")
	}
	body, _ := publicFileContentRequest(t, path+"/contents?access_token="+token, "GET", nil, 200)
	if !bytes.Equal([]byte(body), first) {
		t.Fatal("二进制内容未完整保存")
	}
	publicFileContentRequest(t, path+"?access_token="+readOnly, "GET", nil, 404)
	if got := call(token, "PUT", "new-lock", "", []byte("next"), 200).Get("X-WOPI-ItemVersion"); got != "3" {
		t.Fatal("同一会话第二次保存未返回版本")
	}
	history := admin.request(t, "GET", files+"/"+id+"/versions", nil, 200)
	if history["total"] != float64(3) {
		t.Fatal("版本历史未保留两次外部保存")
	}
	call(token, "UNLOCK", "new-lock", "", nil, 200)
	admin.request(t, "PUT", files+"/"+id+"/text", map[string]any{"text": "free", "expectedRevision": 3}, 200)
	reopened := launch("edit", 4)["token"].(string)
	call(reopened, "LOCK", "before-policy-change", "", nil, 200)
	update["revision"] = saved["revision"]
	application["enabled"] = false
	admin.request(t, "PUT", apps, update, 200)
	call(reopened, "PUT", "before-policy-change", "", []byte("blocked"), 404)
	admin.request(t, "PUT", files+"/"+id+"/text", map[string]any{"text": "free again", "expectedRevision": 4}, 200)
}
