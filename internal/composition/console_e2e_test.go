package composition

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type consoleTestClient struct {
	base    string
	cookies map[string]string
	csrf    string
}

func (c *consoleTestClient) request(t *testing.T, method, path string, body any, status int, headers ...map[string]string) map[string]any {
	t.Helper()
	var payload []byte
	var err error
	if body != nil {
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	request, err := http.NewRequestWithContext(t.Context(), method, c.base+"/api/console/v1"+path, bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	for _, values := range headers {
		for key, value := range values {
			request.Header.Set(key, value)
		}
	}
	request.Header.Set("Origin", c.base)
	if method != http.MethodGet && method != http.MethodHead {
		request.Header.Set("Content-Type", "application/json")
	}
	request.Header.Set("X-CSRF-Token", c.csrf)
	for name, value := range c.cookies {
		request.AddCookie(&http.Cookie{Name: name, Value: value})
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != status {
		t.Fatalf("%s %s: status %d want %d: %s", method, path, response.StatusCode, status, raw)
	}
	for _, cookie := range response.Cookies() {
		c.cookies[cookie.Name] = cookie.Value
	}
	result := map[string]any{}
	if len(raw) > 0 {
		if err = json.Unmarshal(raw, &result); err != nil {
			t.Fatal(err)
		}
	}
	if token, ok := result["token"].(string); ok {
		c.csrf = token
	}
	return result
}

func TestConsoleSQLiteDataIsolationAndRestart(t *testing.T) {
	var hits atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		_, _ = w.Write([]byte("scheduled real response"))
	}))
	defer upstream.Close()
	directory := t.TempDir()
	configPath := filepath.Join(directory, "config.yaml")
	config := strings.Replace(generationConfig(directory, 120, 1<<20, filepath.Join(directory, "console.db")), "mode: development-anonymous", "mode: session", 1)
	config = "iam:\n  local:\n    setupToken: console-setup-secret\nconsole:\n  relay:\n    allowedOrigins: [" + upstream.URL + "]\n" + strings.Replace(config, "enabled: false", "enabled: true", 1)
	writeGenerationConfig(t, configPath, config)
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
	session := owner.request(t, "POST", "/auth/setup", map[string]any{"setupToken": "console-setup-secret", "email": "owner@clouddrive.test", "name": "Owner", "password": "owner-password-long"}, 200)
	ownerID := session["user"].(map[string]any)["id"].(string)
	owner.request(t, "GET", "/auth/access", nil, 200)
	for _, path := range []string{"/native/iam/self/mfa", "/native/iam/api-tokens", "/native/organization/departments", "/native/navigation/menus", "/native/auth/audit"} {
		owner.request(t, "GET", path, nil, 200)
	}
	department := owner.request(t, "POST", "/native/organization/departments", map[string]any{"code": "engineering", "name": "Engineering", "leader": "Owner", "remark": "real data"}, 201)
	owner.request(t, "PATCH", "/native/organization/departments/"+department["id"].(string), map[string]any{"version": department["version"], "name": "Engineering team", "active": true, "archived": false}, 200)
	owner.request(t, "POST", "/todos", map[string]any{"title": "Integration todo"}, 200)
	issued := owner.request(t, "POST", "/native/iam/api-tokens", map[string]any{"name": "Integration token", "description": "", "scopes": []string{"todos:read"}}, 200)

	tokenID := issued["id"].(string)
	owner.request(t, "POST", "/native/iam/api-tokens/"+tokenID+"/disable", map[string]any{}, 204, map[string]string{"If-Match": "\"1\""})
	owner.request(t, "POST", "/native/iam/api-tokens/"+tokenID+"/enable", map[string]any{}, 409, map[string]string{"If-Match": "\"1\""})
	owner.request(t, "PATCH", "/native/iam/api-tokens/"+tokenID, map[string]any{"name": "Updated token", "description": "Versioned", "neverExpires": true}, 204, map[string]string{"If-Match": "\"2\""})
	owner.request(t, "POST", "/native/iam/api-tokens/"+tokenID+"/rotate", map[string]any{}, 200, map[string]string{"If-Match": "\"3\""})
	metadata := owner.request(t, "GET", "/system/runtime", nil, 200)
	encodedMetadata, _ := json.Marshal(metadata)
	if strings.Contains(string(encodedMetadata), "console-setup-secret") {
		t.Fatal("runtime metadata leaked a secret")
	}

	// Last administrator protection is enforced by IAM, also through the projection.
	owner.request(t, "PATCH", "/users/"+ownerID+"/status", map[string]any{"version": 1, "status": "disabled"}, 409)
	owner.request(t, "PATCH", "/native/iam/self/profile", map[string]any{"expectedVersion": 1, "nickname": "Owner nickname", "bio": "Verified profile", "birthDate": "2000-01-02"}, 200)

	role := owner.request(t, "POST", "/roles", map[string]any{"name": "Registered member", "permissions": []string{"account.update"}}, 200)["role"].(map[string]any)
	roleID := role["id"].(string)
	owner.request(t, "PUT", "/native/iam/roles/"+roleID+"/permissions", map[string]any{"expectedRoleVersion": 1, "permissionKeys": []string{"iam:account:self:read", "iam:account:self:profile:write", "iam:account:self:password:write", "iam:account:self:preferences:read", "iam:account:self:preferences:write", "iam:account:self:archive", "console:workbench:read", "todos:read"}}, 200)
	settings := owner.request(t, "GET", "/system/registration", nil, 200)["settings"].(map[string]any)
	owner.request(t, "PATCH", "/system/registration", map[string]any{"enabled": true, "defaultRoleId": roleID, "version": settings["version"]}, 200)
	member := &consoleTestClient{base: owner.base, cookies: map[string]string{}}
	member.request(t, "GET", "/auth/csrf", nil, 200)
	ownerPreferences := owner.request(t, "GET", "/native/iam/self/preferences", nil, 200)
	preferenceDraft := map[string]any{"version": ownerPreferences["version"], "language": "zh-CN", "timeZone": "Asia/Shanghai", "themeMode": "dark", "themePreset": "green", "density": "compact"}
	owner.request(t, "PATCH", "/native/iam/self/preferences", preferenceDraft, 200)
	owner.request(t, "PATCH", "/native/iam/self/preferences", preferenceDraft, 409)
	member.request(t, "POST", "/auth/register", map[string]any{"name": "Member", "email": "member@clouddrive.test", "password": "member-password-long"}, 200)
	member.request(t, "GET", "/users", nil, 403)
	member.request(t, "GET", "/roles?scope=self", nil, 200)
	member.request(t, "GET", "/system/runtime", nil, 403)
	member.request(t, "GET", "/navigation", nil, 200)
	if preferences := member.request(t, "GET", "/native/iam/self/preferences", nil, 200); preferences["timeZone"] == "Asia/Shanghai" {
		t.Fatal("cross-user account preferences leak")
	}
	me := member.request(t, "GET", "/me", nil, 200)["user"].(map[string]any)
	draft := map[string]any{"name": "Member renamed", "email": "member@clouddrive.test", "version": me["version"]}
	member.request(t, "PATCH", "/me", draft, 200)
	member.request(t, "PATCH", "/me", draft, 409)
	inbox := member.request(t, "GET", "/notifications", nil, 200)["items"].([]any)
	if len(inbox) == 0 {
		t.Fatal("identity writes did not emit a real notification")
	}
	id := inbox[0].(map[string]any)["id"].(string)
	owner.request(t, "GET", "/notifications/"+id, nil, 404)
	owner.request(t, "PATCH", "/notifications/read", map[string]any{"ids": []string{id}}, 404)
	member.request(t, "PATCH", "/notifications/read", map[string]any{"ids": []string{id}}, 204)
	dictionaries := owner.request(t, "POST", "/dictionaries", map[string]any{"name": "Test dictionary", "code": "TEST_CODES", "status": "active", "remark": "persistent"}, 200)
	dictionary := dictionaries["types"].([]any)[0].(map[string]any)
	owner.request(t, "PATCH", "/dictionaries/"+dictionary["id"].(string), map[string]any{"name": "Changed dictionary", "code": "TEST_CODES", "status": "active", "remark": "persistent", "version": 0}, 409)
	workspace := map[string]any{"version": 1, "projects": []any{map[string]string{"id": "project", "name": "Project"}}, "collections": []any{map[string]string{"id": "collection", "projectId": "project", "name": "Collection"}}, "requests": []any{map[string]any{"id": "request", "collectionId": "collection", "name": "Scheduled request", "method": "GET", "url": upstream.URL, "params": []any{}, "headers": []any{}, "auth": map[string]string{"type": "none"}, "body": map[string]string{"type": "none"}, "disguise": map[string]int{"timeoutMs": 1000}, "extractors": []any{}, "preScript": "", "postScript": ""}}, "environments": []any{}, "globals": []any{}, "tasks": []any{}, "history": []any{}}
	owner.request(t, "PUT", "/api-workbench/workspace", workspace, 204, map[string]string{"If-Match": "\"0\""})
	owner.request(t, "PUT", "/api-workbench/workspace", workspace, 409, map[string]string{"If-Match": "\"0\""})
	own := member.request(t, "GET", "/api-workbench/workspace", nil, 200)
	if len(own["requests"].([]any)) != 0 {
		t.Fatal("cross-user workspace leak")
	}
	member.request(t, "POST", "/api-workbench/execute", map[string]any{"method": "GET", "url": upstream.URL}, 403)
	owner.request(t, "POST", "/api-workbench/tasks", map[string]any{"id": "restart-task", "name": "Restart task", "targetCollectionId": "collection", "cronOrInterval": "1s", "enabled": true}, 204)
	// A service restart uses the same SQLite database, and the original cookie still restores.
	stop()
	coordinator, _ = newGenerationTestCoordinator(t, configPath)
	if err := coordinator.Start(t.Context()); err != nil {
		t.Fatal(err)
	}
	owner.base = "http://" + coordinator.Diagnostics().BoundAddress
	member.base = owner.base
	member.request(t, "GET", "/auth/session", nil, 200)
	if got := owner.request(t, "GET", "/native/iam/self/preferences", nil, 200); got["timeZone"] != "Asia/Shanghai" || got["themeMode"] != "dark" {
		t.Fatalf("account preferences did not survive restart: %v", got)
	}
	deadline := time.Now().Add(5 * time.Second)
	for hits.Load() == 0 && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}
	if hits.Load() == 0 {
		t.Fatal("persistent task did not resume after restart")
	}
	// Pause and delete use the current server version, rejecting a stale writer.
	tasks := owner.request(t, "GET", "/api-workbench/workspace", nil, 200)["tasks"].([]any)
	if len(tasks) != 1 {
		t.Fatalf("restored tasks=%v", tasks)
	}
	task := tasks[0].(map[string]any)
	task["enabled"] = false
	task["lastRun"] = nil
	owner.request(t, "POST", "/api-workbench/tasks", task, 204)
	owner.request(t, "DELETE", "/api-workbench/tasks/restart-task?version=1", nil, 409)
	paused := owner.request(t, "GET", "/api-workbench/workspace", nil, 200)["tasks"].([]any)[0].(map[string]any)
	if paused["enabled"] != false {
		t.Fatal("task pause was not persisted")
	}
	owner.request(t, "DELETE", fmt.Sprintf("/api-workbench/tasks/restart-task?version=%.0f", paused["version"]), nil, 204)
	// Verify a real MFA challenge through the console protocol, including one-time recovery codes.
	enroll := owner.request(t, "POST", "/native/iam/self/mfa", map[string]any{}, 200)
	secret, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(enroll["secret"].(string))
	if err != nil {
		t.Fatal(err)
	}
	counter := make([]byte, 8)
	binary.BigEndian.PutUint64(counter, uint64(time.Now().Unix()/30))
	mac := hmac.New(sha1.New, secret)
	_, _ = mac.Write(counter)
	digest := mac.Sum(nil)
	offset := digest[len(digest)-1] & 15
	code := fmt.Sprintf("%06d", (binary.BigEndian.Uint32(digest[offset:offset+4])&0x7fffffff)%1000000)
	codes := owner.request(t, "POST", "/native/iam/self/mfa/confirm", map[string]any{"code": code}, 200)["recoveryCodes"].([]any)
	challenge := owner.request(t, "POST", "/auth/login", map[string]any{"email": "owner@clouddrive.test", "password": "owner-password-long"}, 200)
	if challenge["mfaRequired"] != true {
		t.Fatal("MFA challenge missing")
	}
	owner.request(t, "POST", "/auth/login", map[string]any{"challengeId": challenge["challengeId"], "code": codes[0]}, 200)
	owner.request(t, "POST", "/auth/login", map[string]any{"challengeId": challenge["challengeId"], "code": codes[0]}, 401)

	restored := owner.request(t, "GET", "/dictionaries", nil, 200)["types"].([]any)
	if len(restored) != 1 {
		t.Fatalf("restored dictionaries=%v", restored)
	}
	member.request(t, "POST", "/auth/logout", map[string]bool{"logout": true}, 204)
	member.request(t, "GET", "/auth/session", nil, 401)
	memberID := me["id"].(string)
	owner.request(t, "POST", "/native/iam/accounts/"+memberID+"/password-reset", map[string]any{"password": "temporary-password-long"}, 409, map[string]string{"If-Match": "\"1\""})
	owner.request(t, "POST", "/native/iam/accounts/"+memberID+"/password-reset", map[string]any{"password": "temporary-password-long"}, 204, map[string]string{"If-Match": fmt.Sprintf("\"%.0f\"", owner.request(t, "GET", "/users/"+memberID, nil, 200)["user"].(map[string]any)["version"])})
	restricted := member.request(t, "POST", "/auth/login", map[string]any{"email": "member@clouddrive.test", "password": "temporary-password-long"}, 200)
	if restricted["mustChangePassword"] != true {
		t.Fatal("reset password did not restrict the new session")
	}
	member.request(t, "GET", "/navigation", nil, 403)
	member.request(t, "POST", "/auth/password", map[string]any{"currentPassword": "temporary-password-long", "newPassword": "replacement-password-long"}, 204)
	member.request(t, "GET", "/auth/session", nil, 401)
	member.request(t, "POST", "/auth/login", map[string]any{"email": "member@clouddrive.test", "password": "replacement-password-long"}, 200)
	other := &consoleTestClient{base: member.base, cookies: map[string]string{}}
	other.request(t, "GET", "/auth/csrf", nil, 200)
	other.request(t, "POST", "/auth/login", map[string]any{"email": "member@clouddrive.test", "password": "replacement-password-long"}, 200)
	member.request(t, "POST", "/auth/sessions/revoke-others", map[string]any{}, 204)
	other.request(t, "GET", "/auth/session", nil, 401)
	confirmation := member.request(t, "POST", "/native/iam/self/archive", map[string]any{}, 200)
	member.request(t, "POST", "/native/iam/self/archive/confirm", map[string]any{"confirmationId": confirmation["confirmationId"]}, 204)
	member.request(t, "GET", "/auth/session", nil, 401)
	member.request(t, "POST", "/auth/login", map[string]any{"email": "member@clouddrive.test", "password": "replacement-password-long"}, 403)
}
