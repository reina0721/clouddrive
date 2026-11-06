package composition

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/internal/module/files/service"
	iamservice "github.com/reina0721/clouddrive/internal/module/iam/service"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

// audienceHTTP 复用真实会话，诊断只输出状态，不输出分享地址、票据或请求体。
func audienceHTTP(t *testing.T, client *consoleTestClient, method, path string, body any, status int, headers ...map[string]string) []byte {
	t.Helper()
	var payload []byte
	var err error
	if body != nil {
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	request, err := http.NewRequestWithContext(t.Context(), method, client.base+path, bytes.NewReader(payload))
	if err != nil {
		t.Fatal("无法构造受众测试请求")
	}
	request.Header.Set("Origin", client.base)
	request.Header.Set("X-CSRF-Token", client.csrf)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for name, value := range client.cookies {
		request.AddCookie(&http.Cookie{Name: name, Value: value})
	}
	for _, group := range headers {
		for key, value := range group {
			request.Header.Set(key, value)
		}
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatalf("受众请求失败，类型%T", err)
	}
	result, readErr := io.ReadAll(response.Body)
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != status {
		if strings.HasSuffix(path, "/access") {
			var diagnostic struct {
				Title, Detail string
				Errors        []struct{ Location, Message string }
				Error         struct{ Code, Reason string }
			}
			if err := json.Unmarshal(result, &diagnostic); err == nil {
				t.Logf("受控权限夹具的校验诊断：%+v", diagnostic)
			}
		}
		t.Fatalf("受众请求状态%d，预期%d", response.StatusCode, status)
	}
	return result
}

func newAudienceFixture(t *testing.T) (*consoleTestClient, *consoleTestClient, string) {
	t.Helper()
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
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setup+"\n"+strings.Replace(generationConfig(directory, 120, 64<<20, filepath.Join(directory, "audience.db")), "mode: development-anonymous", "mode: session", 1))
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "audience-owner@clouddrive.test", "name": "受众验收", "password": password}, 200)
	return owner, &consoleTestClient{base: owner.base, cookies: map[string]string{}}, password
}

func audienceTyped[T any](t *testing.T, client *consoleTestClient, method, path string, body any, status int) T {
	t.Helper()
	return collaborationObject[T](t, audienceHTTP(t, client, method, path, body, status))
}

// TestShareAudienceIdentityInheritanceAndPublication 使用真实IAM、SQL、HTTP和tus最终事务，未用权限替身。
func TestShareAudienceIdentityInheritanceAndPublication(t *testing.T) {
	owner, anonymous, password := newAudienceFixture(t)
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "受众成员", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	user := owner.request(t, "POST", "/users", map[string]any{"email": "audience-member@clouddrive.test", "name": "受众成员", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)["user"].(map[string]any)
	memberID := user["id"].(string)
	member := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "audience-member@clouddrive.test", "password": password}, 200)
	root := owner.request(t, "POST", "/native/files/folders", map[string]string{"parentId": "", "name": "受众目录"}, 200)["id"].(string)
	folder := owner.request(t, "POST", "/native/files/folders", map[string]string{"parentId": root, "name": "受保护目录"}, 200)["id"].(string)
	leaf := owner.request(t, "POST", "/native/files/text", map[string]string{"parentId": folder, "name": "protected.txt", "text": "protected audience content", "key": "audience-protected-source-key"}, 200)["id"].(string)
	visible := owner.request(t, "POST", "/native/files/text", map[string]string{"parentId": root, "name": "visible.txt", "text": "visible audience content", "key": "audience-visible-source-key"}, 200)["id"].(string)
	permissions := service.SharePermissions{Browse: true, Preview: true, Download: true, Create: true, Upload: true, Modify: true, Rename: true, Move: true, Copy: true, Delete: true}
	denied := service.SharePermissions{}
	audience := service.ShareAudience{Anonymous: &denied, Authenticated: &denied, Accounts: []service.AudienceRule{}, Roles: []service.AudienceRule{{SubjectID: roleID, Permissions: permissions}}}
	share := audienceTyped[service.ShareSummary](t, owner, "POST", "/api/console/v1/native/files/shares", service.ShareCreate{RootID: root, Permissions: &permissions, Audience: &audience}, 200)
	path := "/api/v1/file-shares/" + share.Token
	metadata := audienceTyped[service.PublicShare](t, anonymous, "GET", path, nil, 200)
	if !metadata.Denied || !metadata.SignInRequired || metadata.Root != nil || metadata.Permissions != nil {
		t.Fatal("匿名拒绝泄漏了分享根")
	}
	metadata = audienceTyped[service.PublicShare](t, member, "GET", path, nil, 200)
	if metadata.Denied || metadata.Permissions == nil || !metadata.Permissions.Modify {
		t.Fatal("真实角色受众未生效")
	}
	// 管理员访问另一拥有者的拒绝受众分享，证明例外来自真实系统角色而非同owner。
	memberRoot := member.request(t, "POST", "/native/files/folders", map[string]string{"parentId": "", "name": "成员拥有目录"}, 200)["id"].(string)
	closedAudience := service.ShareAudience{Anonymous: &denied, Authenticated: &denied, Accounts: []service.AudienceRule{}, Roles: []service.AudienceRule{}}
	memberShare := audienceTyped[service.ShareSummary](t, member, "POST", "/api/console/v1/native/files/shares", service.ShareCreate{RootID: memberRoot, Audience: &closedAudience}, 200)
	administratorView := audienceTyped[service.PublicShare](t, owner, "GET", "/api/v1/file-shares/"+memberShare.Token, nil, 200)
	if administratorView.Denied || administratorView.Permissions == nil || !administratorView.Permissions.Modify {
		t.Fatal("真实系统管理员未获得其他拥有者有效分享的全部能力")
	}
	lookup := audienceTyped[service.AudienceTarget](t, owner, "POST", "/api/console/v1/native/files/audience/lookup", map[string]string{"kind": "account", "key": "audience-member@clouddrive.test"}, 200)
	if lookup.ID != memberID {
		t.Fatal("精确账号查找返回错误主体")
	}
	badCookie := &consoleTestClient{base: owner.base, cookies: map[string]string{iamservice.SessionCookieName: "invalid-session"}}
	audienceHTTP(t, badCookie, "GET", path, nil, 401)
	// 独立目录策略拒绝后代；条目以同owner事务更新。
	policy := service.FileAccessPolicy{Default: denied, Audience: service.ShareAudience{Accounts: []service.AudienceRule{}, Roles: []service.AudienceRule{}}}
	access := audienceTyped[service.FileAccessDetail](t, owner, "PUT", "/api/console/v1/native/files/"+folder+"/access", service.FileAccessUpdate{Revision: 0, Policy: &policy}, 200)
	listing := audienceTyped[service.PublicListing](t, member, "GET", path+"/entries", nil, 200)
	if len(listing.Items) != 1 || listing.Items[0].ID != visible {
		t.Fatal("权限裁剪未在分页之前隐藏子树")
	}
	audienceHTTP(t, member, "GET", path+"/text/"+leaf, nil, 403)
	audienceHTTP(t, member, "GET", path+"/content/"+leaf, nil, 403)
	audienceHTTP(t, member, "POST", path+"/archive", map[string]any{"ids": []string{root}}, 403)
	preview := audienceTyped[service.EffectiveFileAccess](t, owner, "POST", "/api/console/v1/native/files/"+leaf+"/access/effective", map[string]string{"shareId": share.ID, "accountId": memberID}, 200)
	if preview.Permissions.Browse || preview.Source == nil || preview.Source.ID != folder {
		t.Fatal("有效权限预览没有使用真实继承来源")
	}
	audienceHTTP(t, owner, "PUT", "/api/console/v1/native/files/"+folder+"/access", service.FileAccessUpdate{Revision: 0}, 409)
	access = audienceTyped[service.FileAccessDetail](t, owner, "PUT", "/api/console/v1/native/files/"+folder+"/access", service.FileAccessUpdate{Revision: access.Revision}, 200)
	if access.Policy != nil {
		t.Fatal("恢复继承保留了旧独立策略")
	}
	audienceHTTP(t, member, "GET", path+"/text/"+leaf, nil, 200)
	// 新原生下载票据绑定真实主体，不能给匿名重放。
	grant := audienceTyped[service.DownloadGrant](t, member, "POST", path+"/content/"+visible+"/download", nil, 200)
	downloadPath := "/api/v1/file-downloads/" + grant.Ticket
	audienceHTTP(t, anonymous, "GET", downloadPath, nil, 403)
	audienceHTTP(t, member, "GET", downloadPath, nil, 200)
	// 完整tus字节已经上传，随后收回角色；最终发布不得使用旧身份事实。
	payload := []byte("authenticated audience upload")
	digest := sha256.Sum256(payload)
	transfer := audienceTyped[service.SharedTransfer](t, member, "POST", path+"/transfers", service.SharedTransferCreate{ParentID: root, Name: "audience.bin", SizeBytes: int64(len(payload)), SHA256: hex.EncodeToString(digest[:]), ClientKey: "audience-upload-client-key"}, 200)
	request, err := http.NewRequestWithContext(t.Context(), "PATCH", member.base+path+"/transfers/"+transfer.ID+"/data", bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Origin", member.base)
	request.Header.Set("Content-Type", "application/offset+octet-stream")
	request.Header.Set("Tus-Resumable", "1.0.0")
	request.Header.Set("Upload-Offset", "0")
	for name, value := range member.cookies {
		request.AddCookie(&http.Cookie{Name: name, Value: value})
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal("受众上传请求失败")
	}
	_, readErr := io.Copy(io.Discard, response.Body)
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != 204 {
		t.Fatal("受众上传分块未保存")
	}
	roles := owner.request(t, "GET", "/native/iam/accounts/"+memberID+"/roles", nil, 200)
	owner.request(t, "PUT", "/native/iam/accounts/"+memberID+"/roles", map[string]any{"expectedAccountVersion": roles["accountVersion"], "roleIds": []string{}}, 200)
	audienceHTTP(t, member, "GET", downloadPath, nil, 401)
	audienceHTTP(t, member, "POST", path+"/transfers/"+transfer.ID+"/commit", nil, 401)
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "audience-member@clouddrive.test", "password": password}, 200)
	audienceHTTP(t, member, "GET", downloadPath, nil, 403)
	audienceHTTP(t, member, "POST", path+"/transfers/"+transfer.ID+"/commit", nil, 403)
	canceled := audienceTyped[service.SharedTransfer](t, member, "POST", path+"/transfers/"+transfer.ID+"/cancel", nil, 200)
	if canceled.State != model.TransferCanceled || canceled.CleanupPending {
		t.Fatal("撤回角色后不能清理原绑定候选")
	}
	metadata = audienceTyped[service.PublicShare](t, member, "GET", path, nil, 200)
	if !metadata.Denied {
		t.Fatal("角色变更未刷新受众")
	}
	metadata = audienceTyped[service.PublicShare](t, owner, "GET", path, nil, 200)
	if metadata.Denied || metadata.Permissions == nil || !metadata.Permissions.Modify {
		t.Fatal("有效分享中的文件拥有者没有全部能力")
	}
}
