package composition

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/files/model"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestGlobalFilePropertyDefinitions(t *testing.T) {
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
	config := strings.Replace(generationConfig(directory, 120, 32<<20, filepath.Join(directory, "properties.db")),
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
	const definitionsPath = files + "/property-definitions"
	admin := &consoleTestClient{base: "http://" + coordinator.Diagnostics().BoundAddress, cookies: map[string]string{}}
	admin.request(t, "GET", "/auth/csrf", nil, 200)
	admin.request(t, "POST", "/auth/setup", map[string]string{"setupToken": setupToken, "email": "properties-admin@clouddrive.test", "name": "属性管理员", "password": password}, 200)
	role := admin.request(t, "POST", "/roles", map[string]any{"name": "File property member", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	rolePath := "/native/iam/roles/" + role["id"].(string) + "/permissions"
	admin.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"files:read", "files:write"}}, 200)
	admin.request(t, "POST", "/users", map[string]any{"email": "properties-member@clouddrive.test", "name": "文件属性成员", "password": password, "roleIds": []string{role["id"].(string)}, "status": "active"}, 200)
	member := &consoleTestClient{base: admin.base, cookies: map[string]string{}}
	login := func() {
		t.Helper()
		member.request(t, "GET", "/auth/csrf", nil, 200)
		member.request(t, "POST", "/auth/login", map[string]string{"email": "properties-member@clouddrive.test", "password": password}, 200)
	}
	login()
	member.request(t, "GET", definitionsPath, nil, 403)
	if initial := admin.request(t, "GET", definitionsPath, nil, 200); initial["canSave"] != true || initial["revision"] != float64(0) || len(initial["items"].([]any)) != 0 {
		t.Fatal("初始定义清单或权限错误")
	}
	file := member.request(t, "POST", files+"/text", map[string]string{"parentId": "", "name": "managed-properties.txt", "key": generate(), "text": "body"}, 200)["id"].(string)
	annotations := files + "/" + file + "/annotations"
	write := func(revision int, values []model.Property, status int) map[string]any {
		t.Helper()
		return member.request(t, "PUT", annotations, map[string]any{"expectedRevision": revision, "tags": []model.Tag{}, "properties": values, "emoji": "", "folderColor": ""}, status)
	}
	legacy := []model.Property{{Key: "quantity", Value: "旧记录"}, {Key: "普通", Value: "原值"}}
	write(0, legacy, 200)
	text := func(value string) *string { return &value }
	number := func(value float64) *float64 { return &value }
	definitions := []model.PropertyDefinition{
		{Key: "title", Name: "标题", Kind: model.PropertyText, Minimum: number(2), Maximum: number(4), DefaultValue: text("甲乙")},
		{Key: "quantity", Name: "数量", Kind: model.PropertyNumber, Minimum: number(-2.5), Maximum: number(9.5)},
		{Key: "approved", Name: "已通过", Kind: model.PropertyCheckbox, DefaultValue: text("false")},
		{Key: "stage", Name: "阶段", Kind: model.PropertySelect, Options: []string{"分析", "Cafe\u0301"}},
		{Key: "choices", Name: "标签组", Kind: model.PropertyMultiSelect, Options: []string{"A", "B"}, DefaultValue: text("[\"B\"]")},
		{Key: "website", Name: "参考链接", Kind: model.PropertyLink},
		{Key: "rating", Name: "评分", Kind: model.PropertyRating, Maximum: number(7), DefaultValue: text("5")},
	}
	change := func(revision int64, items []model.PropertyDefinition) model.PropertyDefinitionSet {
		return model.PropertyDefinitionSet{Revision: revision, Items: items}
	}
	member.request(t, "PUT", definitionsPath, change(0, definitions), 403)
	duplicate := append(append([]model.PropertyDefinition{}, definitions...), definitions[0])
	admin.request(t, "PUT", definitionsPath, change(0, duplicate), 422)
	invalidDefault := append([]model.PropertyDefinition{}, definitions...)
	invalidDefault[0].DefaultValue = text("x")
	admin.request(t, "PUT", definitionsPath, change(0, invalidDefault), 422)
	saved := admin.request(t, "PUT", definitionsPath, change(0, definitions), 200)
	if saved["revision"] != float64(1) || len(saved["items"].([]any)) != 7 ||
		saved["items"].([]any)[3].(map[string]any)["options"].([]any)[1] != "Café" {
		t.Fatal("七类定义未保存或选项归一化错误")
	}
	admin.request(t, "PUT", definitionsPath, change(0, definitions), 409)
	admin.request(t, "PUT", rolePath, map[string]any{"expectedRoleVersion": 2, "permissionKeys": []string{"files:read", "files:write", "files:settings:read"}}, 200)
	login()
	if observer := member.request(t, "GET", definitionsPath, nil, 200); observer["canSave"] != false {
		t.Fatal("只有读取权限的成员可管理定义")
	}
	if detail := member.request(t, "GET", annotations, nil, 200); len(detail["propertyDefinitions"].([]any)) != 7 {
		t.Fatal("文件编辑器未获得定义")
	}
	legacy[1].Value = "修改普通属性"
	write(1, legacy, 200)
	for _, invalid := range []model.Property{
		{Key: "title", Value: "x"}, {Key: "quantity", Value: "NaN"}, {Key: "quantity", Value: "10"},
		{Key: "approved", Value: "yes"}, {Key: "stage", Value: "未知"}, {Key: "choices", Value: "[\"A\",\"A\"]"},
		{Key: "choices", Value: "null"}, {Key: "website", Value: "javascript:alert(1)"},
		{Key: "website", Value: "https://user@example.test/"}, {Key: "rating", Value: "8"},
	} {
		write(2, []model.Property{invalid}, 422)
	}
	valid := []model.Property{
		{Key: "title", Value: "甲乙"}, {Key: "quantity", Value: "-1.5"}, {Key: "approved", Value: "false"},
		{Key: "stage", Value: "Cafe\u0301"}, {Key: "choices", Value: "[\"A\",\"B\"]"},
		{Key: "website", Value: "https://example.test/"}, {Key: "rating", Value: "7"}, legacy[1],
	}
	updated := write(2, valid, 200)
	if len(updated["properties"].([]any)) != 8 || updated["revision"] != float64(3) {
		t.Fatal("类型化值未通过正常属性路径保存")
	}
	copyID := member.request(t, "POST", files+"/"+file+"/copy", map[string]string{"name": "property-copy.txt", "parentId": ""}, 200)["id"].(string)
	if copied := member.request(t, "GET", files+"/"+copyID+"/annotations", nil, 200); len(copied["annotation"].(map[string]any)["properties"].([]any)) != 8 {
		t.Fatal("复制丢失文件属性")
	}
	search := member.request(t, "GET", files+"?propertyKey=stage&propertyMatch=equals&propertyValue=Caf%C3%A9", nil, 200)
	if len(search["items"].([]any)) != 2 {
		t.Fatal("类型化属性无法通过原属性搜索匹配")
	}

	definitions[0].Name = "新标题"
	definitions[0].Maximum = number(3)
	admin.request(t, "PUT", definitionsPath, change(1, definitions), 200)
	definitions = append(definitions[:1], definitions[2:]...)
	admin.request(t, "PUT", definitionsPath, change(2, definitions), 200)
	stop()
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	admin.base = "http://" + coordinator.Diagnostics().BoundAddress
	member.base = admin.base
	if persisted := admin.request(t, "GET", definitionsPath, nil, 200); persisted["revision"] != float64(3) ||
		len(persisted["items"].([]any)) != 6 || persisted["items"].([]any)[0].(map[string]any)["name"] != "新标题" {
		t.Fatal("重启后定义编辑或移除没有保留")
	}
	detail := member.request(t, "GET", annotations, nil, 200)
	if len(detail["annotation"].(map[string]any)["properties"].([]any)) != 8 {
		t.Fatal("移除定义损坏既有文件属性")
	}
	valid[1].Value = "恢复为普通值"
	write(3, valid, 200)
}
