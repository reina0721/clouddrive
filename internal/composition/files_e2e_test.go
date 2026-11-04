package composition

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// uploadFileHTTP 覆盖真实 Cookie/CSRF、Huma 二进制 body 与数据库/对象内容接线。
func uploadFileHTTP(ctx context.Context, client *consoleTestClient, parent, name, key string, content []byte) (entry model.Entry, resultErr error) {
	params := url.Values{"parent": {parent}, "name": {name}}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.base+"/api/console/v1/native/files/upload?"+params.Encode(), bytes.NewReader(content))
	if err != nil {
		return entry, err
	}
	request.Header.Set("Origin", client.base)
	request.Header.Set("Content-Type", "application/octet-stream")
	request.Header.Set("Idempotency-Key", key)
	request.Header.Set("X-CSRF-Token", client.csrf)
	for name, value := range client.cookies {
		request.AddCookie(&http.Cookie{Name: name, Value: value})
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return entry, err
	}
	defer func() { resultErr = errors.Join(resultErr, response.Body.Close()) }()
	if response.StatusCode != 200 {
		return entry, fmt.Errorf("file upload returned %d", response.StatusCode)
	}
	err = json.NewDecoder(response.Body).Decode(&entry)
	return entry, err
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
	changed := strings.Replace(payload, filepath.ToSlash(filepath.Join(directory, "storage")), filepath.ToSlash(filepath.Join(directory, "different-storage")), 1)
	if changed == payload {
		t.Fatal("storage configuration anchor missing")
	}
	writeGenerationConfig(t, configPath, changed)
	if _, err := coordinator.Reload(t.Context()); err == nil {
		t.Fatal("changed storage location accepted with existing files")
	}
	download()
}
