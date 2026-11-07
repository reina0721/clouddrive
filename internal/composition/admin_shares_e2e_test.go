package composition

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/service"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestAdminSharesModerateAcrossAccounts(t *testing.T) {
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	generate := func() string {
		t.Helper()
		value, err := idgen.UUID().New()
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	setupToken, password := generate(), generate()
	config := strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "admin-shares.db")),
		"mode: development-anonymous", "mode: session", 1)
	writeGenerationConfig(t, configPath, "iam:\n  local:\n    setupToken: "+setupToken+"\n"+config)
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
	const files = "/native/files"
	const catalog = files + "/admin-shares"
	const console = "/api/console/v1"
	const memberEmail = "share-catalog-member@clouddrive.test"
	admin := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	admin.request(t, "GET", "/auth/csrf", nil, 200)
	admin.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setupToken, "email": "share-catalog-admin@clouddrive.test", "name": "管理测试", "password": password}, 200)
	role := admin.request(t, "POST", "/roles", map[string]any{"name": "Share catalog observer", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	rolePath := "/native/iam/roles/" + roleID + "/permissions"
	admin.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	admin.request(t, "POST", "/users", map[string]any{"email": memberEmail, "name": "分享测试", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	member := &consoleTestClient{base: admin.base, cookies: map[string]string{}}
	login := func() {
		t.Helper()
		member.request(t, "GET", "/auth/csrf", nil, 200)
		member.request(t, "POST", "/auth/login", map[string]string{"email": memberEmail, "password": password}, 200)
	}
	login()
	(&consoleTestClient{base: admin.base, cookies: map[string]string{}}).request(t, "GET", catalog, nil, 401)
	member.request(t, "GET", catalog, nil, 403)

	root := member.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": "managed-share.txt", "key": generate(), "text": "share fixture"}, 200)["id"].(string)
	first := audienceTyped[service.ShareSummary](t, member, "POST", console+files+"/shares", service.ShareCreate{RootID: root, Title: "受保护的分享", Password: password}, 200)
	second := audienceTyped[service.ShareSummary](t, member, "POST", console+files+"/shares", service.ShareCreate{RootID: root, Title: "另一个分享"}, 200)
	protectedPath := "/api/v1/file-shares/" + first.Token
	publicShareRequest(t, admin.base, "GET", protectedPath, nil, "", 200)
	unlockBytes := publicShareRequest(t, admin.base, "POST", protectedPath+"/unlock", map[string]string{"password": password}, "", 200)
	var unlock service.UnlockResult
	if err := json.Unmarshal(unlockBytes, &unlock); err != nil || unlock.Ticket == "" {
		t.Fatal("解锁回执无效")
	}
	publicShareRequest(t, admin.base, "GET", protectedPath, nil, unlock.Ticket, 200)
	publicShareRequest(t, admin.base, "POST", protectedPath+"/content/"+root+"/download", nil, "", 403)
	downloadBytes := publicShareRequest(t, admin.base, "POST", protectedPath+"/content/"+root+"/download", nil, unlock.Ticket, 200)
	var grant service.DownloadGrant
	if err := json.Unmarshal(downloadBytes, &grant); err != nil || grant.Ticket == "" {
		t.Fatal("下载票据无效")
	}
	downloadPath := "/api/v1/file-downloads/" + grant.Ticket
	publicShareRequest(t, admin.base, "GET", downloadPath, nil, "", 200)
	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, admin.base+downloadPath, nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Range", "bytes=0-4")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal("范围下载请求失败")
	}
	content, readErr := io.ReadAll(response.Body)
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusPartialContent || string(content) != "share" {
		t.Fatal("下载票据未支持原有 Range 行为")
	}
	read := func(id string) service.AdminShareItem {
		t.Helper()
		raw := audienceHTTP(t, admin, "GET", console+catalog+"/"+id, nil, 200)
		for _, forbidden := range []string{"\"token\"", "\"passwordHash\"", "\"ticket\"", first.Token, grant.Ticket} {
			if bytes.Contains(raw, []byte(forbidden)) {
				t.Fatal("管理详情包含访问凭据")
			}
		}
		var item service.AdminShareItem
		if err := json.Unmarshal(raw, &item); err != nil {
			t.Fatal(err)
		}
		return item
	}
	item := read(first.ID)
	if item.ID != first.ID || item.OwnerID == "" || item.RootID != root || item.RootName == nil || *item.RootName != "managed-share.txt" ||
		item.Views != 1 || item.Downloads != 1 || !item.HasPassword || item.Status != service.ShareActive || item.Revision != first.Revision {
		t.Fatal("管理详情、授权计数或修订不正确")
	}
	list := func(query string) service.AdminSharePage {
		t.Helper()
		return audienceTyped[service.AdminSharePage](t, admin, "GET", console+catalog+"?"+query, nil, 200)
	}
	filter := "ownerId=" + url.QueryEscape(item.OwnerID) + "&rootId=" + root
	if result := list(filter + "&status=active&sort=views"); result.Total != 2 || result.Items[0].ID != first.ID {
		t.Fatal("跨账号过滤或浏览排序不正确")
	}
	if result := list("rootId=" + root + "&sort=downloads&direction=asc"); result.Total != 2 || result.Items[0].ID != second.ID {
		t.Fatal("下载计数排序不正确")
	}
	if result := list(filter + "&page=2"); result.Total != 2 || result.PageSize != 20 || len(result.Items) != 0 {
		t.Fatal("服务端分页不正确")
	}
	admin.request(t, "GET", catalog+"?rootId=invalid", nil, 422)
	admin.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 2, "permissionKeys": []string{"files:read", "files:write", "files:share-admin:read"}}, 200)
	login()
	if result := member.request(t, "GET", catalog, nil, 200); result["canRevoke"] != false {
		t.Fatal("观察者错误获得撤销能力")
	}
	revoke := func(client *consoleTestClient, status int, targets ...service.AdminShareTarget) map[string]any {
		t.Helper()
		return client.request(t, "POST", catalog+"/revoke", map[string]any{"targets": targets}, status)
	}
	firstTarget := service.AdminShareTarget{ID: first.ID, Revision: first.Revision}
	secondTarget := service.AdminShareTarget{ID: second.ID, Revision: second.Revision}
	revoke(member, 403, firstTarget)
	revoke(admin, 422, firstTarget, firstTarget)
	revoke(admin, 409, firstTarget, service.AdminShareTarget{ID: second.ID, Revision: second.Revision + 1})
	if read(first.ID).Status != service.ShareActive {
		t.Fatal("冲突批次部分撤销")
	}
	if result := revoke(admin, 200, firstTarget, secondTarget); result["revoked"] != float64(2) {
		t.Fatal("未撤销两条选中分享")
	}
	if result := list(filter + "&status=revoked"); result.Total != 2 || read(first.ID).RevokedAt == nil {
		t.Fatal("撤销后未显示记录")
	}
	publicShareRequest(t, admin.base, "GET", protectedPath, nil, unlock.Ticket, 404)
	publicShareRequest(t, admin.base, "GET", downloadPath, nil, "", 404)
	member.request(t, "GET", files+"/"+root, nil, 200)
	stop()
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	admin.base = "http://" + coordinator.Diagnostics().BoundAddress
	if persisted := read(first.ID); persisted.Status != service.ShareRevoked || persisted.Views != 1 || persisted.Downloads != 1 {
		t.Fatal("重启后未保留状态和计数")
	}
}
