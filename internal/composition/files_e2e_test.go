package composition

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// uploadFileHTTP 通过唯一的分块协议覆盖 Cookie/CSRF、内容校验及最终发布。
func uploadFileHTTP(ctx context.Context, client *consoleTestClient, parent, name, key string, content []byte) (entry model.Entry, resultErr error) {
	digest := sha256.Sum256(content)
	keyDigest := sha256.Sum256([]byte(key))
	payload, err := json.Marshal(map[string]any{"parentId": parent, "name": name, "key": hex.EncodeToString(keyDigest[:]), "sizeBytes": len(content), "sha256": hex.EncodeToString(digest[:])})
	if err != nil {
		return entry, err
	}
	var transfer struct {
		ID          string `json:"id"`
		State       string `json:"state"`
		OffsetBytes int    `json:"offsetBytes"`
		EntryID     string `json:"entryId"`
	}
	call := func(method, suffix, mediaType string, body []byte, offset int, output any) error {
		request, err := http.NewRequestWithContext(ctx, method, client.base+"/api/console/v1/native/files"+suffix, bytes.NewReader(body))
		if err != nil {
			return err
		}
		request.Header.Set("Origin", client.base)
		request.Header.Set("Content-Type", mediaType)
		if method == http.MethodPatch {
			request.Header.Set("Tus-Resumable", "1.0.0")
			request.Header.Set("Upload-Offset", strconv.Itoa(offset))
		}
		request.Header.Set("X-CSRF-Token", client.csrf)
		for name, value := range client.cookies {
			request.AddCookie(&http.Cookie{Name: name, Value: value})
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			return err
		}
		var readErr error
		if response.StatusCode != 200 && response.StatusCode != 204 {
			readErr = fmt.Errorf("file transfer returned %d", response.StatusCode)
		} else if output != nil {
			readErr = json.NewDecoder(response.Body).Decode(output)
		} else {
			_, readErr = io.Copy(io.Discard, response.Body)
		}
		return errors.Join(readErr, response.Body.Close())
	}
	if err := call("POST", "/transfers", "application/json", payload, 0, &transfer); err != nil {
		return entry, err
	}
	if transfer.State != "completed" {
		for transfer.OffsetBytes < len(content) {
			end := min(transfer.OffsetBytes+(4<<20), len(content))
			if err := call("PATCH", "/transfers/"+transfer.ID+"/data", "application/offset+octet-stream", content[transfer.OffsetBytes:end], transfer.OffsetBytes, nil); err != nil {
				return entry, err
			}
			transfer.OffsetBytes = end
		}
		if err := call("POST", "/transfers/"+transfer.ID+"/commit", "application/json", nil, 0, &transfer); err != nil {
			return entry, err
		}
	}
	var detail struct {
		Entry model.Entry `json:"entry"`
	}
	err = call("GET", "/"+transfer.EntryID, "application/json", nil, 0, &detail)
	return detail.Entry, err
}
func TestFilesHTTPConcurrentUploadsOwnershipRestartAndStorageGuard(t *testing.T) {
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	token, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	payload := "iam:\n  local:\n    setupToken: " + token + "\n" + strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "files.db")), "mode: development-anonymous", "mode: session", 1)
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": token, "email": "files-owner@clouddrive.test", "name": "文件管理员", "password": password}, 200)
	listing := owner.request(t, "GET", "/native/files", nil, 200)
	if len(listing["items"].([]any)) != 0 {
		t.Fatal("new file namespace not empty")
	}
	folder := owner.request(t, "POST", "/native/files/folders", map[string]string{"parentId": "", "name": "测试目录"}, 200)
	folderID := folder["id"].(string)
	var wg sync.WaitGroup
	results := make(chan struct {
		entry model.Entry
		err   error
	}, 2)
	for _, name := range []string{"one.txt", "two.txt"} {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			entry, err := uploadFileHTTP(t.Context(), owner, folderID, name, "file-upload-stable-"+name, []byte("verified bytes"))
			results <- struct {
				entry model.Entry
				err   error
			}{entry, err}
		}(name)
	}
	wg.Wait()
	close(results)
	entries := []model.Entry{}
	for result := range results {
		if result.err != nil {
			t.Fatal(result.err)
		}
		entries = append(entries, result.entry)
	}
	retry, err := uploadFileHTTP(t.Context(), owner, folderID, entries[0].Name, "file-upload-stable-"+entries[0].Name, []byte("verified bytes"))
	if err != nil || retry.ID != entries[0].ID {
		t.Fatalf("HTTP idempotent upload: %v", err)
	}
	owner.request(t, "POST", "/native/files/folders", map[string]string{"parentId": "", "name": "测试目录"}, 409)
	empty, err := uploadFileHTTP(t.Context(), owner, folderID, "empty.txt", "empty-file-upload-key", nil)
	if err != nil || empty.SizeBytes != 0 {
		t.Fatalf("empty file upload: %v", err)
	}
	owner.request(t, "GET", "/native/files/"+empty.ID+"/content", nil, 200)
	// 原生路由同样要求 CSRF，不能靠绕开 console 投影提交写请求。
	unsafe, err := http.NewRequestWithContext(t.Context(), "POST", owner.base+"/api/v1/files/folders", strings.NewReader(`{"name":"unsafe","parentId":""}`))
	if err != nil {
		t.Fatal(err)
	}
	unsafe.Header.Set("Origin", owner.base)
	unsafe.Header.Set("Content-Type", "application/json")
	for name, value := range owner.cookies {
		unsafe.AddCookie(&http.Cookie{Name: name, Value: value})
	}
	denied, err := http.DefaultClient.Do(unsafe)
	if err != nil {
		t.Fatal(err)
	}
	if err := denied.Body.Close(); err != nil {
		t.Fatal(err)
	}
	if denied.StatusCode != 403 {
		t.Fatalf("missing CSRF accepted: %d", denied.StatusCode)
	}
	// 建立第二个真实 IAM 用户，授予文件权限后仍不能越过对象 owner。
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "File users", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	owner.request(t, "POST", "/users", map[string]any{"email": "files-other@clouddrive.test", "name": "另一个用户", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	other := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	other.request(t, "GET", "/auth/csrf", nil, 200)
	other.request(t, "POST", "/auth/login", map[string]string{"email": "files-other@clouddrive.test", "password": password}, 200)
	other.request(t, "GET", "/native/files/"+entries[0].ID, nil, 404)
	other.request(t, "POST", "/native/files/"+entries[0].ID+"/trash", nil, 404)
	owner.request(t, "POST", "/native/files/"+folderID+"/trash", nil, 200)
	owner.request(t, "GET", "/native/files/"+entries[0].ID+"/content", nil, 404)
	owner.request(t, "POST", "/native/files/"+folderID+"/restore", map[string]string{}, 200)
	download := func() {
		t.Helper()
		request, err := http.NewRequestWithContext(t.Context(), "GET", owner.base+"/api/console/v1/native/files/"+entries[0].ID+"/content", nil)
		if err != nil {
			t.Fatal(err)
		}
		for name, value := range owner.cookies {
			request.AddCookie(&http.Cookie{Name: name, Value: value})
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		content, readErr := io.ReadAll(response.Body)
		closeErr := response.Body.Close()
		if response.StatusCode != 200 || readErr != nil || closeErr != nil || string(content) != "verified bytes" {
			t.Fatalf("download integrity: status=%d errors=%v", response.StatusCode, errors.Join(readErr, closeErr))
		}
	}
	download()
	issued := owner.request(t, "POST", "/native/files/direct-links", map[string]any{"ids": []string{entries[0].ID}}, 200)
	retainedLink := issued["results"].([]any)[0].(map[string]any)["link"].(map[string]any)["token"].(string)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	if err := coordinator.Stop(ctx); err != nil {
		cancel()
		t.Fatal(err)
	}
	cancel()
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	download()
	if data, _ := directLinkRequest(t, owner.base, retainedLink, "GET", "", nil, 200); data != "verified bytes" {
		t.Fatal("重启后持久直链不可读取")
	}
	changed := strings.Replace(payload, filepath.ToSlash(filepath.Join(directory, "storage")), filepath.ToSlash(filepath.Join(directory, "different-storage")), 1)
	if changed == payload {
		t.Fatal("storage configuration anchor missing")
	}
	writeGenerationConfig(t, configPath, changed)
	if _, err := coordinator.Reload(t.Context()); err == nil {
		t.Fatal("changed storage location accepted with existing files")
	}
	download()
	other.base = owner.base
	t.Run("回收站事务删除", func(t *testing.T) { verifyTrashPurge(t, owner, other) })
	t.Run("直链授权与内容", func(t *testing.T) { verifyDirectLinks(t, owner, other) })
	t.Run("直链复核拥有者当前权限", func(t *testing.T) {
		const files = "/native/files"
		source := other.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": "owner-read.txt", "key": "direct-owner-read-fixture", "text": "owner permission"}, 200)["id"].(string)
		result := other.request(t, "POST", files+"/direct-links", map[string]any{"ids": []string{source}}, 200)
		token := result["results"].([]any)[0].(map[string]any)["link"].(map[string]any)["token"].(string)
		directLinkRequest(t, owner.base, token, "GET", "", nil, 200)
		owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 2, "permissionKeys": []string{"files:write"}}, 200)
		directLinkRequest(t, owner.base, token, "GET", "", nil, 404)
	})
}

func verifyTrashPurge(t *testing.T, owner, other *consoleTestClient) {
	t.Helper()
	const files = "/native/files"
	const previewPath = files + "/trash/purge-preview"
	const purgePath = files + "/trash/purge"
	folder := owner.request(t, "POST", files+"/folders", map[string]string{"parentId": "", "name": "待永久删除目录"}, 200)["id"].(string)
	owner.request(t, "POST", files+"/pins", map[string]any{"targetKind": "folder", "targetId": folder, "revision": 0}, 200)
	file := owner.request(t, "POST", files+"/text", map[string]string{"parentId": folder, "name": "original.txt", "key": "purge-fixture-original-text", "text": "original"}, 200)["id"].(string)
	owner.request(t, "PUT", files+"/"+file+"/text", map[string]any{"expectedRevision": 1, "text": "new"}, 200)
	copyID := owner.request(t, "POST", files+"/"+file+"/copy", map[string]string{"parentId": "", "name": "retained-copy.txt"}, 200)["id"].(string)
	originalQuota := owner.request(t, "GET", files, nil, 200)["usedBytes"].(float64)
	selection := map[string]any{"scope": "selection", "ids": []string{folder, file}}
	owner.request(t, "POST", previewPath, selection, 409)
	owner.request(t, "POST", files+"/"+file+"/trash", nil, 200)
	owner.request(t, "POST", files+"/"+folder+"/trash", nil, 200)
	other.request(t, "POST", previewPath, selection, 404)
	owner.request(t, "POST", previewPath, selection, 403, map[string]string{"X-CSRF-Token": ""})
	owner.request(t, "POST", previewPath, map[string]any{"scope": "selection", "ids": []string{folder, folder}}, 422)
	preview := owner.request(t, "POST", previewPath, selection, 200)
	if preview["entryCount"] != float64(2) || preview["rootCount"] != float64(2) || preview["bytes"] != float64(11) {
		t.Fatal("回收目录的子项去重或历史逻辑字节错误")
	}
	all := map[string]any{"scope": "all", "ids": []string{}}
	allPreview := owner.request(t, "POST", previewPath, all, 200)
	unrelated := owner.request(t, "POST", files+"/folders", map[string]string{"parentId": "", "name": "后入回收站"}, 200)["id"].(string)
	owner.request(t, "POST", files+"/"+unrelated+"/trash", nil, 200)
	all["snapshot"] = allPreview["snapshot"]
	owner.request(t, "POST", purgePath, all, 409)
	selection["snapshot"] = preview["snapshot"]
	owner.request(t, "POST", files+"/"+folder+"/restore", map[string]string{}, 200)
	owner.request(t, "POST", files+"/"+folder+"/trash", nil, 200)
	owner.request(t, "POST", purgePath, selection, 409)
	delete(selection, "snapshot")
	selection["snapshot"] = owner.request(t, "POST", previewPath, selection, 200)["snapshot"]
	owner.request(t, "POST", purgePath, selection, 200)
	owner.request(t, "POST", files+"/"+folder+"/restore", map[string]string{}, 404)
	owner.request(t, "POST", files+"/"+file+"/restore", map[string]string{}, 404)
	owner.request(t, "GET", files+"/"+file+"/versions/1/content", nil, 404)
	data, _ := transferBytes(t, owner, "GET", "/files/"+copyID+"/versions/1/content", nil, nil, 200)
	if string(data) != "original" {
		t.Fatal("删除回收站条目破坏副本历史内容")
	}
	pins := owner.request(t, "GET", files+"/pins", nil, 200)
	if pins["revision"] != float64(2) || len(pins["items"].([]any)) != 0 {
		t.Fatal("永久删除后固定项未同步移除")
	}
	owner.request(t, "POST", files+"/"+unrelated+"/restore", map[string]string{}, 200)
	currentQuota := owner.request(t, "GET", files, nil, 200)["usedBytes"].(float64)
	if originalQuota-currentQuota != 11 {
		t.Fatal("账户逻辑配额未释放选中条目及历史关联")
	}
	empty := owner.request(t, "POST", previewPath, map[string]any{"scope": "all", "ids": []string{}}, 200)
	if empty["entryCount"] != float64(0) {
		t.Fatal("回收站剩余意外条目")
	}
}
