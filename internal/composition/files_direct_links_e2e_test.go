package composition

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

func directLinkRequest(t *testing.T, base, token, method, query string, headers http.Header, status int) (string, http.Header) {
	t.Helper()
	return publicFileContentRequest(t, base+"/api/v1/file-direct-links/"+token+query, method, headers, status)
}

func publicFileContentRequest(t *testing.T, address, method string, headers http.Header, status int) (string, http.Header) {
	t.Helper()
	req, err := http.NewRequestWithContext(t.Context(), method, address, nil)
	if err != nil {
		t.Fatal("不能构造直链请求")
	}
	for key, values := range headers {
		req.Header[key] = values
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal("直链请求失败")
	}
	content, readErr := io.ReadAll(response.Body)
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		t.Fatal("直链响应读取失败")
	}
	if response.StatusCode != status {
		t.Fatalf("直链状态码 = %d，预期 %d", response.StatusCode, status)
	}
	return string(content), response.Header
}

func verifyDirectLinks(t *testing.T, owner, other *consoleTestClient) {
	t.Helper()
	const files = "/native/files"
	const links = files + "/direct-links"
	const text = "direct-content"
	const edited = "new-current-content"
	folder := owner.request(t, "POST", files+"/folders", map[string]string{"parentId": "", "name": "直链测试目录"}, 200)["id"].(string)
	source := owner.request(t, "POST", files+"/text", map[string]string{"parentId": folder, "name": "直链原名.txt", "key": "direct-link-text-fixture", "text": text}, 200)["id"].(string)
	unsafe, err := uploadFileHTTP(t.Context(), owner, folder, "unsafe.html", "direct-link-unsafe-html", []byte("<script>document.write('unsafe')</script>"))
	if err != nil {
		t.Fatal(err)
	}
	request := map[string]any{"ids": []string{source, folder, unsafe.ID}}
	owner.request(t, "POST", links, request, 403, map[string]string{"X-CSRF-Token": ""})
	owner.request(t, "POST", links, map[string]any{"ids": []string{source, source}}, 422)
	oversized := make([]string, 11)
	for index := range oversized {
		oversized[index] = source
	}
	owner.request(t, "POST", links, map[string]any{"ids": oversized}, 400)
	response := owner.request(t, "POST", links, request, 200)
	rows := response["results"].([]any)
	link := rows[0].(map[string]any)["link"].(map[string]any)
	id, token := link["id"].(string), link["token"].(string)
	if rows[1].(map[string]any)["failure"] != "unavailable" || rows[2].(map[string]any)["entryId"] != unsafe.ID {
		t.Fatal("逐项返回直链和文件夹拒绝的顺序错误")
	}
	unsafeToken := rows[2].(map[string]any)["link"].(map[string]any)["token"].(string)
	reused := owner.request(t, "POST", links, map[string]any{"ids": []string{source}}, 200)["results"].([]any)[0].(map[string]any)["link"].(map[string]any)
	if reused["id"] != id || reused["token"] != token {
		t.Fatal("再次获取未复用原直链")
	}
	denied := other.request(t, "POST", links, map[string]any{"ids": []string{source}}, 200)["results"].([]any)[0].(map[string]any)
	if denied["failure"] != "unavailable" || denied["link"] != nil {
		t.Fatal("另一账号能够获取文件直链")
	}
	if listing := other.request(t, "GET", links, nil, 200); len(listing["items"].([]any)) != 0 {
		t.Fatal("另一账号列表暴露了直链")
	}
	other.request(t, "DELETE", links+"/"+id, nil, 404)

	data, headers := directLinkRequest(t, owner.base, token, "GET", "", nil, 200)
	if data != text || headers.Get("Content-Type") != "text/plain; charset=utf-8" || !strings.HasPrefix(headers.Get("Content-Disposition"), "inline") ||
		headers.Get("Cache-Control") != "private, no-store" || headers.Get("Referrer-Policy") != "no-referrer" ||
		headers.Get("X-Content-Type-Options") != "nosniff" || !strings.Contains(headers.Get("Content-Security-Policy"), "sandbox") {
		t.Fatal("匿名读取、安全类型或缓存头不符")
	}
	data, headers = directLinkRequest(t, owner.base, token, "HEAD", "?download=true", nil, 200)
	if data != "" || !strings.HasPrefix(headers.Get("Content-Disposition"), "attachment") || headers.Get("Content-Length") != "14" {
		t.Fatal("强制下载或 HEAD 的响应不符")
	}
	etag := headers.Get("ETag")
	directLinkRequest(t, owner.base, token, "GET", "", http.Header{"If-None-Match": {etag}}, 304)
	data, headers = directLinkRequest(t, owner.base, token, "GET", "", http.Header{"Range": {"bytes=0-5"}}, 206)
	if data != "direct" || headers.Get("Content-Range") != "bytes 0-5/14" {
		t.Fatal("直链部分读取不符")
	}
	directLinkRequest(t, owner.base, token, "GET", "", http.Header{"Range": {"bytes=90-100"}}, 416)
	_, headers = directLinkRequest(t, owner.base, unsafeToken, "GET", "", nil, 200)
	if headers.Get("Content-Type") != "application/octet-stream" || !strings.HasPrefix(headers.Get("Content-Disposition"), "attachment") {
		t.Fatal("主动内容可通过直链同源执行")
	}
	directLinkRequest(t, owner.base, "invalid", "GET", "", nil, 404)

	destination := owner.request(t, "POST", files+"/folders", map[string]string{"parentId": "", "name": "直链移动目标"}, 200)["id"].(string)
	owner.request(t, "PATCH", files+"/"+source, map[string]any{"name": "直链新名.txt", "parentId": destination}, 200)
	owner.request(t, "PUT", files+"/"+source+"/text", map[string]any{"text": edited, "expectedRevision": 1}, 200)
	data, _ = directLinkRequest(t, owner.base, token, "GET", "", http.Header{"If-None-Match": {etag}}, 200)
	if data != edited {
		t.Fatal("直链没有解析到当前版本")
	}
	owner.request(t, "POST", files+"/"+destination+"/trash", nil, 200)
	directLinkRequest(t, owner.base, token, "GET", "", nil, 404)
	listing := owner.request(t, "GET", links+"?page=1", nil, 200)
	found := false
	for _, item := range listing["items"].([]any) {
		row := item.(map[string]any)
		if row["id"] == id && row["active"] == false && row["name"] == "直链新名.txt" {
			found = true
		}
	}
	if !found {
		t.Fatal("回收中的直链未以暂停状态留在本人列表")
	}
	owner.request(t, "POST", files+"/"+destination+"/restore", map[string]any{}, 200)
	directLinkRequest(t, owner.base, token, "GET", "", nil, 200)
	owner.request(t, "DELETE", links+"/"+id, nil, 204)
	directLinkRequest(t, owner.base, token, "GET", "", nil, 404)
	reissued := owner.request(t, "POST", links, map[string]any{"ids": []string{source}}, 200)["results"].([]any)[0].(map[string]any)["link"].(map[string]any)
	newToken := reissued["token"].(string)
	if newToken == token || reissued["id"] == id {
		t.Fatal("撤销后重新生成复活了旧凭据")
	}
	owner.request(t, "DELETE", links+"/"+id, nil, 404)
	directLinkRequest(t, owner.base, newToken, "GET", "", nil, 200)
	owner.request(t, "POST", files+"/"+source+"/trash", nil, 200)
	purge := map[string]any{"scope": "selection", "ids": []string{source}}
	purge["snapshot"] = owner.request(t, "POST", files+"/trash/purge-preview", purge, 200)["snapshot"]
	owner.request(t, "POST", files+"/trash/purge", purge, 200)
	owner.request(t, "DELETE", links+"/"+reissued["id"].(string), nil, 404)
	directLinkRequest(t, owner.base, newToken, "GET", "", nil, 404)
}
