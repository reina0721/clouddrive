package composition

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func verifyBlobCatalog(t *testing.T, owner, member *consoleTestClient, roleID, password, directory string) {
	t.Helper()
	const files = "/native/files"
	const blobs = files + "/blobs"
	const text = "old bytes"
	create := func(name string) string {
		t.Helper()
		return owner.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": name + ".txt", "key": "blob-catalog-" + name, "text": text}, 200)["id"].(string)
	}
	source := create("published-source")
	duplicate := create("same-bytes")
	historyOnly := create("historical-only")
	owner.request(t, "PUT", files+"/"+historyOnly+"/text", map[string]any{"expectedRevision": 1, "text": "replacement"}, 200)
	copyID := owner.request(t, "POST", files+"/"+source+"/copy", map[string]string{"name": "shared-object.txt", "parentId": ""}, 200)["id"].(string)
	owner.request(t, "POST", files+"/"+copyID+"/trash", nil, 200)
	owner.request(t, "PUT", files+"/"+source+"/text", map[string]any{"expectedRevision": 1, "text": "new version"}, 200)
	ownerID := owner.request(t, "GET", files+"/inventory/"+source, nil, 200)["ownerId"].(string)

	anonymous := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	anonymous.request(t, "GET", blobs, nil, 401)
	member.request(t, "GET", blobs, nil, 403)
	member.request(t, "GET", blobs+"/"+source, nil, 403)
	permissions := "/native/iam/roles/" + roleID + "/permissions"
	version := owner.request(t, "GET", permissions, nil, 200)["roleVersion"]
	owner.request(t, "PUT", permissions, map[string]any{"expectedRoleVersion": version, "permissionKeys": []string{"files:blob:read"}}, 200)
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "files-other@clouddrive.test", "password": password}, 200)
	member.request(t, "GET", files+"/inventory", nil, 403)
	member.request(t, "GET", files+"/"+source+"/content", nil, 403)
	read := func(id string) map[string]any {
		t.Helper()
		return member.request(t, "GET", blobs+"/"+id, nil, 200)
	}
	detail := read(source)
	summary := detail["blob"].(map[string]any)
	if detail["exists"] != true || summary["sizeBytes"] != float64(len(text)) || summary["storage"] != "primary" ||
		summary["referenceCount"] != float64(2) || summary["currentCount"] != float64(1) || summary["historyCount"] != float64(1) ||
		summary["ownerCount"] != float64(1) || summary["firstFileCreated"] == "" {
		t.Fatal("对象存在性、大小或引用统计不符")
	}
	for _, key := range []string{"objectKey", "token", "contentSHA", "storageIdentity", "path"} {
		if _, exists := summary[key]; exists {
			t.Fatal("对象响应暴露敏感字段", key)
		}
	}
	foundTrash, foundHistory := false, false
	for _, row := range detail["references"].([]any) {
		ref := row.(map[string]any)
		foundTrash = foundTrash || ref["fileId"] == copyID && ref["current"] == true && ref["trashed"] == true
		foundHistory = foundHistory || ref["fileId"] == source && ref["current"] == false && ref["revision"] == float64(1)
	}
	if !foundTrash || !foundHistory {
		t.Fatal("未展示回收副本和历史版本的引用")
	}
	if other := read(duplicate)["blob"].(map[string]any); other["id"] == summary["id"] || other["referenceCount"] != float64(1) {
		t.Fatal("不同对象被相同内容错误归并")
	}

	list := func(query url.Values) map[string]any {
		t.Helper()
		return member.request(t, "GET", blobs+"?"+query.Encode(), nil, 200)
	}
	onlyHistorical := list(url.Values{"reference": {"history-only"}, "ownerId": {ownerID}, "storage": {"primary"}})
	found := false
	for _, row := range onlyHistorical["items"].([]any) {
		item := row.(map[string]any)
		if item["id"] == source {
			t.Fatal("仅历史引用筛选包含仍有当前副本的对象")
		}
		found = found || item["id"] == historyOnly
	}
	if !found {
		t.Fatal("仅历史引用筛选未找到旧对象")
	}
	current := list(url.Values{"reference": {"current"}, "ownerId": {ownerID}})
	for _, row := range current["items"].([]any) {
		if row.(map[string]any)["currentCount"].(float64) < 1 {
			t.Fatal("当前引用筛选返回了无当前引用的对象")
		}
	}
	historical := list(url.Values{"reference": {"history"}, "ownerId": {ownerID}})
	for _, row := range historical["items"].([]any) {
		if row.(map[string]any)["historyCount"].(float64) < 1 {
			t.Fatal("历史引用筛选返回了无历史引用的对象")
		}
	}
	empty := list(url.Values{"ownerId": {"absent-owner"}, "page": {"2"}})
	if empty["total"] != float64(0) || len(empty["items"].([]any)) != 0 {
		t.Fatal("空对象页未保留总数")
	}
	member.request(t, "GET", blobs+"?sort=object_key", nil, 400)
	member.request(t, "GET", blobs+"/"+source+"?page=10001", nil, 400)
	member.request(t, "GET", blobs+"/11111111-1111-4111-8111-111111111111", nil, 404)

	owner.request(t, "POST", files+"/"+source+"/versions/1/restore", map[string]any{"expectedContentRevision": 2, "expectedHistoryRevision": 1}, 200)
	if restored := read(source)["blob"].(map[string]any); restored["currentCount"] != float64(2) || restored["historyCount"] != float64(0) {
		t.Fatal("恢复版本后的对象引用未实时更新")
	}
	for index := range 20 {
		owner.request(t, "POST", files+"/"+source+"/copy", map[string]string{"name": fmt.Sprintf("blob-copy-%02d.txt", index), "parentId": ""}, 200)
	}
	firstPage := read(source)
	secondPage := member.request(t, "GET", blobs+"/"+source+"?page=2", nil, 200)
	if len(firstPage["references"].([]any)) != 20 || len(secondPage["references"].([]any)) != 2 ||
		secondPage["blob"].(map[string]any)["referenceCount"] != float64(22) {
		t.Fatal("引用详情分页丢失了全局统计")
	}
	page := list(url.Values{"ownerId": {ownerID}, "sort": {"references"}, "direction": {"desc"}})
	if page["items"].([]any)[0].(map[string]any)["id"] != source || page["items"].([]any)[0].(map[string]any)["referenceCount"] != float64(22) {
		t.Fatal("对象排序和所有者过滤未保留全局统计")
	}

	// 只移除本测试临时存储中的合成对象，模拟目录与物理存储分歧。
	if err := os.Remove(filepath.Join(directory, "storage", "files", duplicate)); err != nil {
		t.Fatal(err)
	}
	if missing := read(duplicate); missing["exists"] != false || missing["blob"].(map[string]any)["referenceCount"] != float64(1) {
		t.Fatal("物理对象缺失时未保留真实引用信息")
	}
	owner.request(t, "POST", files+"/"+duplicate+"/trash", nil, 200)
	purge := map[string]any{"scope": "selection", "ids": []string{duplicate}}
	purge["snapshot"] = owner.request(t, "POST", files+"/trash/purge-preview", purge, 200)["snapshot"]
	owner.request(t, "POST", files+"/trash/purge", purge, 200)
	member.request(t, "GET", blobs+"/"+duplicate, nil, 404)
	const reclamation = files + "/blob-reclamation"
	anonymous.request(t, "GET", reclamation, nil, 401)
	member.request(t, "POST", reclamation+"/"+duplicate, nil, 403)
	owner.request(t, "POST", reclamation+"/"+duplicate, nil, 409)
	owner.request(t, "POST", reclamation+"/"+source, nil, 404)
	candidates := member.request(t, "GET", reclamation, nil, 200)
	if candidates["canReclaim"] != false || candidates["automatic"] != false {
		t.Fatal("只读账号可回收或自动回收默认开启")
	}
	foundCandidate := false
	for _, value := range candidates["items"].([]any) {
		item := value.(map[string]any)
		if item["id"] == duplicate {
			foundCandidate = item["ready"] == false && item["sizeBytes"] == float64(len(text)) &&
				item["detachedAt"] != "" && item["readyAt"] != ""
		}
		if _, exposed := item["objectKey"]; exposed {
			t.Fatal("候选披露了存储键")
		}
	}
	if !foundCandidate || owner.request(t, "GET", reclamation, nil, 200)["canReclaim"] != true {
		t.Fatal("未展示候选保护期或管理员权限")
	}
	member.request(t, "GET", reclamation+"?page=10001", nil, 400)

	for index := range 20 {
		create(fmt.Sprintf("paging-object-%02d", index))
	}
	paging := url.Values{"ownerId": {ownerID}, "sort": {"size"}, "direction": {"asc"}, "page": {"1"}}
	firstObjects := list(paging)
	paging.Set("page", "2")
	nextObjects := list(paging)
	if len(firstObjects["items"].([]any)) != 20 || len(nextObjects["items"].([]any)) == 0 || firstObjects["total"] != nextObjects["total"] {
		t.Fatal("Blob 清单分页或总数错误")
	}
	seen := make(map[string]bool)
	var size float64
	for _, page := range []map[string]any{firstObjects, nextObjects} {
		for _, row := range page["items"].([]any) {
			blob := row.(map[string]any)
			id, bytes := blob["id"].(string), blob["sizeBytes"].(float64)
			if seen[id] || bytes < size {
				t.Fatal("大小排序跨页不连续")
			}
			seen[id], size = true, bytes
		}
	}
}
