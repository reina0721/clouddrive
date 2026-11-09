package composition

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/service"
)

func verifyWOPIView(t *testing.T, admin, observer *consoleTestClient) {
	t.Helper()
	const files = "/native/files"
	const applications = files + "/applications"
	const appID = "web-abcdef1234567890abcdef1234567890"
	const origin = "https://viewer.example.test"
	const action = origin + "/view"
	const fileName = "文档.MD"
	discovery := map[string]string{"endpoint": "http://127.0.0.1/hosting/discovery"}
	observer.request(t, "POST", applications+"/wopi-discovery", discovery, 403)
	admin.request(t, "POST", applications+"/wopi-discovery", discovery, 403, map[string]string{"X-CSRF-Token": ""})
	admin.request(t, "POST", applications+"/wopi-discovery", discovery, 422)

	view := admin.request(t, "GET", applications, nil, 200)
	app := map[string]any{
		"id": appID, "name": "文档阅读器", "urlTemplate": "", "extensions": []string{"md", "docx"},
		"enabled": true, "platform": "all", "maxBytes": 0, "newTab": false, "protocol": "wopi",
		"wopi": map[string]any{
			"discoveryUrl": origin + "/hosting/discovery",
			"actions":      []map[string]string{{"extension": "md", "url": action}, {"extension": "docx", "url": origin + "/document"}},
		},
	}
	update := map[string]any{"revision": view["revision"], "apps": []any{}, "webApps": []any{app},
		"defaults": []map[string]string{{"app": appID, "extension": "md"}},
	}
	app["extensions"] = []string{"md", "pdf"}
	admin.request(t, "PUT", applications, update, 422)
	app["extensions"] = []string{"md", "docx"}
	saved := admin.request(t, "PUT", applications, update, 200)
	active := observer.request(t, "GET", applications+"/active", nil, 200)
	if item := active["webItems"].([]any)[0].(map[string]any); item["protocol"] != "wopi" || item["wopi"] != nil {
		t.Fatal("活动策略未返回协议标记或暴露动作 URL")
	}

	source := admin.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": fileName, "text": "wopi", "key": "wopi-view-fixture"}, 200)
	entryID := source["id"].(string)
	endpoint := files + "/" + entryID + "/web-preview"
	request := map[string]any{"application": appID, "origin": origin, "contentRevision": 1}
	observer.request(t, "POST", endpoint, request, 404)
	launch := admin.request(t, "POST", endpoint, request, 200)
	wopi := launch["wopi"].(map[string]any)
	remaining := time.Until(time.UnixMilli(int64(wopi["expiresAtMilliseconds"].(float64))))
	if wopi["actionUrl"] != action || remaining <= 4*time.Minute || remaining > 5*time.Minute {
		t.Fatal("WOPI 未选择对应文件动作或有效期错误")
	}
	token := launch["token"].(string)
	filePath := admin.base + "/wopi/files/" + entryID
	query := "?access_token=" + token
	body, headers := publicFileContentRequest(t, filePath+query, "GET", nil, 200)
	var info service.WOPIFileInfo
	if err := json.Unmarshal([]byte(body), &info); err != nil {
		t.Fatal("WOPI 文件属性不是有效 JSON")
	}
	if info.BaseFileName != fileName || info.Size != 4 || info.Version != "1" || info.UserCanWrite ||
		!info.ReadOnly || info.SupportsUpdate || info.SupportsLocks || info.UserID == "" ||
		info.OwnerID != info.UserID || headers.Get("Cache-Control") != "private, no-store" {
		t.Fatal("WOPI 文件属性、只读能力或缓存限制不符")
	}
	body, headers = publicFileContentRequest(t, filePath+"/contents"+query, "GET", nil, 200)
	if body != "wopi" || headers.Get("X-WOPI-ItemVersion") != info.Version {
		t.Fatal("WOPI 内容及版本不符")
	}
	body, _ = publicFileContentRequest(t, filePath+"/contents"+query, "GET", http.Header{"Range": {"bytes=0-1"}}, 206)
	if body != "wo" {
		t.Fatal("WOPI 内容范围不符")
	}
	publicFileContentRequest(t, filePath+"/contents"+query, "GET", http.Header{"X-WOPI-MaxExpectedSize": {"3"}}, 412)
	publicFileContentRequest(t, filePath, "GET", nil, 401)
	publicFileContentRequest(t, filePath+"?access_token=invalid", "GET", nil, 401)
	publicFileContentRequest(t, admin.base+"/wopi/files/12345678-1234-1234-1234-1234567890ab"+query, "GET", nil, 404)
	publicFileContentRequest(t, admin.base+"/api/v1/file-web-previews/"+token, "GET", nil, 404)
	publicFileContentRequest(t, filePath+"/contents"+query, "POST", http.Header{"X-WOPI-Override": {"PUT"}}, 404)
	admin.request(t, "PUT", files+"/"+entryID+"/text", map[string]any{"text": "new", "expectedRevision": 1}, 200)
	publicFileContentRequest(t, filePath+query, "GET", nil, 404)
	publicFileContentRequest(t, filePath+"/contents"+query, "GET", nil, 404)
	request["contentRevision"] = 2
	next := admin.request(t, "POST", endpoint, request, 200)["token"].(string)
	update["revision"] = saved["revision"]
	app["enabled"] = false
	update["defaults"] = []any{}
	admin.request(t, "PUT", applications, update, 200)
	publicFileContentRequest(t, filePath+"?access_token="+next, "GET", nil, 404)
}
