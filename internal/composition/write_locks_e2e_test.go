package composition

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

const exclusiveDAVLockXML = `<lockinfo xmlns="DAV:"><lockscope><exclusive/></lockscope><locktype><write/></locktype><owner><href>editor</href></owner></lockinfo>`

// writeLockServer 创建临时真实数据库；重装服务后继续使用同一数据库和账号。
func writeLockServer(t *testing.T) (*consoleTestClient, string, map[string]any, func()) {
	t.Helper()
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
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setup+"\n"+strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "locks.db")), "mode: development-anonymous", "mode: session", 1))
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "locks@clouddrive.test", "name": "锁验收", "password": password}, 200)
	root := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "locks", "parentId": ""}, 200)["id"].(string)
	connection := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "editor", "rootId": root, "readOnly": false, "blockSystemFiles": true}, 200)
	restart := func() {
		ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
		err := coordinator.Stop(ctx)
		cancel()
		if err != nil {
			t.Fatal(err)
		}
		coordinator, _ = newGenerationTestCoordinator(t, configPath)
		if err := coordinator.Start(t.Context()); err != nil {
			t.Fatal(err)
		}
		owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	}
	return owner, root, connection, restart
}

func acquireDAVLock(t *testing.T, owner *consoleTestClient, connection map[string]any, path, depth string, status int) string {
	t.Helper()
	_, headers := davRequest(t, owner, connection, "LOCK", path, strings.NewReader(exclusiveDAVLockXML), map[string]string{"Depth": depth}, status)
	if status == 200 || status == 201 {
		if headers.Get("Lock-Token") == "" {
			t.Fatal("新锁缺少状态令牌")
		}
	}
	return headers.Get("Lock-Token")
}

func lockConditions(token string) map[string]string {
	return map[string]string{"If": "(" + token + ")"}
}

func TestWebDAVPersistentLocksAndAllWriteEntrypoints(t *testing.T) {
	owner, root, connection, restart := writeLockServer(t)
	davRequest(t, owner, connection, "PUT", "note.txt", strings.NewReader("original"), nil, 201)
	davRequest(t, owner, connection, "PUT", "note.txt", strings.NewReader("second"), nil, 204)
	listing := owner.request(t, "GET", "/native/files?parent="+root, nil, 200)["items"].([]any)
	file := listing[0].(map[string]any)
	path := "/native/files/" + file["id"].(string)
	token := acquireDAVLock(t, owner, connection, "note.txt", "0", 200)
	acquireDAVLock(t, owner, connection, "note.txt", "0", 423)
	owner.request(t, "PUT", path+"/text", map[string]any{"expectedRevision": 2, "text": "blocked"}, 423)
	owner.request(t, "PATCH", path, map[string]any{"name": "blocked.txt"}, 423)
	owner.request(t, "PUT", path+"/annotations", map[string]any{"expectedRevision": 0, "tags": []any{}, "properties": []any{}, "emoji": "x", "folderColor": ""}, 423)
	versions := owner.request(t, "GET", path+"/versions", nil, 200)
	mutation := map[string]any{"expectedContentRevision": versions["contentRevision"], "expectedHistoryRevision": versions["historyRevision"]}
	owner.request(t, "POST", path+"/versions/1/restore", mutation, 423)
	owner.request(t, "DELETE", path+"/versions", map[string]any{"expectedContentRevision": versions["contentRevision"], "expectedHistoryRevision": versions["historyRevision"], "mode": "all-history", "revisions": []any{}}, 423)
	digest := sha256.Sum256([]byte("upload"))
	owner.request(t, "POST", "/native/files/transfers", map[string]any{"parentId": root, "name": "note.txt", "key": "locked-native-upload", "sizeBytes": 6, "sha256": hex.EncodeToString(digest[:]), "expectedEntryId": file["id"], "expectedContentRevision": 2}, 423)
	davRequest(t, owner, connection, "PUT", "note.txt", strings.NewReader("blocked"), nil, 423)
	other := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "other editor", "rootId": root, "readOnly": false, "blockSystemFiles": true}, 200)
	davRequest(t, owner, other, "PUT", "note.txt", strings.NewReader("foreign token"), lockConditions(token), 423)
	davRequest(t, owner, connection, "PUT", "note.txt", strings.NewReader("bad etag"), map[string]string{"If": "(" + token + ` ["stale"])`}, 412)
	davRequest(t, owner, connection, "PUT", "note.txt", strings.NewReader("authorized"), lockConditions(token), 204)
	properties, _ := davRequest(t, owner, connection, "PROPFIND", "note.txt", strings.NewReader(`<propfind xmlns="DAV:"><prop><supportedlock/><lockdiscovery/><displayname/><unknown/></prop></propfind>`), map[string]string{"Depth": "0"}, 207)
	for _, fragment := range []string{"supportedlock", "lockdiscovery", "displayname", "unknown", "exclusive", "activelock"} {
		if !strings.Contains(string(properties), fragment) {
			t.Fatal("属性增强遗漏已有或锁属性", fragment)
		}
	}
	// 分享访客拥有编辑权限，也必须通过同一个文件保存保护。
	permissions := service.SharePermissions{Browse: true, Preview: true, Download: true, Create: true, Modify: true}
	share := owner.request(t, "POST", "/native/files/shares", map[string]any{"rootId": root, "title": "locks", "permissions": permissions}, 200)
	publicShareRequest(t, owner.base, "PUT", "/api/v1/file-shares/"+share["token"].(string)+"/text/"+file["id"].(string), map[string]any{"revision": 3, "text": "visitor blocked"}, "", 423)
	before := owner.request(t, "GET", "/native/files/write-locks", nil, 200)["items"].([]any)[0].(map[string]any)
	_, headers := davRequest(t, owner, connection, "LOCK", "note.txt", nil, map[string]string{"If": "(" + token + ")", "Depth": "invalid-ignored", "Timeout": "Second-600"}, 200)
	if headers.Get("Lock-Token") != "" {
		t.Fatal("刷新不应返回新锁令牌头")
	}
	owner.request(t, "POST", "/native/files/write-locks/"+before["id"].(string)+"/release", map[string]any{"revision": before["revision"]}, 409)
	restart()
	davRequest(t, owner, connection, "PUT", "note.txt", strings.NewReader("restart blocked"), nil, 423)
	davRequest(t, owner, connection, "PUT", "note.txt", strings.NewReader("after restart"), lockConditions(token), 204)
	davRequest(t, owner, connection, "UNLOCK", "note.txt", nil, map[string]string{"Lock-Token": "<urn:uuid:missing>"}, 409)
	davRequest(t, owner, connection, "UNLOCK", "note.txt", nil, map[string]string{"Lock-Token": token}, 204)
	davRequest(t, owner, connection, "PUT", "note.txt", strings.NewReader("unlocked"), nil, 204)
	// 未映射文件加锁必须同时建立可下载的真实空文件，解锁不会删除它。
	emptyToken := acquireDAVLock(t, owner, connection, "new.txt", "0", 201)
	empty, _ := davRequest(t, owner, connection, "GET", "new.txt", nil, nil, 200)
	if len(empty) != 0 {
		t.Fatal("新锁文件不是空内容")
	}
	davRequest(t, owner, connection, "UNLOCK", "new.txt", nil, map[string]string{"Lock-Token": emptyToken}, 204)
	davRequest(t, owner, connection, "GET", "new.txt", nil, nil, 200)
	acquireDAVLock(t, owner, connection, "missing/new.txt", "0", 404)
}

func TestWebDAVFolderDepthNamespaceAndLockRevocation(t *testing.T) {
	owner, root, connection, _ := writeLockServer(t)
	davRequest(t, owner, connection, "MKCOL", "folder", nil, nil, 201)
	davRequest(t, owner, connection, "PUT", "folder/file.txt", strings.NewReader("content"), nil, 201)
	zero := acquireDAVLock(t, owner, connection, "folder", "0", 200)
	davRequest(t, owner, connection, "PUT", "folder/file.txt", strings.NewReader("member content allowed"), nil, 204)
	davRequest(t, owner, connection, "MKCOL", "folder/blocked", nil, nil, 423)
	davRequest(t, owner, connection, "DELETE", "folder/file.txt", nil, nil, 423)
	davRequest(t, owner, connection, "MKCOL", "folder/allowed", nil, map[string]string{"If": "<" + owner.base + connection["endpointPath"].(string) + "folder> (" + zero + ")"}, 201)
	davRequest(t, owner, connection, "UNLOCK", "folder", nil, map[string]string{"Lock-Token": zero}, 204)
	child := acquireDAVLock(t, owner, connection, "folder/file.txt", "0", 200)
	body, _ := davRequest(t, owner, connection, "LOCK", "folder", strings.NewReader(exclusiveDAVLockXML), map[string]string{"Depth": "infinity"}, 207)
	if !strings.Contains(string(body), "423 Locked") || !strings.Contains(string(body), "424 Failed Dependency") {
		t.Fatal("递归锁冲突未给出多状态回执")
	}
	destination := owner.base + connection["endpointPath"].(string)
	davRequest(t, owner, connection, "COPY", "folder/file.txt", nil, map[string]string{"Destination": destination + "copy.txt"}, 201)
	davRequest(t, owner, connection, "PUT", "copy.txt", strings.NewReader("copy is not locked"), nil, 204)
	davRequest(t, owner, connection, "MOVE", "folder/file.txt", nil, map[string]string{"Destination": destination + "moved.txt", "If": "(" + child + ")"}, 201)
	davRequest(t, owner, connection, "PUT", "moved.txt", strings.NewReader("move does not carry source lock"), nil, 204)
	if len(owner.request(t, "GET", "/native/files/write-locks", nil, 200)["items"].([]any)) != 0 {
		t.Fatal("旧URL锁仍残留")
	}
	infinity := acquireDAVLock(t, owner, connection, "folder", "infinity", 200)
	davRequest(t, owner, connection, "PUT", "folder/allowed/file.txt", strings.NewReader("blocked"), nil, 423)
	davRequest(t, owner, connection, "PUT", "folder/allowed/file.txt", strings.NewReader("allowed"), map[string]string{"If": "<" + destination + "folder> (" + infinity + ")"}, 201)
	// 范围更窄的连接看到继承锁时，属性明确403，不能泄漏范围外的根。
	folderID := ""
	for _, value := range owner.request(t, "GET", "/native/files?parent="+root, nil, 200)["items"].([]any) {
		entry := value.(map[string]any)
		if entry["name"] == "folder" {
			folderID = entry["id"].(string)
		}
	}
	childID := owner.request(t, "GET", "/native/files?parent="+folderID, nil, 200)["items"].([]any)[0].(map[string]any)["id"].(string)
	narrow := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "narrow", "rootId": childID, "readOnly": false, "blockSystemFiles": true}, 200)
	property, _ := davRequest(t, owner, narrow, "PROPFIND", "", strings.NewReader(`<propfind xmlns="DAV:"><prop><lockdiscovery/></prop></propfind>`), map[string]string{"Depth": "0"}, 207)
	if !strings.Contains(string(property), "403 Forbidden") || strings.Contains(string(property), "activelock") {
		t.Fatal("连接根外锁属性未正确遮蔽")
	}
	connectionPath := "/native/files/connections/" + connection["id"].(string)
	rotated := owner.request(t, "POST", connectionPath+"/rotate", map[string]any{"revision": connection["revision"]}, 200)
	davRequest(t, owner, rotated, "PUT", "folder/allowed/file.txt", strings.NewReader("old lock invalidated"), nil, 204)
	acquireDAVLock(t, owner, rotated, "folder", "infinity", 200)
	owner.request(t, "PATCH", connectionPath, map[string]any{"revision": rotated["revision"], "readOnly": true}, 200)
	if len(owner.request(t, "GET", "/native/files/write-locks", nil, 200)["items"].([]any)) != 0 {
		t.Fatal("只读后旧锁仍有效")
	}
	readonly := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "readonly", "rootId": root, "readOnly": true, "blockSystemFiles": true}, 200)
	acquireDAVLock(t, owner, readonly, "moved.txt", "0", 403)
}

func TestWebDAVLockAcquiredDuringUploadPreventsPublication(t *testing.T) {
	owner, _, connection, _ := writeLockServer(t)
	davRequest(t, owner, connection, "PUT", "race.txt", strings.NewReader("original"), nil, 201)
	reader, writer := io.Pipe()
	ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, "PUT", owner.base+connection["endpointPath"].(string)+"race.txt", reader)
	if err != nil {
		t.Fatal(err)
	}
	request.SetBasicAuth(connection["id"].(string), connection["password"].(string))
	finished := make(chan error, 1)
	var worker sync.WaitGroup
	worker.Add(1)
	go func() {
		defer worker.Done()
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			finished <- err
			return
		}
		_, readErr := io.Copy(io.Discard, response.Body)
		closeErr := response.Body.Close()
		if response.StatusCode != 423 {
			finished <- errors.Join(fmt.Errorf("发布状态%d，预期423", response.StatusCode), readErr, closeErr)
			return
		}
		finished <- errors.Join(readErr, closeErr)
	}()
	defer func() {
		if err := errors.Join(reader.Close(), writer.Close()); err != nil {
			t.Error(err)
		}
		cancel()
		worker.Wait()
	}()
	if _, err := writer.Write([]byte("receiving")); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		receiving := false
		for _, value := range owner.request(t, "GET", "/native/files/transfers?state=active", nil, 200)["items"].([]any) {
			entry := value.(map[string]any)
			if entry["name"] == "race.txt" && entry["state"] == "receiving" {
				receiving = true
			}
		}
		if receiving {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("候选未进入真实接收态")
		}
		time.Sleep(10 * time.Millisecond)
	}
	acquireDAVLock(t, owner, connection, "race.txt", "0", 200)
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-finished:
		if err != nil {
			t.Fatal(err)
		}
	case <-ctx.Done():
		t.Fatal("上传未结束")
	}
	content, _ := davRequest(t, owner, connection, "GET", "race.txt", nil, nil, 200)
	if string(content) != "original" {
		t.Fatal("锁准入后仍发布了旧候选")
	}
	if len(owner.request(t, "GET", "/native/files/transfers?state=active", nil, 200)["items"].([]any)) != 0 {
		t.Fatal("失败上传未释放预留")
	}
}

func TestWebDAVLockExpiryValidationAndDestinationScope(t *testing.T) {
	owner, _, connection, _ := writeLockServer(t)
	for _, name := range []string{"source.txt", "destination.txt"} {
		davRequest(t, owner, connection, "PUT", name, strings.NewReader(name), nil, 201)
	}
	endpoint := owner.base + connection["endpointPath"].(string)
	source := acquireDAVLock(t, owner, connection, "source.txt", "0", 200)
	destination := acquireDAVLock(t, owner, connection, "destination.txt", "0", 200)
	davRequest(t, owner, connection, "MOVE", "source.txt", nil, map[string]string{"Destination": endpoint + "destination.txt", "If": "(" + source + ")"}, 423)
	davRequest(t, owner, connection, "MOVE", "source.txt", nil, map[string]string{"Destination": endpoint + "destination.txt", "If": "<" + endpoint + "source.txt> (" + source + ") <" + endpoint + "destination.txt> (" + destination + ")"}, 204)
	davRequest(t, owner, connection, "PUT", "destination.txt", strings.NewReader("destination lock remains"), nil, 423)
	davRequest(t, owner, connection, "PUT", "destination.txt", strings.NewReader("destination authorized"), lockConditions(destination), 204)
	locks := owner.request(t, "GET", "/native/files/write-locks", nil, 200)["items"].([]any)
	if len(locks) != 1 {
		t.Fatal("MOVE复制了源锁或移除了目标锁")
	}
	lock := locks[0].(map[string]any)
	owner.request(t, "POST", "/native/files/write-locks/"+lock["id"].(string)+"/release", map[string]any{"revision": lock["revision"]}, 200)
	davRequest(t, owner, connection, "PUT", "destination.txt", strings.NewReader("owner released"), nil, 204)
	davRequest(t, owner, connection, "LOCK", "destination.txt", strings.NewReader(exclusiveDAVLockXML), map[string]string{"Depth": "1"}, 400)
	davRequest(t, owner, connection, "LOCK", "destination.txt", strings.NewReader(exclusiveDAVLockXML), map[string]string{"Content-Type": "text/plain"}, 400)
	davRequest(t, owner, connection, "LOCK", "destination.txt", strings.NewReader(strings.Replace(exclusiveDAVLockXML, "exclusive", "shared", 1)), nil, 501)
	davRequest(t, owner, connection, "LOCK", "destination.txt", strings.NewReader("<!DOCTYPE x>"+exclusiveDAVLockXML), nil, 400)
	davRequest(t, owner, connection, "LOCK", "destination.txt", strings.NewReader(`<lockinfo xmlns="DAV:"><lockscope><exclusive/></lockscope><locktype><write/></locktype><owner>`+strings.Repeat("x", 9000)+`</owner></lockinfo>`), nil, 413)
	davRequest(t, owner, connection, "LOCK", "destination.txt", strings.NewReader(exclusiveDAVLockXML), map[string]string{"Timeout": "Second-0"}, 400)
	davRequest(t, owner, connection, "LOCK", "destination.txt", strings.NewReader(exclusiveDAVLockXML), map[string]string{"Timeout": "Second-1"}, 200)
	davRequest(t, owner, connection, "PUT", "destination.txt", strings.NewReader("not expired"), nil, 423)
	time.Sleep(1100 * time.Millisecond)
	davRequest(t, owner, connection, "PUT", "destination.txt", strings.NewReader("expired"), nil, 204)
	if len(owner.request(t, "GET", "/native/files/write-locks", nil, 200)["items"].([]any)) != 0 {
		t.Fatal("到期锁仍显示有效")
	}
	acquireDAVLock(t, owner, connection, "destination.txt", "0", 200)
	owner.request(t, "POST", "/native/files/connections/"+connection["id"].(string)+"/state", map[string]any{"revision": connection["revision"], "state": "revoked"}, 200)
	if len(owner.request(t, "GET", "/native/files/write-locks", nil, 200)["items"].([]any)) != 0 {
		t.Fatal("撤销连接后旧锁仍有效")
	}
}

func TestWebDAVConcurrentExclusiveLockAndOwnerIsolation(t *testing.T) {
	owner, _, connection, _ := writeLockServer(t)
	davRequest(t, owner, connection, "PUT", "concurrent.txt", strings.NewReader("original"), nil, 201)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	type outcome struct {
		status int
		err    error
	}
	results := make(chan outcome, 2)
	var workers sync.WaitGroup
	for range 2 {
		workers.Add(1)
		go func() {
			defer workers.Done()
			request, err := http.NewRequestWithContext(ctx, "LOCK", owner.base+connection["endpointPath"].(string)+"concurrent.txt", strings.NewReader(exclusiveDAVLockXML))
			if err != nil {
				results <- outcome{err: err}
				return
			}
			request.SetBasicAuth(connection["id"].(string), connection["password"].(string))
			request.Header.Set("Content-Type", "application/xml")
			request.Header.Set("Depth", "0")
			response, err := http.DefaultClient.Do(request)
			if err != nil {
				results <- outcome{err: err}
				return
			}
			_, readErr := io.Copy(io.Discard, response.Body)
			results <- outcome{status: response.StatusCode, err: errors.Join(readErr, response.Body.Close())}
		}()
	}
	workers.Wait()
	close(results)
	success, conflict := 0, 0
	for result := range results {
		if result.err != nil {
			t.Fatal(result.err)
		}
		switch result.status {
		case 200:
			success++
		case 423:
			conflict++
		default:
			t.Fatal("并发锁返回意外状态", result.status)
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatal("并发独占申请未保持唯一有效锁")
	}
	locks := owner.request(t, "GET", "/native/files/write-locks", nil, 200)["items"].([]any)
	if len(locks) != 1 {
		t.Fatal("独占锁持久记录不唯一")
	}
	lock := locks[0].(map[string]any)
	for _, field := range []string{"token", "ownerXml", "ownerId", "password"} {
		if _, exists := lock[field]; exists {
			t.Fatal("原生列表泄漏协议或身份字段", field)
		}
	}
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "lock member", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	owner.request(t, "PUT", "/native/iam/roles/"+role["id"].(string)+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	owner.request(t, "POST", "/users", map[string]any{"email": "other-lock-owner@clouddrive.test", "name": "另一用户", "password": password, "roleIds": []string{role["id"].(string)}, "status": "active"}, 200)
	member := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "other-lock-owner@clouddrive.test", "password": password}, 200)
	if len(member.request(t, "GET", "/native/files/write-locks", nil, 200)["items"].([]any)) != 0 {
		t.Fatal("另一个用户读到私有锁")
	}
	member.request(t, "POST", "/native/files/write-locks/"+lock["id"].(string)+"/release", map[string]any{"revision": lock["revision"]}, 404)
	davRequest(t, owner, connection, "PUT", "concurrent.txt", strings.NewReader("still locked"), nil, 423)
	ack := owner.request(t, "POST", "/native/files/write-locks/"+lock["id"].(string)+"/release", map[string]any{"revision": lock["revision"]}, 200)
	if ack["released"] != true {
		t.Fatal("解除成功缺少明确JSON回执")
	}
}
