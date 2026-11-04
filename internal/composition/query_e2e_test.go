package composition

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/idgen"
	"gorm.io/gorm"
)

func TestAdvancedQueryHTTPOptionalBoundsOwnershipAndDatabaseBudget(t *testing.T) {
	directory := t.TempDir()
	dbPath := filepath.Join(directory, "query.db")
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
	payload = strings.Replace(payload, "files:\n", "files:\n  search:\n    treeEntries: 12\n", 1)
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
	owner.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setup, "email": "query-owner@clouddrive.test", "name": "查询验收", "password": password}, 200)
	folder := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "查询根目录", "parentId": ""}, 200)["id"].(string)
	nested := owner.request(t, "POST", "/native/files/folders", map[string]string{"name": "后代目录", "parentId": folder}, 200)["id"].(string)
	alpha := owner.request(t, "POST", "/native/files/text", map[string]string{"name": "Alpha-report,final.TXT", "parentId": folder, "text": "abcdefghij", "key": "advanced-query-alpha-key"}, 200)["id"].(string)
	beta := owner.request(t, "POST", "/native/files/text", map[string]string{"name": "beta-report.md", "parentId": nested, "text": "", "key": "advanced-query-beta-key"}, 200)["id"].(string)
	get := func(query string) map[string]any { return owner.request(t, "GET", "/native/files?"+query, nil, 200) }
	requireIDs := func(query string, want ...string) {
		t.Helper()
		result := get(query)
		entries := result["items"].([]any)
		if len(entries) != len(want) {
			t.Fatalf("查询返回%d项，预期%d", len(entries), len(want))
		}
		expected := map[string]bool{}
		for _, id := range want {
			expected[id] = true
		}
		for _, value := range entries {
			if !expected[value.(map[string]any)["id"].(string)] {
				t.Fatal("查询返回范围外条目")
			}
		}
		if result["usedBytes"] != float64(10) {
			t.Fatal("过滤改变了逻辑占用")
		}
	}
	requireIDs("scope=all&keywords="+url.QueryEscape("report,final"), alpha)
	requireIDs("scope=all&keywords=ALPHA&keywords=report&match=all", alpha)
	requireIDs("scope=all&keywords=Alpha&keywords=beta&match=any", alpha, beta)
	requireIDs("scope=all&keywords=alpha&caseSensitive=true")
	requireIDs("scope=folder&parent="+folder+"&keywords=report", alpha)
	requireIDs("scope=tree&parent="+folder+"&keywords=report", alpha, beta)
	requireIDs("scope=all&extensions=TXT&extensions=.md", alpha, beta)
	requireIDs("scope=all&kinds=file&minBytes=0&maxBytes=0", beta)
	requireIDs("scope=all&minBytes=10&maxBytes=10", alpha)
	// 只推进隔离库的日期字段，验证参数缺失与整日边界，不等待墙钟。
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = dbPath
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	base := time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC)
	updateErr := database.UseGORM(t.Context(), resource.Client(), func(db *gorm.DB) error {
		if err := db.Table("files_entries").Where("id = ?", alpha).Updates(map[string]any{"created_at": base.Add(23 * time.Hour), "updated_at": base.Add(48 * time.Hour)}).Error; err != nil {
			return err
		}
		return db.Table("files_entries").Where("id = ?", beta).Updates(map[string]any{"created_at": base.Add(24 * time.Hour), "updated_at": base.Add(72 * time.Hour)}).Error
	})
	if err := errors.Join(updateErr, resource.Close()); err != nil {
		t.Fatal(err)
	}
	requireIDs("scope=all&kinds=file&createdFrom=2026-11-03T00%3A00%3A00Z&createdTo=2026-11-04T00%3A00%3A00Z", alpha)
	requireIDs("scope=all&kinds=file&modifiedFrom=2026-11-05T00%3A00%3A00Z&modifiedTo=2026-11-06T00%3A00%3A00Z", alpha)
	for _, scenario := range []struct {
		query  string
		status int
	}{{"minBytes=2&maxBytes=1", 422}, {"keywords=&keywords=Alpha", 400}, {"extensions=", 400}, {"minBytes=", 400}, {"createdFrom=not-a-time", 400}, {"createdFrom=2026-11-04T00%3A00%3A00Z&createdTo=2026-11-03T00%3A00%3A00Z", 422}, {"scope=public", 400}, {"match=regexp", 400}, {"pageSize=201", 400}, {"page=2&pageSize=0", 422}} {
		owner.request(t, "GET", "/native/files?"+scenario.query, nil, scenario.status)
	}
	page := get("scope=tree&parent=" + folder + "&pageSize=1&foldersFirst=true&desc=true")
	if page["total"] != float64(3) || page["page"] != float64(1) || page["items"].([]any)[0].(map[string]any)["kind"] != "folder" {
		t.Fatal("真实分页或目录优先错误")
	}
	requireIDs("scope=tree&parent=" + folder + "&pageSize=1&page=99")
	role := owner.request(t, "POST", "/roles", map[string]any{"name": "检索成员", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	owner.request(t, "POST", "/users", map[string]any{"email": "query-member@clouddrive.test", "name": "检索成员", "password": password, "roleIds": []string{roleID}, "status": "active"}, 200)
	member := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	member.request(t, "GET", "/auth/csrf", nil, 200)
	member.request(t, "POST", "/auth/login", map[string]string{"email": "query-member@clouddrive.test", "password": password}, 200)
	if len(member.request(t, "GET", "/native/files?scope=all&keywords=report", nil, 200)["items"].([]any)) != 0 {
		t.Fatal("查询跨owner")
	}
	member.request(t, "GET", "/native/files?scope=tree&parent="+folder, nil, 404)
	owner.request(t, "POST", "/native/files/"+folder+"/trash", nil, 200)
	requireIDs("scope=all&keywords=report")
	owner.request(t, "POST", "/native/files/"+folder+"/restore", map[string]string{}, 200)
	requireIDs("scope=tree&parent="+folder+"&keywords=report", alpha, beta)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 2, "permissionKeys": []string{}}, 200)
	member.request(t, "GET", "/native/files?scope=all", nil, 401)
	for index := 0; index < 9; index++ {
		owner.request(t, "POST", "/native/files/folders", map[string]string{"parentId": "", "name": fmt.Sprintf("预算%d", index)}, 200)
	}
	owner.request(t, "GET", "/native/files?pageSize=1", nil, 413)
}
