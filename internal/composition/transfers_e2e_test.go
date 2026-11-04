package composition

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
)

// transferBytes 保留真实协议状态和响应头，不以 JSON 解码掩盖 Range 或空响应。
func transferBytes(t *testing.T, client *consoleTestClient, method, path string, body []byte, headers map[string]string, expected int) ([]byte, http.Header) {
	t.Helper()
	request, err := http.NewRequestWithContext(t.Context(), method, client.base+"/api/console/v1/native"+path, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Origin", client.base)
	request.Header.Set("X-CSRF-Token", client.csrf)
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	for name, value := range client.cookies {
		request.AddCookie(&http.Cookie{Name: name, Value: value})
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("传输请求失败，错误类型 %T", err)
	}
	result, readErr := io.ReadAll(response.Body)
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != expected {
		t.Fatalf("%s 传输状态 %d，预期 %d；响应 %s", method, response.StatusCode, expected, result)
	}
	return result, response.Header
}

func TestResumableTransfersLargeFileRestartRetargetAndRange(t *testing.T) {
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
	payload := "iam:\n  local:\n    setupToken: " + setup + "\n" + strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "transfers.db")), "mode: development-anonymous", "mode: session", 1)
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "transfer-owner@clouddrive.test", "name": "传输验收", "password": password}, 200)
	content := bytes.Repeat([]byte("real-large-transfer-"), (33<<20)/20+1)
	digest := sha256.Sum256(content)
	create := func(name, key string) map[string]any {
		return owner.request(t, "POST", "/native/files/transfers", map[string]any{"parentId": "", "name": name, "key": key, "sizeBytes": len(content), "sha256": hex.EncodeToString(digest[:])}, 200)
	}
	transfer := create("large-source.bin", "large-source-test-key")
	id := transfer["id"].(string)
	dataPath := "/files/transfers/" + id + "/data"
	patch := func(start, end, status int) {
		transferBytes(t, owner, "PATCH", dataPath, content[start:end], map[string]string{"Content-Type": "application/offset+octet-stream", "Tus-Resumable": "1.0.0", "Upload-Offset": strconv.Itoa(start)}, status)
	}
	patch(0, 4<<20, 204)
	patch(0, 8, 409)
	paused := owner.request(t, "POST", "/native/files/transfers/"+id+"/pause", nil, 200)
	if paused["offsetBytes"] != float64(4<<20) || paused["state"] != "paused" {
		t.Fatal("暂停丢失已确认偏移")
	}
	patch(4<<20, (4<<20)+8, 409)
	owner.request(t, "POST", "/native/files/transfers/"+id+"/source", map[string]any{"sizeBytes": len(content), "sha256": strings.Repeat("0", 64)}, 422)
	owner.request(t, "POST", "/native/files/transfers/"+id+"/source", map[string]any{"sizeBytes": len(content), "sha256": hex.EncodeToString(digest[:])}, 200)
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
	resumed := owner.request(t, "POST", "/native/files/transfers/"+id+"/resume", nil, 200)
	if resumed["offsetBytes"] != float64(4<<20) {
		t.Fatal("进程重启后偏移丢失")
	}
	for start := 4 << 20; start < len(content); {
		end := min(start+(4<<20), len(content))
		patch(start, end, 204)
		start = end
	}
	// 上传期间创建同名内容，最终发布必须保留完整暂存，并允许修正目标。
	owner.request(t, "POST", "/native/files/text", map[string]string{"parentId": "", "name": "large-source.bin", "text": "occupied", "key": "occupied-source-key"}, 200)
	owner.request(t, "POST", "/native/files/transfers/"+id+"/commit", nil, 409)
	attention := owner.request(t, "GET", "/native/files/transfers/"+id, nil, 200)
	if attention["state"] != "attention" || attention["offsetBytes"] != float64(len(content)) {
		t.Fatal("冲突后未保留完整上传")
	}
	owner.request(t, "PUT", "/native/files/transfers/"+id+"/target", map[string]string{"parentId": "", "name": "large-retargeted.bin"}, 200)
	completed := owner.request(t, "POST", "/native/files/transfers/"+id+"/commit", nil, 200)
	if completed["state"] != "completed" {
		t.Fatal("修正目标后未发布")
	}
	entryID := completed["entryId"].(string)
	path := "/files/" + entryID + "/content"
	downloaded, headers := transferBytes(t, owner, "GET", path, nil, nil, 200)
	if sha256.Sum256(downloaded) != digest {
		t.Fatal("大文件发布内容校验失败")
	}
	partial, rangeHeaders := transferBytes(t, owner, "GET", path, nil, map[string]string{"Range": "bytes=7-27"}, 206)
	if !bytes.Equal(partial, content[7:28]) || rangeHeaders.Get("Content-Range") != "bytes 7-27/"+strconv.Itoa(len(content)) {
		t.Fatal("Range 内容或总长度不正确")
	}
	transferBytes(t, owner, "GET", path, nil, map[string]string{"Range": "bytes=" + strconv.Itoa(len(content)) + "-"}, 416)
	transferBytes(t, owner, "GET", path, nil, map[string]string{"If-None-Match": headers.Get("ETag")}, 304)
	full, _ := transferBytes(t, owner, "GET", path, nil, map[string]string{"Range": "bytes=0-2", "If-Range": "\"obsolete\""}, 200)
	if len(full) != len(content) {
		t.Fatal("If-Range 不匹配时没有返回完整内容")
	}
	owner.request(t, "POST", "/native/files/transfers/"+id+"/cancel", nil, 409)
	// 未发布的会话取消必须释放暂存，且不改变已经发布的条目。
	another := create("cancel-source.bin", "cancel-source-test-key")["id"].(string)
	canceled := owner.request(t, "POST", "/native/files/transfers/"+another+"/cancel", nil, 200)
	if canceled["state"] != "canceled" || canceled["cleanupPending"] != false {
		t.Fatal("取消未完成资源清理")
	}
	owner.request(t, "GET", "/native/files/"+entryID, nil, 200)
	// 仅推进本测试库的到期时间，验证实际请求驱动清理，不等待墙上时钟。
	expiring := create("expire-source.bin", "expire-source-test-key")["id"].(string)
	dbConfig := database.DefaultConfig()
	dbConfig.Driver = database.DriverSQLite
	dbConfig.DSN = filepath.Join(directory, "transfers.db")
	dbResource, err := database.NewGORM(t.Context(), &dbConfig)
	if err != nil {
		t.Fatal(err)
	}
	updateErr := database.UseGORM(t.Context(), dbResource.Client(), func(db *gorm.DB) error {
		return db.Table("files_transfers").Where("id = ?", expiring).Update("expires_at", time.Now().UTC().Add(-time.Minute)).Error
	})
	if err := errors.Join(updateErr, dbResource.Close()); err != nil {
		t.Fatal(err)
	}
	expired := owner.request(t, "GET", "/native/files/transfers/"+expiring, nil, 200)
	if expired["state"] != "expired" || expired["cleanupPending"] != false {
		t.Fatal("到期未释放暂存")
	}
	owner.request(t, "POST", "/native/files/transfers/"+expiring+"/resume", nil, 410)
	if _, err := os.Stat(filepath.Join(directory, "transfers", expiring)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("到期后暂存仍存在：%v", err)
	}
	// 用不可删除的非空目录替代测试会话 metadata，制造真实文件清理失败。
	cleanupID := create("cleanup-source.bin", "cleanup-source-test-key")["id"].(string)
	metadataPath := filepath.Join(directory, "transfers", cleanupID+".info")
	metadataBackup := filepath.Join(directory, "metadata-fixture")
	if err := os.Rename(metadataPath, metadataBackup); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(metadataPath, 0o700); err != nil {
		t.Fatal(err)
	}
	blocker := filepath.Join(metadataPath, "blocker")
	if err := os.WriteFile(blocker, []byte("test-only"), 0o600); err != nil {
		t.Fatal(err)
	}
	owner.request(t, "POST", "/native/files/transfers/"+cleanupID+"/cancel", nil, 500)
	if err := os.Remove(blocker); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(metadataPath); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(metadataBackup, metadataPath); err != nil {
		t.Fatal(err)
	}
	retriedCleanup := owner.request(t, "POST", "/native/files/transfers/"+cleanupID+"/cancel", nil, 200)
	if retriedCleanup["cleanupPending"] != false {
		t.Fatal("清理失败修复后未释放待办")
	}
	// 配额在接收前预留；空暂存不能绕过账号的已发布占用。
	quotaDigest := sha256.Sum256([]byte("quota-admission"))
	for index := range 2 {
		status := 200
		if index == 1 {
			status = 409
		}
		owner.request(t, "POST", "/native/files/transfers", map[string]any{"parentId": "", "name": "quota-" + strconv.Itoa(index), "key": "quota-admission-key-" + strconv.Itoa(index), "sizeBytes": 512 << 20, "sha256": hex.EncodeToString(quotaDigest[:])}, status)
	}
	// 拥有同等 files 权限的另一个真实账号仍不能读、暂停或写入该会话。
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "Transfer users", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	owner.request(t, "POST", "/users", map[string]any{"email": "transfer-other@clouddrive.test", "name": "另一个传输用户", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	other := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	other.request(t, "GET", "/auth/csrf", nil, 200)
	other.request(t, "POST", "/auth/login", map[string]string{"email": "transfer-other@clouddrive.test", "password": password}, 200)
	other.request(t, "GET", "/native/files/transfers/"+id, nil, 404)
	other.request(t, "POST", "/native/files/transfers/"+id+"/pause", nil, 404)
	transferBytes(t, other, "PATCH", dataPath, []byte("x"), map[string]string{"Content-Type": "application/offset+octet-stream", "Tus-Resumable": "1.0.0", "Upload-Offset": "0"}, 404)
}
