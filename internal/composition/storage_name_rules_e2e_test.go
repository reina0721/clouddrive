package composition

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestStorageNameRulesEnforcedAfterRestart(t *testing.T) {
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	id := func() string {
		t.Helper()
		value, err := idgen.UUID().New()
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	setup, password := id(), id()
	torrent := newTorrentProtocolFixture(t)
	node := httptest.NewServer(torrent.handler(t))
	t.Cleanup(node.Close)
	config := generationConfig(directory, 120, 32<<20, filepath.Join(directory, "storage-name-rules.db"))
	config = strings.Replace(config, "mode: development-anonymous", "mode: session", 1)
	config = strings.Replace(config, "scheduler:\n  enabled: false", "scheduler:\n  enabled: true", 1)
	config = strings.Replace(config, "files:\n", fmt.Sprintf("files:\n  offline:\n    source:\n      allowedNetworks: [127.0.0.1/32]\n    torrentNodes:\n      - id: local\n        name: 验收节点\n        endpoint: %s\n        secret: %s\n        workspaceRoot: %s\n", strconv.Quote(node.URL), strconv.Quote(setup), strconv.Quote(torrent.root)), 1)
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setup+"\n"+config)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	stop := func() {
		t.Helper()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Fatal(err)
		}
	}
	defer stop()
	admin := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	admin.request(t, "GET", "/auth/csrf", nil, 200)
	admin.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "file-name-rules@clouddrive.test", "name": "名称规则验收", "password": password}, 200)
	const files = "/native/files"
	const endpoint = files + "/storage-policy/name-rules"
	anon := &consoleTestClient{base: admin.base, cookies: map[string]string{}}
	anon.request(t, "GET", endpoint, nil, 401)
	initial := admin.request(t, "GET", endpoint, nil, 200)
	if initial["revision"] != float64(0) || initial["pendingRestart"] != false {
		t.Fatal("新库规则应不限")
	}
	createText := func(name, key string, status int) map[string]any {
		t.Helper()
		return admin.request(t, "POST", files+"/text", map[string]string{"name": name, "parentId": "", "key": key, "text": "fixture"}, status)
	}
	previousKey := id()
	previous := createText("previous.bin", previousKey, 200)["id"].(string)
	transferKey := id()
	digest := fmt.Sprintf("%x", sha256.Sum256([]byte("abc")))
	createTransfer := func(name, key string, status int) map[string]any {
		t.Helper()
		return admin.request(t, "POST", files+"/transfers", map[string]any{"name": name, "parentId": "", "key": key, "sizeBytes": 3, "sha256": digest}, status)
	}
	retained := createTransfer("retained.bin", transferKey, 200)["id"].(string)
	folder := admin.request(t, "POST", files+"/folders", map[string]string{"name": "shared-folder", "parentId": ""}, 200)["id"].(string)
	share := admin.request(t, "POST", files+"/shares", map[string]any{"rootId": folder, "permissions": service.SharePermissions{Browse: true, Create: true, Upload: true}}, 200)
	sharePath := "/api/v1/file-shares/" + share["token"].(string)
	connection := admin.request(t, "POST", files+"/connections", map[string]any{"name": "QA", "rootId": "", "readOnly": false, "blockSystemFiles": true}, 200)
	rules := service.StorageNameRules{ExtensionMode: service.StorageRuleAllow, Extensions: []string{".TXT", "txt"}, PatternMode: service.StorageRuleDeny, Pattern: "^(blocked|second)"}
	testRule := func(candidate string, rule service.StorageNameRules, status int) map[string]any {
		t.Helper()
		return admin.request(t, "POST", endpoint+"/check", map[string]any{"name": candidate, "rules": rule}, status)
	}
	for name, decision := range map[string]string{"good.TXT": "allowed", "blocked.txt": "pattern", "bad.bin": "extension", "noextension": "extension"} {
		if got := testRule(name, rules, 200)["decision"]; got != decision {
			t.Fatalf("名称试测结果错误: %s %v", name, got)
		}
	}
	bad := rules
	bad.Pattern = "(?=unsafe)"
	testRule("safe.txt", bad, 422)
	admin.request(t, "PUT", endpoint, service.StoredStorageNameRules{Rules: bad}, 422)
	other := service.StorageNameRules{ExtensionMode: service.StorageRuleDeny, Extensions: []string{"exe"}, PatternMode: service.StorageRuleAllow, Pattern: "^[[:alpha:]]"}
	if testRule("valid.txt", other, 200)["decision"] != "allowed" || testRule("1.txt", other, 200)["decision"] != "pattern" || testRule("valid.EXE", other, 200)["decision"] != "extension" {
		t.Fatal("拒绝列表或允许正则错误")
	}
	saved := admin.request(t, "PUT", endpoint, service.StoredStorageNameRules{Rules: rules}, 200)
	if saved["revision"] != float64(1) || saved["pendingRestart"] != true ||
		len(saved["rules"].(map[string]any)["extensions"].([]any)) != 1 {
		t.Fatal("规范化或保存状态错误")
	}
	admin.request(t, "PUT", endpoint, service.StoredStorageNameRules{Rules: rules}, 409)
	createText("pending.bin", id(), 200)
	stop()
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	admin.base = "http://" + coordinator.Diagnostics().BoundAddress
	if active := admin.request(t, "GET", endpoint, nil, 200); active["pendingRestart"] != false {
		t.Fatal("规则未在新应用代生效")
	}
	if replay := createText("previous.bin", previousKey, 200); replay["id"] != previous {
		t.Fatal("旧上传幂等回执被规则阻断")
	}
	createText("new.bin", id(), 422)
	createText("blocked.txt", id(), 422)
	allowed := createText("allowed.TXT", id(), 200)["id"].(string)
	admin.request(t, "GET", files+"/"+previous, nil, 200)
	admin.request(t, "PUT", files+"/"+previous+"/text", map[string]any{"expectedRevision": 1, "text": "replace"}, 422)
	admin.request(t, "POST", files+"/"+previous+"/copy", map[string]string{"parentId": "", "name": "old-copy.bin"}, 200)
	createTransfer("new.bin", id(), 422)
	if replay := createTransfer("retained.bin", transferKey, 200); replay["id"] != retained {
		t.Fatal("原传输会话无法重放")
	}
	transferBytes(t, admin, "PATCH", "/files/transfers/"+retained+"/data", []byte("abc"), map[string]string{
		"Content-Type": "application/offset+octet-stream", "Tus-Resumable": "1.0.0", "Upload-Offset": "0",
	}, 204)
	admin.request(t, "POST", files+"/transfers/"+retained+"/commit", nil, 200)
	publicShareRequest(t, admin.base, "POST", sharePath+"/text", map[string]string{"parentId": folder, "name": "guest.bin", "text": "text", "clientKey": id()}, "", 422)
	publicShareRequest(t, admin.base, "POST", sharePath+"/transfers", service.SharedTransferCreate{ParentID: folder, Name: "guest.bin", SizeBytes: 3, SHA256: digest, ClientKey: id()}, "", 422)
	davRequest(t, admin, connection, "PUT", "dav.bin", strings.NewReader("abc"), nil, 422)
	davRequest(t, admin, connection, "LOCK", "locked.bin", strings.NewReader(exclusiveDAVLockXML), nil, 422)
	davRequest(t, admin, connection, "PUT", "dav.txt", strings.NewReader("abc"), nil, 201)
	admin.request(t, "POST", files+"/archive-tasks/zip", service.ZIPTaskInput{ClientKey: id(), SourceIDs: []string{allowed}, Name: "restricted.zip"}, 422)
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Disposition", `attachment; filename="blocked.txt"`)
		http.ServeContent(w, r, "allowed.txt", time.Time{}, bytes.NewReader([]byte("abc")))
	}))
	t.Cleanup(source.Close)
	admin.request(t, "POST", files+"/downloads", map[string]string{"uri": source.URL, "parentId": "", "name": "explicit.bin", "clientKey": id()}, 422)
	task := admin.request(t, "POST", files+"/downloads", map[string]string{"uri": source.URL + "/allowed.txt", "parentId": "", "name": "", "clientKey": id()}, 200)
	failed := waitDownloadState(t, admin, files+"/downloads/"+task["id"].(string), "failed")
	if failed["failureCode"] != "filename-restricted" || failed["receivedBytes"] != float64(0) {
		t.Fatal("离线来源建议名称未在写入前被拒绝")
	}
	bt := admin.request(t, "POST", files+"/torrent-downloads", map[string]string{
		"torrentBase64": base64.StdEncoding.EncodeToString(torrent.metadata), "nodeId": "local", "clientKey": id(), "name": "", "parentId": "",
	}, 200)
	btPath := files + "/torrent-downloads/" + bt["id"].(string)
	admin.request(t, "PATCH", btPath+"/selection", map[string]any{"revision": bt["revision"], "indexes": []int{2}}, 422)
	admin.request(t, "PATCH", btPath+"/selection", map[string]any{"revision": bt["revision"], "indexes": []int{1}}, 200)
	waitDownloadState(t, admin, files+"/downloads/"+bt["id"].(string), "completed")
}
