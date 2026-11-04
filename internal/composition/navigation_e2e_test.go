package composition

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

// shortcutRedirect 验证真实303与片段，不跟随到由独立前端承载的分享页。
func shortcutRedirect(t *testing.T, client *consoleTestClient, id string, status int) string {
	t.Helper()
	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, client.base+"/api/console/v1/native/files/shortcuts/"+id+"/open", nil)
	if err != nil {
		t.Fatal(err)
	}
	for name, value := range client.cookies {
		request.AddCookie(&http.Cookie{Name: name, Value: value})
	}
	transport := &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := transport.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	_, readErr := io.Copy(io.Discard, response.Body)
	if err := errors.Join(readErr, response.Body.Close()); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != status {
		t.Fatalf("快捷方式跳转状态 %d，预期%d", response.StatusCode, status)
	}
	if response.Header.Get("Cache-Control") != "private, no-store" || response.Header.Get("Referrer-Policy") != "no-referrer" {
		t.Fatal("快捷方式响应未保护缓存与引用来源")
	}
	return response.Header.Get("Location")
}

func TestSavedSharesLifecyclePinCASAuthorizationAndRestart(t *testing.T) {
	directory := t.TempDir()
	dbPath := filepath.Join(directory, "shortcuts.db")
	configPath := filepath.Join(directory, "config.yaml")
	setup, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	password, err := idgen.UUID().New()
	if err != nil {
		t.Fatal(err)
	}
	payload := "iam:\n  local:\n    setupToken: " + setup + "\n" + strings.Replace(generationConfig(directory, 120, 32<<20, dbPath), "mode: development-anonymous", "mode: session", 1)
	payload = strings.Replace(payload, "files:\n", "files:\n  navigation:\n    shortcutLimit: 4\n    pinLimit: 3\n    treeEntries: 10\n    pageSize: 2\n", 1)
	writeGenerationConfig(t, configPath, payload)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	stop := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := coordinator.Stop(ctx); err != nil {
			t.Error(err)
		}
	}
	defer func() { stop() }()
	owner := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "shortcut-owner@clouddrive.test", "name": "原文件所有者", "password": password}, 200)
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "保存分享用户", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	owner.request(t, "POST", "/users", map[string]any{"email": "shortcut-member@clouddrive.test", "name": "引用所有者", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	member := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "shortcut-member@clouddrive.test", "password": password}, 200)
	root := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "原分享目录", "parentId": ""}, 200)["id"].(string)
	original := owner.request(t, "POST", "/native/files/text", map[string]string{"name": "原始.txt", "parentId": root, "text": "不能被引用删除的内容", "key": "shortcut-original-fixture"}, 200)["id"].(string)
	share := owner.request(t, "POST", "/native/files/shares", map[string]string{"rootId": root, "password": password}, 200)
	token := share["token"].(string)
	folder := member.request(t, "POST", "/native/files/folders", map[string]string{"name": "收藏目录", "parentId": ""}, 200)["id"].(string)
	save := func(name, parent string, status int) map[string]any {
		return member.request(t, "POST", "/native/files/shortcuts", map[string]string{"token": token, "name": name, "parentId": parent}, status)
	}
	save("跨账号目录", root, 404)
	entry := save("保存的分享", folder, 200)
	id := entry["id"].(string)
	raw, err := json.Marshal(entry)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), token) || entry["kind"] != "shortcut" || entry["sizeBytes"] != float64(0) {
		t.Fatal("快捷方式泄露标识或产生对象字节")
	}
	if save("保存的分享", folder, 200)["id"] != id {
		t.Fatal("相同保存非幂等")
	}
	owner.request(t, "GET", "/native/files/"+id, nil, 404)
	shortcutRedirect(t, owner, id, 404)
	destination, err := url.Parse(shortcutRedirect(t, member, id, 303))
	if err != nil {
		t.Fatal(err)
	}
	if destination.Path != "/share" || destination.RawQuery != "" || destination.Host != "" || destination.Fragment != "token="+token {
		t.Fatal("原分享标识不在独立片段")
	}
	publicRequest, err := http.NewRequestWithContext(t.Context(), http.MethodGet, owner.base+"/api/v1/file-shares/"+token, nil)
	if err != nil {
		t.Fatal(err)
	}
	publicResponse, err := http.DefaultClient.Do(publicRequest)
	if err != nil {
		t.Fatal(err)
	}
	metadata := map[string]any{}
	decodeErr := json.NewDecoder(publicResponse.Body).Decode(&metadata)
	if err := errors.Join(decodeErr, publicResponse.Body.Close()); err != nil {
		t.Fatal(err)
	}
	if publicResponse.StatusCode != 200 {
		t.Fatalf("访客metadata状态%d", publicResponse.StatusCode)
	}
	if metadata["locked"] != true || metadata["root"] != nil {
		t.Fatal("保存引用绕过了密码保护")
	}
	member.request(t, "GET", "/native/files/"+id+"/content", nil, 422)
	member.request(t, "PUT", "/native/files/"+id+"/text", map[string]any{"expectedRevision": 1, "text": "不能写入"}, 422)
	member.request(t, "POST", "/native/files/archive", map[string]any{"ids": []string{id}}, 422)
	member.request(t, "POST", "/native/files/shares", map[string]string{"rootId": id, "password": ""}, 422)
	listing := member.request(t, "GET", "/native/files/shortcuts?state=protected", nil, 200)
	if len(listing["items"].([]any)) != 1 {
		t.Fatal("受保护状态筛选失效")
	}
	member.request(t, "PATCH", "/native/files/"+id, map[string]any{"name": "缺失版本"}, 409)
	renamed := member.request(t, "PATCH", "/native/files/"+id, map[string]any{"name": "重命名引用", "expectedRevision": 1}, 200)
	if renamed["contentRevision"] != float64(2) {
		t.Fatal("引用版本未递增")
	}
	member.request(t, "PATCH", "/native/files/"+id, map[string]any{"name": "并发旧版本", "expectedRevision": 1}, 409)
	// 三类固定项均持久化，所有写入以整个owner集合版本执行CAS。
	addPin := func(kind, target string, revision int, status int) map[string]any {
		return member.request(t, "POST", "/native/files/pins", map[string]any{"targetKind": kind, "targetId": target, "revision": revision}, status)
	}
	addPin("folder", folder, 0, 200)
	addPin("shared", "", 0, 409)
	addPin("shared", "", 1, 200)
	addPin("shortcut", id, 2, 200)
	addPin("folder", "", 3, 413)
	pins := member.request(t, "GET", "/native/files/pins", nil, 200)
	items := pins["items"].([]any)
	if len(items) != 3 || items[2].(map[string]any)["name"] != "重命名引用" {
		t.Fatal("固定标签没有使用当前引用名称")
	}
	ids := []string{items[2].(map[string]any)["id"].(string), items[0].(map[string]any)["id"].(string), items[1].(map[string]any)["id"].(string)}
	member.request(t, "PUT", "/native/files/pins/order", map[string]any{"revision": 3, "ids": ids}, 200)
	member.request(t, "PUT", "/native/files/pins/order", map[string]any{"revision": 3, "ids": ids}, 409)
	member.request(t, "PUT", "/native/files/pins/order", map[string]any{"revision": 4, "ids": []string{ids[0], ids[0], ids[1]}}, 422)
	member.request(t, "PATCH", "/native/files/"+id, map[string]any{"parentId": "", "expectedRevision": 2}, 200)
	credential := member.request(t, "POST", "/native/files/connections", map[string]any{"name": "引用字节边界", "rootId": "", "readOnly": true, "blockSystemFiles": true}, 200)
	davRequest(t, member, credential, "GET", url.PathEscape("重命名引用"), nil, nil, 501)
	xml, _ := davRequest(t, member, credential, "PROPFIND", "", nil, map[string]string{"Depth": "1"}, 207)
	if strings.Contains(string(xml), token) {
		t.Fatal("DAV元数据泄露分享标识")
	}
	copied := member.request(t, "POST", "/native/files/"+id+"/copy", map[string]string{"parentId": folder, "name": "复制引用"}, 200)
	// 复制目录必须保留内部引用，并把全部新增引用计入同一预算。
	copiedFolder := member.request(t, "POST", "/native/files/"+folder+"/copy", map[string]string{"parentId": "", "name": "目录副本"}, 200)["id"].(string)
	child := member.request(t, "GET", "/native/files?parent="+copiedFolder, nil, 200)["items"].([]any)[0].(map[string]any)
	shortcutRedirect(t, member, child["id"].(string), 303)
	save("第四条", "", 200)
	save("超过数量", "", 413)
	member.request(t, "POST", "/native/files/"+folder+"/copy", map[string]string{"parentId": "", "name": "超预算目录副本"}, 413)
	firstPage := member.request(t, "GET", "/native/files/shortcuts?search=引用", nil, 200)
	if len(firstPage["items"].([]any)) != 2 || firstPage["nextCursor"] == "" {
		t.Fatal("引用搜索或分页失效")
	}
	secondPage := member.request(t, "GET", "/native/files/shortcuts?search=引用&cursor="+firstPage["nextCursor"].(string), nil, 200)
	if len(secondPage["items"].([]any)) != 1 {
		t.Fatal("下一页未续接稳定游标")
	}
	member.request(t, "DELETE", "/native/files/shortcuts/"+id, map[string]int{"revision": 3}, 409)
	trashed := member.request(t, "POST", "/native/files/"+id+"/trash", nil, 200)
	shortcutRedirect(t, member, id, 404)
	pins = member.request(t, "GET", "/native/files/pins", nil, 200)
	if pins["items"].([]any)[0].(map[string]any)["available"] != false {
		t.Fatal("回收后固定项仍可用")
	}
	member.request(t, "POST", "/native/files/"+id+"/restore", map[string]string{}, 200)
	shortcutRedirect(t, member, id, 303)
	pins = member.request(t, "GET", "/native/files/pins", nil, 200)
	if pins["items"].([]any)[0].(map[string]any)["available"] != true {
		t.Fatal("恢复后固定项未重新可用")
	}
	trashed = member.request(t, "POST", "/native/files/"+id+"/trash", nil, 200)
	member.request(t, "DELETE", "/native/files/shortcuts/"+id, map[string]any{"revision": 1}, 409)
	member.request(t, "DELETE", "/native/files/shortcuts/"+id, map[string]any{"revision": trashed["contentRevision"]}, 204)
	member.request(t, "GET", "/native/files/"+id, nil, 404)
	owner.request(t, "GET", "/native/files/"+original, nil, 200)
	pins = member.request(t, "GET", "/native/files/pins", nil, 200)
	if len(pins["items"].([]any)) != 2 || pins["revision"] != float64(5) {
		t.Fatal("删除引用未原子清理固定项或递增集合版本")
	}
	lastPin := pins["items"].([]any)[1].(map[string]any)["id"].(string)
	member.request(t, "DELETE", "/native/files/pins/"+lastPin, map[string]int{"revision": 4}, 409)
	member.request(t, "DELETE", "/native/files/pins/"+lastPin, map[string]int{"revision": 5}, 200)
	// 引用不授予原始文件owner能力；撤去当前权限立即阻止新保存及读取。
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 2, "permissionKeys": []string{"files:read"}}, 200)
	save("无写权限", "", 401)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 3, "permissionKeys": []string{}}, 200)
	member.request(t, "GET", "/native/files/shortcuts", nil, 401)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 4, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	// IAM权限变更会撤销旧会话；恢复权限后仍需重新登录，不能复活旧Cookie。
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "shortcut-member@clouddrive.test", "password": password}, 200)
	copiedID := copied["id"].(string)
	owner.request(t, "POST", "/native/files/"+root+"/trash", nil, 200)
	shortcutRedirect(t, member, copiedID, 404)
	owner.request(t, "POST", "/native/files/"+root+"/restore", map[string]string{}, 200)
	shortcutRedirect(t, member, copiedID, 303)
	owner.request(t, "POST", "/native/files/shares/"+share["id"].(string)+"/revoke", nil, 200)
	shortcutRedirect(t, member, copiedID, 404)
	unavailable := member.request(t, "GET", "/native/files/shortcuts?state=unavailable", nil, 200)
	if unavailable["items"].([]any)[0].(map[string]any)["target"].(map[string]any)["status"] != "revoked" {
		t.Fatal("撤销状态未传播")
	}
	// 真正停止并重建composition，验证条目与顺序不依赖进程内存。
	stop()
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	member.base = owner.base
	pins = member.request(t, "GET", "/native/files/pins", nil, 200)
	if len(pins["items"].([]any)) != 1 || pins["items"].([]any)[0].(map[string]any)["targetId"] != folder {
		t.Fatal("重启后固定顺序或目标丢失")
	}
	member.request(t, "GET", "/native/files/"+copiedID, nil, 200)
	// 在隔离库里推进到期；不等待真实时钟，也不改用户运行库。
	expiring := owner.request(t, "POST", "/native/files/shares", map[string]string{"rootId": root, "password": ""}, 200)
	expiredEntry := member.request(t, "POST", "/native/files/shortcuts", map[string]string{"token": expiring["token"].(string), "name": "到期引用", "parentId": ""}, 200)
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = dbPath
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	updateErr := database.UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		return db.Table("files_shares").Where("id = ?", expiring["id"]).Update("expires_at", time.Now().UTC().Add(-time.Minute)).Error
	})
	if err := errors.Join(updateErr, resource.Close()); err != nil {
		t.Fatal(err)
	}
	shortcutRedirect(t, member, expiredEntry["id"].(string), 404)
	// 超过元数据预算时拒绝引用读取，固定集合仍可取消，不隐藏为可访问。
	for index := 0; index < 6; index++ {
		member.request(t, "POST", "/native/files/folders", map[string]string{"parentId": "", "name": fmt.Sprintf("预算目录%d", index)}, 200)
	}
	member.request(t, "GET", "/native/files/shortcuts", nil, 413)
	pins = member.request(t, "GET", "/native/files/pins", nil, 200)
	if pins["metadataLimited"] != true {
		t.Fatal("元数据超预算未报告")
	}
	member.request(t, "DELETE", "/native/files/pins/"+pins["items"].([]any)[0].(map[string]any)["id"].(string), map[string]any{"revision": pins["revision"]}, 200)
}
