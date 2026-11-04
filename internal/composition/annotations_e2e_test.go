package composition

import (
	"context"
	"encoding/json"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAnnotationsHTTPPersistencePrivacyAndAtomicity(t *testing.T) {
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
	payload := "iam:\n  local:\n    setupToken: " + setup + "\n" + strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "annotations.db")), "mode: development-anonymous", "mode: session", 1)
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "annotation-owner@clouddrive.test", "name": "整理验收", "password": password}, 200)
	root := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "整理根", "parentId": ""}, 200)["id"].(string)
	file := owner.request(t, "POST", "/native/files/text", map[string]string{"name": "sample.txt", "parentId": root, "key": "annotation-http-file", "text": "original"}, 200)["id"].(string)
	second := owner.request(t, "POST", "/native/files/text", map[string]string{"name": "second.txt", "parentId": root, "key": "annotation-http-second", "text": ""}, 200)["id"].(string)
	annotationPath := func(id string) string { return "/native/files/" + id + "/annotations" }
	read := func(id string) map[string]any {
		return owner.request(t, "GET", annotationPath(id), nil, 200)["annotation"].(map[string]any)
	}
	write := func(id string, revision float64, tags []map[string]string, properties []map[string]string, emoji string) map[string]any {
		return owner.request(t, "PUT", annotationPath(id), map[string]any{"expectedRevision": revision, "tags": tags, "properties": properties, "emoji": emoji, "folderColor": ""}, 200)
	}
	initial := read(file)
	if initial["revision"] != float64(0) || len(initial["tags"].([]any)) != 0 {
		t.Fatal("初始注解语义错误")
	}
	tag := []map[string]string{{"name": "私有标签,甲", "color": "#4589ab"}}
	properties := []map[string]string{{"key": "Project", "value": "private-annotation-sentinel"}, {"key": "Empty", "value": ""}}
	saved := write(file, 0, tag, properties, "📄")
	if saved["revision"] != float64(1) {
		t.Fatal("保存版本错误")
	}
	owner.request(t, "PUT", annotationPath(file), map[string]any{"expectedRevision": 0, "tags": []any{}, "properties": []any{}, "emoji": "", "folderColor": ""}, 409)
	owner.request(t, "POST", "/native/files/annotations/tags-batch", map[string]any{"targets": []map[string]any{{"id": second, "revision": 0}, {"id": file, "revision": 0}}, "add": []map[string]string{{"name": "批量", "color": "#4589ab"}}, "remove": []string{}}, 409)
	if read(second)["revision"] != float64(0) {
		t.Fatal("批量冲突部分提交")
	}
	summaries := owner.request(t, "GET", "/native/files/annotations/summaries?ids="+file+"&ids="+second, nil, 200)["items"].([]any)
	if len(summaries) != 2 {
		t.Fatal("批量摘要错误")
	}
	for _, query := range []string{"tags=" + url.QueryEscape("私有标签,甲"), "propertyKey=Empty&propertyMatch=equals&propertyValue=", "propertyKey=Project&propertyMatch=contains&propertyValue=ANNOTATION"} {
		result := owner.request(t, "GET", "/native/files?pageSize=50&"+query, nil, 200)
		if len(result["items"].([]any)) != 1 || len(result["annotationSummaries"].([]any)) != 1 {
			t.Fatal("真实注解查询错误")
		}
	}
	owner.request(t, "GET", "/native/files?propertyValue=orphan", nil, 400)
	owner.request(t, "GET", "/native/files?propertyKey=Project&propertyMatch=exists&propertyValue=bad", nil, 422)
	legacy := owner.request(t, "GET", "/native/files/"+file, nil, 200)
	legacyJSON, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(legacyJSON), "private-annotation-sentinel") || strings.Contains(string(legacyJSON), "annotation_json") {
		t.Fatal("普通Entry泄露私有注解")
	}
	share := owner.request(t, "POST", "/native/files/shares", map[string]string{"rootId": root}, 200)
	public := publicShareRequest(t, owner.base, "GET", "/api/v1/file-shares/"+share["token"].(string)+"/entries", nil, "", 200)
	if strings.Contains(string(public), "私有标签") || strings.Contains(string(public), "private-annotation-sentinel") {
		t.Fatal("公开分享泄露注解")
	}
	credential := owner.request(t, "POST", "/native/files/connections", map[string]any{"name": "整理协议", "rootId": root, "readOnly": false, "blockSystemFiles": true}, 200)
	xml, _ := davRequest(t, owner, credential, "PROPFIND", "", nil, map[string]string{"Depth": "1"}, 207)
	if strings.Contains(string(xml), "private-annotation-sentinel") || strings.Contains(string(xml), "私有标签") {
		t.Fatal("DAV属性泄露私有注解")
	}
	davRequest(t, owner, credential, "PUT", "sample.txt", strings.NewReader("replacement"), nil, 204)
	if read(file)["revision"] != float64(1) || read(file)["properties"].([]any)[0].(map[string]any)["value"] != "private-annotation-sentinel" {
		t.Fatal("协议覆盖丢失注解")
	}
	davRequest(t, owner, credential, "COPY", "sample.txt", nil, map[string]string{"Destination": owner.base + credential["endpointPath"].(string) + "copy.txt"}, 201)
	copied := owner.request(t, "GET", "/native/files?parent="+root+"&search=copy.txt", nil, 200)["items"].([]any)[0].(map[string]any)["id"].(string)
	if read(copied)["tags"].([]any)[0].(map[string]any)["name"] != "私有标签,甲" {
		t.Fatal("DAV复制丢失注解")
	}
	owner.request(t, "POST", "/native/files/"+root+"/trash", nil, 200)
	owner.request(t, "GET", annotationPath(file), nil, 404)
	owner.request(t, "GET", "/native/files/annotations/summaries?visibility=trash&ids="+file, nil, 404)
	owner.request(t, "GET", "/native/files/annotations/summaries?visibility=trash&ids="+root, nil, 200)
	owner.request(t, "POST", "/native/files/"+root+"/restore", map[string]string{}, 200)
	if read(file)["revision"] != float64(1) {
		t.Fatal("恢复丢失版本")
	}
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "整理成员", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	owner.request(t, "POST", "/users", map[string]any{"email": "annotation-member@clouddrive.test", "name": "整理成员", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	member := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "annotation-member@clouddrive.test", "password": password}, 200)
	member.request(t, "GET", annotationPath(file), nil, 404)
	member.request(t, "GET", "/native/files/annotations/summaries?ids="+file, nil, 404)
	member.request(t, "PUT", annotationPath(file), map[string]any{"expectedRevision": 1, "tags": []any{}, "properties": []any{}, "emoji": "", "folderColor": ""}, 404)
	// 真正停止并新建运行代，验证JSON、版本和当前授权从数据库恢复。
	stopCtx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	stopErr := coordinator.Stop(stopCtx)
	cancel()
	if stopErr != nil {
		t.Fatal(stopErr)
	}
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	owner.request(t, "GET", "/auth/csrf", nil, 200)
	persisted := read(file)
	if persisted["revision"] != float64(1) || persisted["emoji"] != "📄" {
		t.Fatal("重启丢失注解")
	}
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 2, "permissionKeys": []string{}}, 200)
	member.base = owner.base
	member.request(t, "GET", annotationPath(file), nil, 401)
}
