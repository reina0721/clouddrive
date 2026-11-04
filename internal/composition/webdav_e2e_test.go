package composition

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
)

// davRequest 使用真实HTTP而非直接调用业务，验证特殊方法可穿过公共中间件。
func davRequest(t *testing.T, owner *consoleTestClient, credential map[string]any, method, path string, body io.Reader, headers map[string]string, expected int) ([]byte, http.Header) {
	t.Helper()
	req, err := http.NewRequestWithContext(t.Context(), method, owner.base+credential["endpointPath"].(string)+path, body)
	if err != nil {
		t.Fatal(err)
	}
	req.SetBasicAuth(credential["id"].(string), credential["password"].(string))
	for name, value := range headers {
		req.Header.Set(name, value)
	}
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("DAV请求失败，错误类型 %T", err)
	}
	result, readErr := io.ReadAll(response.Body)
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != expected {
		t.Fatalf("%s DAV状态 %d，预期 %d；响应 %s", method, response.StatusCode, expected, result)
	}
	return result, response.Header
}

func TestWebDAVConnectionsFilesAndRevocation(t *testing.T) {
	directory := t.TempDir()
	setup, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	configPath := filepath.Join(directory, "config.yaml")
	payload := "iam:\n  local:\n    setupToken: " + setup + "\n" + strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "dav.db")), "mode: development-anonymous", "mode: session", 1)
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "dav-owner@clouddrive.test", "name": "挂载验收", "password": password}, 200)
	root := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "授权目录", "parentId": ""}, 200)["id"].(string)
	create := func(name string, readonly bool) map[string]any {
		return owner.request(t, "POST", "/native/files/connections", map[string]any{"name": name, "rootId": root, "readOnly": readonly, "blockSystemFiles": true}, 200)
	}
	credential := create("真实协议连接", false)
	connectionPath := "/native/files/connections/" + credential["id"].(string)
	_, options := davRequest(t, owner, credential, "OPTIONS", "", nil, nil, 204)
	if options.Get("DAV") != "1" || strings.Contains(options.Get("Allow"), "LOCK") {
		t.Fatal("能力声明错误")
	}
	davRequest(t, owner, credential, "MKCOL", "folder", nil, nil, 201)
	davRequest(t, owner, credential, "MKCOL", "missing/child", nil, nil, 404)
	content := bytes.Repeat([]byte("actual-webdav-large-data"), (33<<20)/23+1)
	// 隐藏长度以验证真正分块的流式接收，而非依赖Content-Length或整包缓冲。
	davRequest(t, owner, credential, "PUT", "folder/"+url.PathEscape("测试 & #.bin"), struct{ io.Reader }{bytes.NewReader(content)}, nil, 201)
	downloaded, headers := davRequest(t, owner, credential, "GET", "folder/"+url.PathEscape("测试 & #.bin"), nil, nil, 200)
	if sha256.Sum256(downloaded) != sha256.Sum256(content) {
		t.Fatal("流式写入内容不一致")
	}
	partial, _ := davRequest(t, owner, credential, "GET", "folder/"+url.PathEscape("测试 & #.bin"), nil, map[string]string{"Range": "bytes=11-29"}, 206)
	if !bytes.Equal(partial, content[11:30]) {
		t.Fatal("范围下载错误")
	}
	davRequest(t, owner, credential, "HEAD", "folder/"+url.PathEscape("测试 & #.bin"), nil, nil, 200)
	davRequest(t, owner, credential, "GET", "folder/"+url.PathEscape("测试 & #.bin"), nil, map[string]string{"If-None-Match": headers.Get("ETag")}, 304)
	davRequest(t, owner, credential, "PUT", "folder/"+url.PathEscape("测试 & #.bin"), strings.NewReader("must-not-replace"), map[string]string{"If-Match": "\"obsolete\""}, 412)
	davRequest(t, owner, credential, "PUT", "folder/"+url.PathEscape("测试 & #.bin"), strings.NewReader("replaced"), map[string]string{"If-Match": headers.Get("ETag")}, 204)
	listing, _ := davRequest(t, owner, credential, "PROPFIND", "folder/", nil, map[string]string{"Depth": "1"}, 207)
	decodedListing, decodeErr := url.PathUnescape(string(listing))
	if decodeErr != nil || !strings.Contains(decodedListing, "测试") {
		t.Fatal("目录查询缺少UTF8文件")
	}
	destination := owner.base + credential["endpointPath"].(string) + "copy.bin"
	davRequest(t, owner, credential, "COPY", "folder/"+url.PathEscape("测试 & #.bin"), nil, map[string]string{"Destination": destination}, 201)
	davRequest(t, owner, credential, "COPY", "folder/"+url.PathEscape("测试 & #.bin"), nil, map[string]string{"Destination": destination, "Overwrite": "F"}, 412)
	davRequest(t, owner, credential, "MOVE", "copy.bin", nil, map[string]string{"Destination": owner.base + credential["endpointPath"].(string) + "moved.bin"}, 201)
	davRequest(t, owner, credential, "DELETE", "moved.bin", nil, nil, 204)
	trash := owner.request(t, "GET", "/native/files?trash=true", nil, 200)["items"].([]any)
	found := ""
	for _, item := range trash {
		entry := item.(map[string]any)
		if entry["name"] == "moved.bin" {
			found = entry["id"].(string)
		}
	}
	if found == "" {
		t.Fatal("DAV删除未进入网页回收站")
	}
	owner.request(t, "POST", "/native/files/"+found+"/restore", map[string]any{}, 200)
	davRequest(t, owner, credential, "GET", "moved.bin", nil, nil, 200)
	davRequest(t, owner, credential, "PUT", ".DS_Store", strings.NewReader("blocked"), nil, 403)
	// 网页已有点文件的子树不能通过COPY/MOVE绕过写入策略。
	dotFolder := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "with-system", "parentId": root}, 200)["id"].(string)
	owner.request(t, "POST", "/native/files/text", map[string]string{"name": ".system", "parentId": dotFolder, "text": "system", "key": "system-file-fixture"}, 200)
	davRequest(t, owner, credential, "COPY", "with-system", nil, map[string]string{"Destination": owner.base + credential["endpointPath"].(string) + "blocked-copy"}, 403)
	davRequest(t, owner, credential, "MOVE", "with-system", nil, map[string]string{"Destination": owner.base + credential["endpointPath"].(string) + "blocked-move"}, 403)
	davRequest(t, owner, credential, "PROPFIND", "with-system", nil, map[string]string{"Depth": "0"}, 207)
	davRequest(t, owner, credential, "COPY", "with-system", nil, map[string]string{"Destination": owner.base + credential["endpointPath"].(string) + "shallow", "Depth": "0"}, 201)
	davRequest(t, owner, credential, "GET", "shallow/.system", nil, nil, 404)
	verifyDAVAtomicReplacement(t, owner, credential)
	verifyDAVCanceledReplacement(t, owner, credential)
	davRequest(t, owner, credential, "GET", "../outside", nil, nil, 400)
	davRequest(t, owner, credential, "GET", "folder%2Fescape", nil, nil, 400)
	readonly := create("只读连接", true)
	davRequest(t, owner, readonly, "GET", "moved.bin", nil, nil, 200)
	davRequest(t, owner, readonly, "PUT", "blocked.txt", strings.NewReader("blocked"), nil, 403)
	davRequest(t, owner, credential, "COPY", "moved.bin", nil, map[string]string{"Destination": owner.base + readonly["endpointPath"].(string) + "cross.bin"}, 403)
	renamed := owner.request(t, "PATCH", connectionPath, map[string]any{"revision": credential["revision"], "name": "已重命名"}, 200)
	owner.request(t, "PATCH", connectionPath, map[string]any{"revision": credential["revision"], "name": "过时修改"}, 409)
	disabled := owner.request(t, "POST", connectionPath+"/state", map[string]any{"revision": renamed["revision"], "state": "disabled"}, 200)
	davRequest(t, owner, credential, "GET", "moved.bin", nil, nil, 401)
	enabled := owner.request(t, "POST", connectionPath+"/state", map[string]any{"revision": disabled["revision"], "state": "active"}, 200)
	rotated := owner.request(t, "POST", connectionPath+"/rotate", map[string]any{"revision": enabled["revision"]}, 200)
	davRequest(t, owner, credential, "GET", "moved.bin", nil, nil, 401)
	davRequest(t, owner, rotated, "GET", "moved.bin", nil, nil, 200)
	// 停止并重新装配真实服务，检查连接凭据和文件均持久。
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	stopErr := coordinator.Stop(ctx)
	cancel()
	if stopErr != nil {
		t.Fatal(stopErr)
	}
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	davRequest(t, owner, rotated, "GET", "moved.bin", nil, nil, 200)
	current := owner.request(t, "GET", connectionPath, nil, 200)
	if _, ok := current["password"]; ok {
		t.Fatal("普通读取泄露一次性密码")
	}
	revoked := owner.request(t, "POST", connectionPath+"/state", map[string]any{"revision": current["revision"], "state": "revoked"}, 200)
	davRequest(t, owner, rotated, "GET", "moved.bin", nil, nil, 401)
	owner.request(t, "POST", connectionPath+"/state", map[string]any{"revision": revoked["revision"], "state": "active"}, 409)
	verifyDAVCurrentAuthority(t, owner, root, password, filepath.Join(directory, "dav.db"))
}

// verifyDAVCanceledReplacement 验证客户端真正断开时，候选清理且原文件保持可用。
func verifyDAVCanceledReplacement(t *testing.T, owner *consoleTestClient, credential map[string]any) {
	t.Helper()
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	reader, writer := io.Pipe()
	defer func() {
		if err := errors.Join(reader.Close(), writer.Close()); err != nil {
			t.Error(err)
		}
	}()
	request, err := http.NewRequestWithContext(ctx, "PUT", owner.base+credential["endpointPath"].(string)+"atomic.txt", reader)
	if err != nil {
		t.Fatal(err)
	}
	request.SetBasicAuth(credential["id"].(string), credential["password"].(string))
	finished := make(chan error, 1)
	go func() {
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			finished <- err
			return
		}
		_, readErr := io.Copy(io.Discard, response.Body)
		closeErr := response.Body.Close()
		if response.StatusCode < 400 {
			finished <- errors.Join(errors.New("取消上传意外成功"), readErr, closeErr)
			return
		}
		finished <- errors.Join(readErr, closeErr)
	}()
	if _, err := writer.Write([]byte("canceled-prefix")); err != nil {
		t.Fatal(err)
	}
	active := func() bool {
		rows := owner.request(t, "GET", "/native/files/transfers?state=active", nil, 200)["items"].([]any)
		for _, row := range rows {
			if row.(map[string]any)["name"] == "atomic.txt" {
				return true
			}
		}
		return false
	}
	deadline := time.Now().Add(5 * time.Second)
	for !active() {
		if time.Now().After(deadline) {
			t.Fatal("取消候选未建立")
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	if err := writer.CloseWithError(context.Canceled); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-finished:
		if err != nil && !errors.Is(err, context.Canceled) {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("取消客户端未退出")
	}
	deadline = time.Now().Add(5 * time.Second)
	for active() {
		if time.Now().After(deadline) {
			t.Fatal("断开后候选未释放")
		}
		time.Sleep(10 * time.Millisecond)
	}
	content, _ := davRequest(t, owner, credential, "GET", "atomic.txt", nil, nil, 200)
	if string(content) != "newer-content" {
		t.Fatal("取消覆盖损坏原文件")
	}
}

// verifyDAVCurrentAuthority 验证凭据不会冻结创建时的权限和账号状态。
func verifyDAVCurrentAuthority(t *testing.T, owner *consoleTestClient, root, password, dbPath string) {
	t.Helper()
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "DAV members", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	created := owner.request(t, "POST", "/users", map[string]any{"email": "dav-member@clouddrive.test", "name": "挂载成员", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	member := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "dav-member@clouddrive.test", "password": password}, 200)
	// 有同等权限也不能借用另一个owner的目录或管理其凭据。
	member.request(t, "POST", "/native/files/connections", map[string]any{"name": "跨账号目录", "rootId": root, "readOnly": false, "blockSystemFiles": true}, 404)
	credential := member.request(t, "POST", "/native/files/connections", map[string]any{"name": "成员连接", "rootId": "", "readOnly": false, "blockSystemFiles": true}, 200)
	owner.request(t, "GET", "/native/files/connections/"+credential["id"].(string), nil, 404)
	davRequest(t, member, credential, "PUT", "member.txt", strings.NewReader("private"), nil, 201)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 2, "permissionKeys": []string{"files:read"}}, 200)
	davRequest(t, member, credential, "GET", "member.txt", nil, nil, 200)
	davRequest(t, member, credential, "PUT", "member.txt", strings.NewReader("denied"), nil, 403)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 3, "permissionKeys": []string{}}, 200)
	davRequest(t, member, credential, "GET", "member.txt", nil, nil, 401)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 4, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	user := created["user"].(map[string]any)
	user = owner.request(t, "GET", "/users/"+user["id"].(string), nil, 200)["user"].(map[string]any)
	owner.request(t, "PATCH", "/users/"+user["id"].(string)+"/status", map[string]any{"version": user["version"], "status": "disabled"}, 200)
	davRequest(t, member, credential, "GET", "member.txt", nil, nil, 401)
	// 只推进隔离测试库的过期字段，不操作用户运行库。
	expiring := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "过期边界", "rootId": root, "readOnly": false, "blockSystemFiles": true}, 200)
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = dbPath
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	updateErr := database.UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		return db.Table("files_connections").Where("id = ?", expiring["id"]).Update("expires_at", time.Now().UTC().Add(-time.Minute)).Error
	})
	if err := errors.Join(updateErr, resource.Close()); err != nil {
		t.Fatal(err)
	}
	davRequest(t, owner, expiring, "GET", "moved.bin", nil, nil, 401)
	limited := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "根目录失效", "rootId": root, "readOnly": false, "blockSystemFiles": true}, 200)
	owner.request(t, "POST", "/native/files/"+root+"/trash", nil, 200)
	davRequest(t, owner, limited, "GET", "moved.bin", nil, nil, 401)
}

// verifyDAVAtomicReplacement 让两个真实请求交错，失败的旧版本上传不得覆盖新内容。
func verifyDAVAtomicReplacement(t *testing.T, owner *consoleTestClient, credential map[string]any) {
	t.Helper()
	davRequest(t, owner, credential, "PUT", "atomic.txt", strings.NewReader("original"), nil, 201)
	reader, writer := io.Pipe()
	request, err := http.NewRequestWithContext(t.Context(), "PUT", owner.base+credential["endpointPath"].(string)+"atomic.txt", reader)
	if err != nil {
		t.Fatal(err)
	}
	request.SetBasicAuth(credential["id"].(string), credential["password"].(string))
	finished := make(chan error, 1)
	go func() {
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			finished <- err
			return
		}
		_, readErr := io.Copy(io.Discard, response.Body)
		closeErr := response.Body.Close()
		if response.StatusCode != 409 {
			finished <- errors.Join(errors.New("旧版本上传未拒绝"), readErr, closeErr)
			return
		}
		finished <- errors.Join(readErr, closeErr)
	}()
	defer func() {
		if err := errors.Join(reader.Close(), writer.Close()); err != nil {
			t.Error(err)
		}
	}()
	if _, err := writer.Write([]byte("stale-prefix")); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	receiving := false
	for !receiving && time.Now().Before(deadline) {
		rows := owner.request(t, "GET", "/native/files/transfers?state=active", nil, 200)["items"].([]any)
		for _, row := range rows {
			item := row.(map[string]any)
			if item["name"] == "atomic.txt" && item["state"] == "receiving" {
				receiving = true
			}
		}
		if !receiving {
			time.Sleep(10 * time.Millisecond)
		}
	}
	if !receiving {
		t.Fatal("流式候选未进入接收态")
	}
	davRequest(t, owner, credential, "PUT", "atomic.txt", strings.NewReader("newer-content"), nil, 204)
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-finished:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("旧上传未结束")
	}
	content, _ := davRequest(t, owner, credential, "GET", "atomic.txt", nil, nil, 200)
	if string(content) != "newer-content" {
		t.Fatal("失败候选损坏新版本")
	}
	active := owner.request(t, "GET", "/native/files/transfers?state=active", nil, 200)["items"].([]any)
	for _, row := range active {
		if row.(map[string]any)["name"] == "atomic.txt" {
			t.Fatal("失败上传未释放预留")
		}
	}
}
