package composition

import (
	"net/http"
	"strings"
	"testing"
)

func verifyWebFilePreview(t *testing.T, admin, observer *consoleTestClient) {
	t.Helper()
	const files = "/native/files"
	const applications = files + "/applications"
	const origin = "https://viewer.example.test"
	const appID = "web-1234567890abcdef1234567890abcdef"
	const template = origin + "/read?file={$src}&name={$name}"
	view := admin.request(t, "GET", applications, nil, 200)
	app := map[string]any{
		"id": appID, "name": "  文档预览  ", "urlTemplate": template, "extensions": []string{" .MD "},
		"enabled": true, "platform": "desktop", "maxBytes": 100, "newTab": false,
	}
	update := map[string]any{
		"revision": view["revision"], "apps": []any{}, "webApps": []any{app},
		"defaults": []map[string]string{{"app": appID, "extension": "md"}},
	}
	observer.request(t, "PUT", applications, update, 403)
	for _, invalid := range []string{
		"http://viewer.example.test/read?file={$src}", origin + "/{$src}", origin + "/?file={$unknown}",
		"https://viewer.example.test@elsewhere.example.test/?file={$src}", origin + "/?file={$src}#fragment",
	} {
		app["urlTemplate"] = invalid
		admin.request(t, "PUT", applications, update, 422)
	}
	app["urlTemplate"] = template
	saved := admin.request(t, "PUT", applications, update, 200)
	admin.request(t, "PUT", applications, update, 409)
	if item := saved["webApps"].([]any)[0].(map[string]any); item["name"] != "文档预览" || item["origin"] != origin {
		t.Fatal("网页应用名称或目标没有规范化")
	}
	observer.request(t, "GET", applications, nil, 403)
	active := observer.request(t, "GET", applications+"/active", nil, 200)
	if item := active["webItems"].([]any)[0].(map[string]any); item["urlTemplate"] != nil || item["origin"] != origin || active["revision"] != nil {
		t.Fatal("活动策略不应公开 URL 模板或修订")
	}
	source := admin.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": "外部预览.md", "text": "view", "key": "web-preview-fixture"}, 200)
	entryID := source["id"].(string)
	endpoint := files + "/" + entryID + "/web-preview"
	grant := map[string]any{"application": appID, "origin": origin, "contentRevision": 1}
	observer.request(t, "POST", endpoint, grant, 404)
	admin.request(t, "POST", endpoint, grant, 403, map[string]string{"X-CSRF-Token": ""})
	grant["origin"] = "https://changed.example.test"
	admin.request(t, "POST", endpoint, grant, 409)
	grant["origin"] = origin
	launch := admin.request(t, "POST", endpoint, grant, 200)
	if launch["urlTemplate"] != template || launch["origin"] != origin || launch["name"] != "外部预览.md" {
		t.Fatal("启动未返回已确认的目标和文件")
	}
	token := launch["token"].(string)
	base := admin.base + "/api/v1/file-web-previews/"
	body, headers := publicFileContentRequest(t, base+token, "GET", http.Header{"Origin": {origin}, "Range": {"bytes=0-2"}}, 206)
	if body != "vie" || headers.Get("Access-Control-Allow-Origin") != origin ||
		headers.Get("Content-Range") != "bytes 0-2/4" ||
		headers.Get("Cache-Control") != "private, no-store" ||
		!strings.HasPrefix(headers.Get("Content-Disposition"), "attachment") {
		t.Fatal("授权内容、允许来源、范围或响应保护错误")
	}
	_, headers = publicFileContentRequest(t, base+token, "HEAD", http.Header{"Origin": {"https://elsewhere.example.test"}}, 200)
	if headers.Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("其他站点获得浏览器跨域读取权限")
	}
	publicFileContentRequest(t, base+"invalid", "GET", nil, 404)
	admin.request(t, "PUT", files+"/"+entryID+"/text", map[string]any{"text": "new", "expectedRevision": 1}, 200)
	publicFileContentRequest(t, base+token, "GET", nil, 404)
	admin.request(t, "POST", endpoint, grant, 409)
	grant["contentRevision"] = 2
	newToken := admin.request(t, "POST", endpoint, grant, 200)["token"].(string)
	update["revision"] = saved["revision"]
	app["enabled"] = false
	update["defaults"] = []any{}
	saved = admin.request(t, "PUT", applications, update, 200)
	admin.request(t, "POST", endpoint, grant, 404)
	publicFileContentRequest(t, base+newToken, "GET", nil, 404)
	update["revision"] = saved["revision"]
	app["enabled"], app["maxBytes"] = true, 1
	admin.request(t, "PUT", applications, update, 200)
	admin.request(t, "POST", endpoint, grant, 413)
}
