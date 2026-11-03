package composition

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/reina0721/clouddrive/internal/module/iam/service"
)

// TestIAMRBACSQLiteRuntimeFlow 验证真实 SQLite runtime 的授权闭环：
// setup -> role -> 权限 -> account -> 分配角色 -> 首次改密 -> login ->
// allow -> revoke -> deny，全程通过 HTTP operation gate 与 Casbin evaluator。
func TestIAMRBACSQLiteRuntimeFlow(t *testing.T) {
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	base := generationConfig(directory, 120, 1<<20, filepath.Join(directory, "iam-e2e.db"))
	payload := strings.Replace(base, "auth:", "iam:\n  local:\n    setupToken: setup-secret\nauth:", 1)
	if payload == base {
		t.Fatal("iam setup token was not injected into config")
	}
	writeGenerationConfig(t, configPath, payload)
	coordinator, _ := newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = coordinator.Stop(ctx)
	}()
	address := coordinator.Diagnostics().BoundAddress
	if address == "" {
		t.Fatal("generation bound address is empty")
	}

	// setup：首次创建 owner，获得完整 Catalog 权限与 session。
	setup := doJSON(t, address, http.MethodPost, "/api/v1/iam/setup", `{"setupToken":"setup-secret","username":"owner","displayName":"Owner","password":"123456789012345"}`, "", "")
	if setup.code != http.StatusCreated {
		t.Fatalf("setup status = %d, body = %s", setup.code, setup.body)
	}
	owner := iamClient{address: address, cookie: setup.cookie, csrf: setup.csrf}

	// owner 会话读取（iam-rbac 首次放行：self:read），并旋转 CSRF。
	rotated := owner.roundTrip(t, http.MethodGet, "/api/v1/iam/session", "")
	owner.csrf = rotated.csrf

	// 创建 reader 角色并授予 iam:role:read。
	createRole := owner.roundTrip(t, http.MethodPost, "/api/v1/iam/roles", `{"code":"reader","name":"Reader","description":""}`)
	if createRole.code != http.StatusCreated {
		t.Fatalf("create role status = %d, body = %s", createRole.code, createRole.body)
	}
	roleID := jsonField(createRole.body, "id")
	roleVersion := uint64(jsonFieldNumber(createRole.body, "version"))
	// reader 角色授予业务只读权限与首次改密所需的两个自助权限。
	grant := owner.roundTrip(t, http.MethodPut, "/api/v1/iam/roles/"+roleID+"/permissions",
		`{"expectedRoleVersion":`+itoa(roleVersion)+`,"permissionKeys":["iam:role:read","iam:account:self:read","iam:account:self:password:write"]}`)
	if grant.code != http.StatusOK {
		t.Fatalf("grant permissions status = %d, body = %s", grant.code, grant.body)
	}

	// 创建账号并分配 reader 角色。
	createAccount := owner.roundTrip(t, http.MethodPost, "/api/v1/iam/accounts", `{"username":"member","displayName":"Member","password":"abcdefghijklmno"}`)
	if createAccount.code != http.StatusCreated {
		t.Fatalf("create account status = %d, body = %s", createAccount.code, createAccount.body)
	}
	accountID := jsonField(createAccount.body, "id")
	assign := owner.roundTrip(t, http.MethodPut, "/api/v1/iam/accounts/"+accountID+"/roles", `{"expectedAccountVersion":1,"roleIds":["`+roleID+`"]}`)
	if assign.code != http.StatusOK {
		t.Fatalf("assign roles status = %d, body = %s", assign.code, assign.body)
	}

	// member 首次登录：MustChangePassword -> 受限，非自助权限被拒绝。
	first := doJSON(t, address, http.MethodPost, "/api/v1/iam/login", `{"username":"member","password":"abcdefghijklmno"}`, "", "")
	if first.code != http.StatusOK {
		t.Fatalf("first login status = %d, body = %s", first.code, first.body)
	}
	member := iamClient{address: address, cookie: first.cookie, csrf: first.csrf}
	if restricted := member.roundTrip(t, http.MethodGet, "/api/v1/iam/roles", ""); restricted.code != http.StatusForbidden {
		t.Fatalf("restricted first-login status = %d, want 403", restricted.code)
	}
	// 首次改密后可重新登录。
	changed := member.roundTrip(t, http.MethodPost, "/api/v1/iam/self/password", `{"currentPassword":"abcdefghijklmno","newPassword":"ponmlkjihgfedcb"}`)
	if changed.code != http.StatusNoContent {
		t.Fatalf("change password status = %d, body = %s", changed.code, changed.body)
	}
	second := doJSON(t, address, http.MethodPost, "/api/v1/iam/login", `{"username":"member","password":"ponmlkjihgfedcb"}`, "", "")
	if second.code != http.StatusOK {
		t.Fatalf("second login status = %d, body = %s", second.code, second.body)
	}
	member = iamClient{address: address, cookie: second.cookie, csrf: second.csrf}

	// allow：member 有 iam:role:read。
	if allowed := member.roundTrip(t, http.MethodGet, "/api/v1/iam/roles", ""); allowed.code != http.StatusOK {
		t.Fatalf("member roles list status = %d, want 200", allowed.code)
	}
	// deny：member 没有 iam:account:read。
	if denied := member.roundTrip(t, http.MethodGet, "/api/v1/iam/accounts", ""); denied.code != http.StatusForbidden {
		t.Fatalf("member accounts list status = %d, want 403", denied.code)
	}

	// revoke：清空 reader 权限；member 旧 Session 立即失效。
	revoke := owner.roundTrip(t, http.MethodPut, "/api/v1/iam/roles/"+roleID+"/permissions", `{"expectedRoleVersion":2,"permissionKeys":[]}`)
	if revoke.code != http.StatusOK {
		t.Fatalf("revoke permissions status = %d, body = %s", revoke.code, revoke.body)
	}
	if stale := member.roundTrip(t, http.MethodGet, "/api/v1/iam/roles", ""); stale.code != http.StatusUnauthorized {
		t.Fatalf("stale member session status = %d, want 401", stale.code)
	}
	// 重新登录后 deny：reader 权限已被清空。
	third := doJSON(t, address, http.MethodPost, "/api/v1/iam/login", `{"username":"member","password":"ponmlkjihgfedcb"}`, "", "")
	if third.code != http.StatusOK {
		t.Fatalf("third login status = %d, body = %s", third.code, third.body)
	}
	member = iamClient{address: address, cookie: third.cookie, csrf: third.csrf}
	if denied := member.roundTrip(t, http.MethodGet, "/api/v1/iam/roles", ""); denied.code != http.StatusForbidden {
		t.Fatalf("member roles list after revoke = %d, want 403", denied.code)
	}
}

type iamResponse struct {
	code   int
	body   string
	cookie string
	csrf   string
}

type iamClient struct {
	address string
	cookie  string
	csrf    string
}

func (c iamClient) roundTrip(t *testing.T, method, path, body string) iamResponse {
	t.Helper()
	return doJSON(t, c.address, method, path, body, c.cookie, c.csrf)
}

// doJSON 执行带 Cookie/Origin/CSRF 的 JSON 请求，并捕获 Set-Cookie 与 csrfToken。
func doJSON(t *testing.T, address, method, path, body, cookie, csrf string) iamResponse {
	t.Helper()
	request, err := http.NewRequest(method, "http://"+address+path, bytes.NewBufferString(body))
	if err != nil {
		t.Fatalf("NewRequest() error = %v", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "http://"+address)
	if cookie != "" {
		request.Header.Set("Cookie", cookie)
	}
	if csrf != "" {
		request.Header.Set("X-CSRF-Token", csrf)
	}
	response, err := (&http.Client{Transport: &http.Transport{DisableKeepAlives: true}}).Do(request)
	if err != nil {
		t.Fatalf("HTTP %s %s error = %v", method, path, err)
	}
	defer response.Body.Close()
	payload, readErr := io.ReadAll(response.Body)
	if readErr != nil {
		t.Fatalf("read response body: %v", readErr)
	}
	result := iamResponse{code: response.StatusCode, body: string(payload), csrf: jsonField(string(payload), "csrfToken")}
	for _, value := range response.Header.Values("Set-Cookie") {
		parsed, err := http.ParseSetCookie(value)
		if err == nil && parsed.Name == service.SessionCookieName {
			result.cookie = parsed.Name + "=" + parsed.Value
		}
	}
	return result
}

func jsonField(payload, key string) string {
	var object map[string]any
	if err := json.Unmarshal([]byte(payload), &object); err != nil {
		return ""
	}
	value, ok := object[key].(string)
	if !ok {
		return ""
	}
	return value
}

func jsonFieldNumber(payload, key string) float64 {
	var object map[string]any
	if err := json.Unmarshal([]byte(payload), &object); err != nil {
		return 0
	}
	value, ok := object[key].(float64)
	if !ok {
		return 0
	}
	return value
}

func itoa(value uint64) string {
	return strconv.FormatUint(value, 10)
}
