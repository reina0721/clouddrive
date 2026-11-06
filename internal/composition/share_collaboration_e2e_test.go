package composition

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

// collaborationObject 不把分享凭据或访客内容写入失败诊断。
func collaborationObject[T any](t *testing.T, payload []byte) T {
	t.Helper()
	var result T
	if err := json.Unmarshal(payload, &result); err != nil {
		t.Fatalf("协作响应结构无效，错误类型%T", err)
	}
	return result
}
func collaborationChunk(t *testing.T, base, path, grant, method string, offset int, content []byte, status int) http.Header {
	t.Helper()
	request, err := http.NewRequestWithContext(t.Context(), method, base+path, bytes.NewReader(content))
	if err != nil {
		t.Fatal("无法构造协作分块请求")
	}
	request.Header.Set("Origin", base)
	request.Header.Set("X-Share-Grant", grant)
	request.Header.Set("Tus-Resumable", "1.0.0")
	if method == http.MethodPatch {
		request.Header.Set("Content-Type", "application/offset+octet-stream")
		request.Header.Set("Upload-Offset", strconv.Itoa(offset))
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("协作分块请求失败，类型%T", err)
	}
	_, readErr := io.Copy(io.Discard, response.Body)
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != status {
		t.Fatalf("协作分块状态%d，预期%d", response.StatusCode, status)
	}
	return response.Header
}

func TestShareCollaborationScopeCASBatchPolicyAndUpload(t *testing.T) {
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	setup, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setup+"\n"+strings.Replace(generationConfig(directory, 120, 64<<20, filepath.Join(directory, "collaboration.db")), "mode: development-anonymous", "mode: session", 1))
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "collaboration-owner@clouddrive.test", "name": "协作验收", "password": password}, 200)
	ancestor := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "不公开的祖先", "parentId": ""}, 200)["id"].(string)
	root := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "分享目录", "parentId": ancestor}, 200)["id"].(string)
	outside := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "不可访问目录", "parentId": ""}, 200)["id"].(string)
	readonly := owner.request(t, "POST", "/native/files/shares", map[string]string{"rootId": root}, 200)
	readonlyPath := "/api/v1/file-shares/" + readonly["token"].(string)
	publicShareRequest(t, owner.base, "POST", readonlyPath+"/folders", map[string]string{"parentId": root, "name": "拒绝创建"}, "", 403)
	readOnlyMeta := collaborationObject[service.PublicShare](t, publicShareRequest(t, owner.base, "GET", readonlyPath, nil, "", 200))
	if readOnlyMeta.Permissions == nil || readOnlyMeta.Permissions.Create || !readOnlyMeta.Permissions.Download {
		t.Fatal("默认分享未保持只读")
	}
	rights := service.SharePermissions{Browse: true, Preview: true, Download: true, Create: true, Upload: true, Modify: true, Rename: true, Move: true, Copy: true, Delete: true}
	share := owner.request(t, "POST", "/native/files/shares", map[string]any{"rootId": root, "password": password, "title": "协作标题", "permissions": rights}, 200)
	shareID := share["id"].(string)
	path := "/api/v1/file-shares/" + share["token"].(string)
	locked := collaborationObject[service.PublicShare](t, publicShareRequest(t, owner.base, "GET", path, nil, "", 200))
	if !locked.Locked || locked.Root != nil || locked.Permissions != nil || locked.Revision != nil || locked.Limits != nil {
		t.Fatal("锁定分享泄漏能力或文件")
	}
	unlock := func() string {
		var value struct {
			Ticket string `json:"ticket"`
		}
		value = collaborationObject[struct {
			Ticket string `json:"ticket"`
		}](t, publicShareRequest(t, owner.base, "POST", path+"/unlock", map[string]string{"password": password}, "", 200))
		return value.Ticket
	}
	first, second := unlock(), unlock()
	if first == second {
		t.Fatal("两名访客的解锁凭据相同")
	}
	listing := collaborationObject[service.PublicListing](t, publicShareRequest(t, owner.base, "GET", path+"/entries", nil, first, 200))
	if len(listing.Breadcrumbs) != 1 || listing.Breadcrumbs[0].ID != root || bytes.Contains(publicShareRequest(t, owner.base, "GET", path+"/entries", nil, first, 200), []byte(ancestor)) {
		t.Fatal("分享目录暴露了祖先")
	}
	createFolder := func(parent, name string) service.PublicEntry {
		return collaborationObject[service.PublicEntry](t, publicShareRequest(t, owner.base, "POST", path+"/folders", map[string]string{"parentId": parent, "name": name}, first, 200))
	}
	destination := createFolder(root, "协作目标")
	publicShareRequest(t, owner.base, "POST", path+"/folders", map[string]string{"parentId": outside, "name": "不可创建"}, first, 404)
	publicShareRequest(t, owner.base, "POST", path+"/folders", map[string]string{"parentId": root, "name": "跨来源"}, first, 403, "https://untrusted.example")
	text := collaborationObject[service.PublicEntry](t, publicShareRequest(t, owner.base, "POST", path+"/text", map[string]string{"parentId": root, "name": "协作.md", "text": "初始文字", "clientKey": "collaboration-text-stable-key"}, first, 200))
	initial := collaborationObject[service.PublicText](t, publicShareRequest(t, owner.base, "GET", path+"/text/"+text.ID, nil, second, 200))
	if initial.Text != "初始文字" {
		t.Fatal("另一访客未读到真实内容")
	}
	updated := collaborationObject[service.PublicEntry](t, publicShareRequest(t, owner.base, "PUT", path+"/text/"+text.ID, map[string]any{"revision": text.ContentRevision, "text": "第二版文字"}, second, 200))
	acknowledged := collaborationObject[service.PublicText](t, publicShareRequest(t, owner.base, "GET", path+"/text/"+text.ID, nil, second, 200))
	if !acknowledged.Entry.UpdatedAt.Equal(updated.UpdatedAt) {
		t.Fatalf("更新回执与持久时间不同：%d / %d", updated.UpdatedAt.UnixNano(), acknowledged.Entry.UpdatedAt.UnixNano())
	}
	publicShareRequest(t, owner.base, "PUT", path+"/text/"+text.ID, map[string]any{"revision": text.ContentRevision, "text": "不得覆盖"}, first, 409)
	history := owner.request(t, "GET", "/native/files/"+text.ID+"/versions", nil, 200)
	if len(history["items"].([]any)) < 1 {
		t.Fatal("访客编辑未保留历史版本")
	}
	change := func(entry service.PublicEntry, action, name, parent string, status int) service.PublicEntry {
		return collaborationObject[service.PublicEntry](t, publicShareRequest(t, owner.base, "POST", path+"/entries/change", service.SharedItemChange{SharedItemVersion: service.SharedItemVersion{ID: entry.ID, Revision: entry.ContentRevision, UpdatedAt: entry.UpdatedAt}, Action: action, Name: name, ParentID: parent}, first, status))
	}
	renamed := change(updated, "rename", "已改名.md", "", 200)
	change(updated, "rename", "过期改名.md", "", 409)
	change(renamed, "move", "", outside, 404)
	moved := change(renamed, "move", "", destination.ID, 200)
	copied := change(moved, "copy", "复制.md", root, 200)
	currentRoot := collaborationObject[service.PublicShare](t, publicShareRequest(t, owner.base, "GET", path, nil, first, 200))
	change(*currentRoot.Root, "trash", "", "", 403)
	change(*currentRoot.Root, "rename", "错误根", "", 403)
	// 成功和失败在同一真实批次中分别返回，失败不能被当作整批成功。
	partial := collaborationObject[service.SharedBatchResult](t, publicShareRequest(t, owner.base, "POST", path+"/entries/batch", service.SharedBatch{Action: "move", ParentID: destination.ID, Items: []service.SharedItemVersion{{ID: copied.ID, Revision: copied.ContentRevision, UpdatedAt: copied.UpdatedAt}, {ID: updated.ID, Revision: updated.ContentRevision, UpdatedAt: updated.UpdatedAt}}}, first, 200))
	if len(partial.Items) != 2 || partial.Items[0].ErrorCode != "" || partial.Items[1].ErrorCode != "conflict" {
		t.Fatal("批量逐项失败语义不正确")
	}
	zipped := publicShareRequest(t, owner.base, "POST", path+"/archive", map[string]any{"ids": []string{copied.ID}}, first, 200)
	archive, err := zip.NewReader(bytes.NewReader(zipped), int64(len(zipped)))
	if err != nil || len(archive.File) != 1 {
		t.Fatal("分享ZIP未包含真实所选文件")
	}
	publicShareRequest(t, owner.base, "POST", path+"/archive", map[string]any{"ids": []string{outside}}, first, 404)
	if partial.Items[0].Entry == nil {
		t.Fatal("批量成功项缺失结果")
	}
	trashed := change(*partial.Items[0].Entry, "trash", "", "", 200)
	publicShareRequest(t, owner.base, "GET", path+"/text/"+trashed.ID, nil, first, 404)
	// 使用超过原HTTP请求体预算的真实33MiB来源，按tus协议分块并校验偏移。
	payload := bytes.Repeat([]byte("shared-content-"), (33<<20)/len("shared-content-"))
	digest := sha256.Sum256(payload)
	transfer := collaborationObject[service.SharedTransfer](t, publicShareRequest(t, owner.base, "POST", path+"/transfers", service.SharedTransferCreate{ParentID: root, Name: "访客上传.bin", SizeBytes: int64(len(payload)), SHA256: hex.EncodeToString(digest[:]), ClientKey: "collaboration-upload-stable-key"}, first, 200))
	transferPath := path + "/transfers/" + transfer.ID
	publicShareRequest(t, owner.base, "GET", transferPath, nil, second, 404)
	owner.request(t, "GET", "/native/files/transfers/"+transfer.ID, nil, 404)
	head := collaborationChunk(t, owner.base, transferPath+"/data", first, "HEAD", 0, nil, 200)
	if head.Get("Upload-Offset") != "0" {
		t.Fatal("初始偏移错误")
	}
	for offset := 0; offset < len(payload); {
		end := min(offset+int(transfer.ChunkBytes), len(payload))
		headers := collaborationChunk(t, owner.base, transferPath+"/data", first, "PATCH", offset, payload[offset:end], 204)
		if headers.Get("Upload-Offset") != strconv.Itoa(end) {
			t.Fatal("分块未确认真实偏移")
		}
		offset = end
	}
	complete := collaborationObject[service.SharedTransfer](t, publicShareRequest(t, owner.base, "POST", transferPath+"/commit", nil, first, 200))
	if complete.State != "completed" || complete.EntryID == "" || complete.OffsetBytes != int64(len(payload)) {
		t.Fatal("访客上传没有真实发布")
	}
	raw := publicShareRequest(t, owner.base, "GET", path+"/content/"+complete.EntryID, nil, first, 200)
	actual := sha256.Sum256(raw)
	if actual != digest {
		t.Fatal("发布内容摘要不同")
	}
	// 自定义预览权限不隐含下载、归档或写入；不安全类型也不能绕过预览预算。
	previewOnly := owner.request(t, "POST", "/native/files/shares", map[string]any{"rootId": root, "permissions": service.SharePermissions{Browse: true, Preview: true}}, 200)
	previewPath := "/api/v1/file-shares/" + previewOnly["token"].(string)
	publicShareRequest(t, owner.base, "GET", previewPath+"/text/"+text.ID, nil, "", 200)
	publicShareRequest(t, owner.base, "POST", previewPath+"/content/"+text.ID+"/download", nil, "", 403)
	publicShareRequest(t, owner.base, "POST", previewPath+"/archive", map[string]any{"ids": []string{text.ID}}, "", 403)
	publicShareRequest(t, owner.base, "GET", previewPath+"/content/"+complete.EntryID, nil, "", 422)
	owner.request(t, "POST", "/native/files/shares", map[string]any{"rootId": root, "permissions": service.SharePermissions{Modify: true}}, 422)
	// 暂停和配置修改使在途发布失效，但原凭据仍可清理自己的候选。
	pending := collaborationObject[service.SharedTransfer](t, publicShareRequest(t, owner.base, "POST", path+"/transfers", service.SharedTransferCreate{ParentID: root, Name: "不应发布.txt", SizeBytes: 3, SHA256: fmt.Sprintf("%x", sha256.Sum256([]byte("abc"))), ClientKey: "collaboration-revoke-stable-key"}, first, 200))
	collaborationChunk(t, owner.base, path+"/transfers/"+pending.ID+"/data", first, "PATCH", 0, []byte("abc"), 204)
	nativePath := "/native/files/shares/" + shareID
	current := owner.request(t, "GET", nativePath, nil, 200)
	paused := owner.request(t, "PUT", nativePath+"/state", map[string]any{"revision": current["revision"], "enabled": false}, 200)
	publicShareRequest(t, owner.base, "GET", path, nil, first, 404)
	publicShareRequest(t, owner.base, "POST", path+"/transfers/"+pending.ID+"/commit", nil, first, 404)
	canceled := collaborationObject[service.SharedTransfer](t, publicShareRequest(t, owner.base, "POST", path+"/transfers/"+pending.ID+"/cancel", nil, first, 200))
	if canceled.State != "canceled" || canceled.CleanupPending {
		t.Fatal("暂停后的候选未完成清理")
	}
	resumed := owner.request(t, "PUT", nativePath+"/state", map[string]any{"revision": paused["revision"], "enabled": true}, 200)
	publicShareRequest(t, owner.base, "GET", path+"/entries", nil, first, 403)
	first = unlock()
	patch := map[string]any{"revision": resumed["revision"], "title": "已更新协作标题", "expiresAt": time.Now().UTC().Add(2 * time.Hour), "permissions": rights, "audience": resumed["audience"], "passwordAction": "remove", "password": ""}
	revised := owner.request(t, "PUT", nativePath, patch, 200)
	owner.request(t, "PUT", nativePath, patch, 409)
	meta := collaborationObject[service.PublicShare](t, publicShareRequest(t, owner.base, "GET", path, nil, "", 200))
	if meta.Title != "已更新协作标题" || meta.Locked {
		t.Fatal("标题或密码移除未生效")
	}
	patch["revision"] = revised["revision"]
	patch["passwordAction"] = "set"
	patch["password"] = password
	owner.request(t, "PUT", nativePath, patch, 200)
	publicShareRequest(t, owner.base, "GET", path+"/entries", nil, first, 403)
	uploadOnly := service.SharePermissions{Create: true, Upload: true}
	blind := owner.request(t, "POST", "/native/files/shares", map[string]any{"rootId": root, "permissions": uploadOnly}, 200)
	blindPath := "/api/v1/file-shares/" + blind["token"].(string)
	publicShareRequest(t, owner.base, "GET", blindPath+"/entries", nil, "", 403)
	publicShareRequest(t, owner.base, "GET", blindPath+"/text/"+text.ID, nil, "", 403)
	publicShareRequest(t, owner.base, "POST", blindPath+"/folders", map[string]string{"parentId": root, "name": "盲投目录"}, "", 200)
	// 文件根允许CAS修改内容，同时仍禁止根结构变更。
	fileShare := owner.request(t, "POST", "/native/files/shares", map[string]any{"rootId": text.ID, "permissions": rights}, 200)
	filePath := "/api/v1/file-shares/" + fileShare["token"].(string)
	latest := collaborationObject[service.PublicText](t, publicShareRequest(t, owner.base, "GET", filePath+"/text/"+text.ID, nil, "", 200))
	publicShareRequest(t, owner.base, "PUT", filePath+"/text/"+text.ID, map[string]any{"revision": latest.Entry.ContentRevision, "text": "文件根修改"}, "", 200)
	first = unlock()
	for i := 0; i < 22; i++ {
		createFolder(root, fmt.Sprintf("分页%02d", i))
	}
	page := collaborationObject[service.PublicListing](t, publicShareRequest(t, owner.base, "GET", readonlyPath+"/entries?search="+"%E5%88%86%E9%A1%B5"+"&page=2&sort=name", nil, "", 200))
	if page.Total != 22 || len(page.Items) != 2 || page.Page != 2 {
		t.Fatal("分享查询分页未生效")
	}
	filtered := owner.request(t, "GET", "/native/files/shares?search="+"%E5%B7%B2%E6%9B%B4%E6%96%B0"+"&sort=name", nil, 200)
	if filtered["total"].(float64) != 1 {
		t.Fatal("拥有者标题检索未生效")
	}
	var firstPageLink map[string]any
	for index := 0; index < 21; index++ {
		link := owner.request(t, "POST", "/native/files/shares", map[string]any{"rootId": root, "title": fmt.Sprintf("owner-page-%02d", index)}, 200)
		if index == 0 {
			firstPageLink = link
		}
	}
	ownerPage := owner.request(t, "GET", "/native/files/shares?search=owner-page-&state=active&sort=name&page=2", nil, 200)
	if ownerPage["total"].(float64) != 21 || len(ownerPage["items"].([]any)) != 1 || ownerPage["items"].([]any)[0].(map[string]any)["title"] != "owner-page-20" {
		t.Fatal("拥有者分页或名称排序不正确")
	}
	owner.request(t, "PUT", "/native/files/shares/"+firstPageLink["id"].(string)+"/state", map[string]any{"revision": firstPageLink["revision"], "enabled": false}, 200)
	pausedPage := owner.request(t, "GET", "/native/files/shares?search=owner-page-&state=paused", nil, 200)
	if pausedPage["total"].(float64) != 1 {
		t.Fatal("拥有者生命周期筛选不正确")
	}
	verifyShareCurrentAuthority(t, owner, password)
	// 降低读取预算和链接上限不能阻断已有链接的策略维护。
	limitedConfig := "iam:\n  local:\n    setupToken: " + setup + "\n" + strings.Replace(generationConfig(directory, 120, 64<<20, filepath.Join(directory, "collaboration.db")), "mode: development-anonymous", "mode: session", 1)
	limitedConfig = strings.Replace(limitedConfig, "files:\n", "files:\n  search:\n    treeEntries: 4\n  sharing:\n    activeLimit: 1\n", 1)
	writeGenerationConfig(t, configPath, limitedConfig)
	if err := coordinator.Stop(t.Context()); err != nil {
		t.Fatal(err)
	}
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	limited := owner.request(t, "GET", nativePath, nil, 200)
	if limited["metadataLimited"] != true {
		t.Fatal("读取超额未投影为受限状态")
	}
	patch["revision"], patch["expiresAt"], patch["passwordAction"], patch["password"] = limited["revision"], limited["expiresAt"], "keep", ""
	patch["title"] = "预算受限仍可维护"
	maintained := owner.request(t, "PUT", nativePath, patch, 200)
	owner.request(t, "PUT", nativePath+"/state", map[string]any{"revision": maintained["revision"], "enabled": false}, 200)
	owner.request(t, "POST", "/native/files/shares", map[string]any{"rootId": root}, 429)
	publicShareRequest(t, owner.base, "GET", readonlyPath+"/entries", nil, "", 413)
}

// verifyShareCurrentAuthority 使用真实IAM账号证明链接不冻结创建时的拥有者权限。
func verifyShareCurrentAuthority(t *testing.T, owner *consoleTestClient, password string) {
	t.Helper()
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "分享成员", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	rolePath := "/native/iam/roles/" + role["id"].(string) + "/permissions"
	owner.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	created := owner.request(t, "POST", "/users", map[string]any{"email": "share-member@clouddrive.test", "name": "分享成员", "password": password, "roleIds": []string{role["id"].(string)}, "status": "active"}, 200)["user"].(map[string]any)
	member := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "share-member@clouddrive.test", "password": password}, 200)
	root := member.request(t, "POST", "/native/files/folders", map[string]string{"name": "成员分享", "parentId": ""}, 200)["id"].(string)
	rights := service.SharePermissions{Browse: true, Preview: true, Download: true, Create: true, Upload: true, Modify: true, Rename: true, Move: true, Copy: true, Delete: true}
	share := member.request(t, "POST", "/native/files/shares", map[string]any{"rootId": root, "permissions": rights}, 200)
	path := "/api/v1/file-shares/" + share["token"].(string)
	pending := collaborationObject[service.SharedTransfer](t, publicShareRequest(t, owner.base, "POST", path+"/transfers", service.SharedTransferCreate{ParentID: root, Name: "权限撤回.txt", SizeBytes: 3, SHA256: fmt.Sprintf("%x", sha256.Sum256([]byte("abc"))), ClientKey: "share-authority-pending-upload"}, "", 200))
	collaborationChunk(t, owner.base, path+"/transfers/"+pending.ID+"/data", "", "PATCH", 0, []byte("abc"), 204)
	owner.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 2, "permissionKeys": []string{"files:read"}}, 200)
	publicShareRequest(t, owner.base, "GET", path+"/entries", nil, "", 200)
	publicShareRequest(t, owner.base, "POST", path+"/folders", map[string]string{"parentId": root, "name": "不应创建"}, "", 403)
	publicShareRequest(t, owner.base, "POST", path+"/transfers/"+pending.ID+"/commit", nil, "", 403)
	canceled := collaborationObject[service.SharedTransfer](t, publicShareRequest(t, owner.base, "POST", path+"/transfers/"+pending.ID+"/cancel", nil, "", 200))
	if canceled.State != "canceled" || canceled.CleanupPending {
		t.Fatal("IAM失权阻止了候选清理")
	}
	owner.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 3, "permissionKeys": []string{}}, 200)
	publicShareRequest(t, owner.base, "GET", path, nil, "", 403)
	owner.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 4, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	user := owner.request(t, "GET", "/users/"+created["id"].(string), nil, 200)["user"].(map[string]any)
	owner.request(t, "PATCH", "/users/"+created["id"].(string)+"/status", map[string]any{"version": user["version"], "status": "disabled"}, 200)
	publicShareRequest(t, owner.base, "GET", path+"/entries", nil, "", 403)
}
