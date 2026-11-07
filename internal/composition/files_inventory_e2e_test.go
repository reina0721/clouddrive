package composition

import (
	"fmt"
	"net/url"
	"testing"
)

func verifyFileInventory(t *testing.T, owner, member *consoleTestClient, roleID, password string) {
	t.Helper()
	const files = "/native/files"
	const inventory = files + "/inventory"
	const prefix = "Inventory-151-"
	const original = "older"
	const current = "new"
	login := func() {
		t.Helper()
		member.request(t, "GET", "/auth/csrf", nil, 200)
		member.request(t, "POST", "/auth/login", map[string]string{"email": "files-other@clouddrive.test", "password": password}, 200)
	}
	login()
	parent := owner.request(t, "POST", files+"/folders", map[string]string{"parentId": "", "name": "Inventory parent"}, 200)["id"].(string)
	source := owner.request(t, "POST", files+"/text", map[string]string{
		"parentId": parent, "name": prefix + "literal%_a.txt", "key": "inventory-original-fixture", "text": original,
	}, 200)["id"].(string)
	memberFile := member.request(t, "POST", files+"/text", map[string]string{
		"parentId": "", "name": prefix + "member.txt", "key": "inventory-member-fixture", "text": "second account",
	}, 200)["id"].(string)
	owner.request(t, "PUT", files+"/"+source+"/text", map[string]any{"text": current, "expectedRevision": 1}, 200)
	share := owner.request(t, "POST", files+"/shares", map[string]string{"rootId": source}, 200)
	owner.request(t, "POST", files+"/direct-links", map[string]any{"ids": []string{source}}, 200)
	shortcut := owner.request(t, "POST", files+"/shortcuts", map[string]any{"token": share["token"], "name": prefix + "shortcut", "parentId": ""}, 200)

	anonymous := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	anonymous.request(t, "GET", inventory, nil, 401)
	member.request(t, "GET", inventory, nil, 403)
	member.request(t, "GET", inventory+"/"+source, nil, 403)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{
		"expectedRoleVersion": 3, "permissionKeys": []string{"files:write", "files:inventory:read"},
	}, 200)
	login()
	member.request(t, "GET", files+"/"+source, nil, 403)
	member.request(t, "GET", files+"/"+source+"/content", nil, 403)

	detail := member.request(t, "GET", inventory+"/"+source, nil, 200)
	other := member.request(t, "GET", inventory+"/"+memberFile, nil, 200)
	ownerID, memberID := detail["ownerId"].(string), other["ownerId"].(string)
	if ownerID == memberID || detail["sizeBytes"] != float64(len(current)) || detail["quotaBytes"] != float64(len(original)+len(current)) ||
		detail["revision"] != float64(2) || detail["historyCount"] != float64(1) || detail["hasShare"] != true || detail["hasDirectLink"] != true ||
		detail["parentId"] != parent || detail["createdAt"] == "" || detail["updatedAt"] == "" {
		t.Fatal("清单详情的跨账号、大小、版本或链接事实不符")
	}
	for _, key := range []string{"objectKey", "contentSHA", "history", "token", "tokenDigest", "shareToken", "accessPolicy", "uploadKey"} {
		if _, exists := detail[key]; exists {
			t.Fatal("清单暴露了敏感字段", key)
		}
	}
	list := func(values url.Values) map[string]any {
		t.Helper()
		return member.request(t, "GET", inventory+"?"+values.Encode(), nil, 200)
	}
	shared := list(url.Values{"name": {prefix}, "hasShare": {"true"}, "hasDirectLink": {"true"}})
	if shared["total"] != float64(1) || shared["items"].([]any)[0].(map[string]any)["id"] != source {
		t.Fatal("分享和直链过滤未返回精确条目")
	}
	onlyMember := list(url.Values{"name": {prefix}, "ownerId": {memberID}})
	if onlyMember["total"] != float64(1) || onlyMember["items"].([]any)[0].(map[string]any)["id"] != memberFile {
		t.Fatal("所有者过滤有误")
	}
	literal := list(url.Values{"name": {"literal%_"}})
	if literal["total"] != float64(1) || literal["items"].([]any)[0].(map[string]any)["id"] != source {
		t.Fatal("文件名搜索没有按文字处理通配符")
	}
	shortcuts := list(url.Values{"name": {prefix}, "kind": {"shortcut"}})
	if shortcuts["total"] != float64(1) || shortcuts["items"].([]any)[0].(map[string]any)["id"] != shortcut["id"] {
		t.Fatal("快捷方式类型过滤不正确")
	}
	if empty := list(url.Values{"name": {"missing-inventory-151-name"}}); empty["total"] != float64(0) || len(empty["items"].([]any)) != 0 {
		t.Fatal("空筛选结果不正确")
	}
	member.request(t, "GET", inventory+"?sort=owner_id", nil, 400)
	member.request(t, "GET", inventory+"?page=10001", nil, 400)
	member.request(t, "GET", inventory+"/11111111-1111-4111-8111-111111111111", nil, 404)

	owner.request(t, "PUT", files+"/trash/retention", map[string]any{"days": 3, "revision": 0}, 200)
	owner.request(t, "POST", files+"/"+source+"/trash", nil, 200)
	trashed := list(url.Values{"name": {prefix}, "trash": {"direct"}, "kind": {"file"}})
	if trashed["total"] != float64(1) {
		t.Fatal("直接回收筛选没有命中")
	}
	trashedFile := trashed["items"].([]any)[0].(map[string]any)
	if trashedFile["id"] != source || trashedFile["trashedAt"] == nil || trashedFile["expiresAt"] == nil {
		t.Fatal("清单未反映直接回收和到期时间")
	}
	for index := range 22 {
		owner.request(t, "POST", files+"/folders", map[string]string{"parentId": "", "name": fmt.Sprintf("%sfolder-%02d", prefix, index)}, 200)
	}
	paged := url.Values{"name": {prefix}, "kind": {"folder"}, "ownerId": {ownerID}, "sort": {"name"}, "direction": {"asc"}}
	first := list(paged)
	if first["pageSize"] != float64(20) || first["total"] != float64(22) || len(first["items"].([]any)) != 20 ||
		first["items"].([]any)[0].(map[string]any)["name"] != prefix+"folder-00" {
		t.Fatal("页长、总数或名称升序不符")
	}
	paged.Set("page", "2")
	second := list(paged)
	if len(second["items"].([]any)) != 2 || second["items"].([]any)[1].(map[string]any)["name"] != prefix+"folder-21" {
		t.Fatal("第二页不连续")
	}
	paged.Set("page", "1")
	paged.Set("direction", "desc")
	reversed := list(paged)["items"].([]any)
	if reversed[0].(map[string]any)["name"] != prefix+"folder-21" {
		t.Fatal("名称降序不正确")
	}
	bySize := list(url.Values{"name": {prefix}, "kind": {"file"}, "sort": {"size"}, "direction": {"desc"}})
	if bySize["total"] != float64(2) || bySize["items"].([]any)[0].(map[string]any)["id"] != memberFile {
		t.Fatal("全局大小排序不正确")
	}
	byID := list(url.Values{"name": {prefix}, "kind": {"file"}, "sort": {"id"}, "direction": {"asc"}})
	if byID["items"].([]any)[0].(map[string]any)["id"] != min(source, memberFile) {
		t.Fatal("ID 排序不正确")
	}
}
