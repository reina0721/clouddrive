package httpbinding

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	passwordadapter "github.com/reina0721/clouddrive/internal/module/iam/adapter/password"
	"github.com/reina0721/clouddrive/internal/module/iam/authorization"
	migrationbinding "github.com/reina0721/clouddrive/internal/module/iam/binding/migration"
	iampermission "github.com/reina0721/clouddrive/internal/module/iam/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	"github.com/reina0721/clouddrive/internal/module/iam/service"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	"github.com/reina0721/clouddrive/pkg/clock"
	"github.com/reina0721/clouddrive/pkg/database"
	dbmigrate "github.com/reina0721/clouddrive/pkg/database/migrate"
	"github.com/reina0721/clouddrive/pkg/idgen"
)

func TestHumaLoginSliceUsesTypedBodyAndSessionResponse(t *testing.T) {
	iam, resource := testService(t)
	defer resource.Close()
	handler, err := NewHandler(iam, nil)
	if err != nil {
		t.Fatal(err)
	}
	router := humaRouter(handler)
	setupBody := []byte(`{"setupToken":"setup-secret","username":"owner","displayName":"Owner","password":"123456789012345"}`)
	if response := serve(router, http.MethodPost, "http://example.test/api/v1/iam/setup", setupBody, nil); response.Code != http.StatusCreated {
		t.Fatalf("setup status = %d body=%s", response.Code, response.Body.String())
	}

	request := httptest.NewRequest(http.MethodPost, "http://example.test/api/v1/iam/login", bytes.NewBufferString(`{"username":"owner","password":"123456789012345"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "http://example.test")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || response.Result().Cookies()[0].Name != service.SessionCookieName || !bytes.Contains(response.Body.Bytes(), []byte(`"csrfToken"`)) {
		t.Fatalf("login response = %d headers=%#v body=%s", response.Code, response.Header(), response.Body.String())
	}
}

func TestSessionBoundaryPaginationAndStableConflicts(t *testing.T) {
	iam, resource := testService(t)
	defer resource.Close()
	handler, err := NewHandler(iam, nil)
	if err != nil {
		t.Fatal(err)
	}
	router := humaRouter(handler)
	setupBody := []byte(`{"setupToken":"setup-secret","username":"owner","displayName":"Owner","password":"123456789012345"}`)
	setupResponse := serve(router, http.MethodPost, "http://example.test/api/v1/iam/setup", setupBody, nil)
	if setupResponse.Code != http.StatusCreated {
		t.Fatalf("setup status = %d, body = %s", setupResponse.Code, setupResponse.Body.String())
	}
	var session sessionResponse
	if err := json.Unmarshal(setupResponse.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	cookie := setupResponse.Result().Cookies()[0]

	duplicate := serve(router, http.MethodPost, "http://example.test/api/v1/iam/setup", setupBody, nil)
	if duplicate.Code != http.StatusConflict {
		t.Fatalf("duplicate setup status = %d", duplicate.Code)
	}
	unauthenticated := serve(router, http.MethodGet, "http://example.test/api/v1/iam/session", nil, nil)
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated session status = %d", unauthenticated.Code)
	}

	resolved, err := iam.Resolve(t.Context(), cookie.Value)
	if err != nil {
		t.Fatal(err)
	}
	withoutCSRF := serve(router, http.MethodPost, "http://example.test/api/v1/iam/accounts", []byte(`{"username":"member","displayName":"Member","password":"abcdefghijklmno"}`), &resolved)
	if withoutCSRF.Code != http.StatusForbidden {
		t.Fatalf("missing csrf status = %d", withoutCSRF.Code)
	}
	if withoutCSRF.Header().Get("Content-Type") != "application/problem+json" {
		t.Fatalf("missing csrf content type = %q", withoutCSRF.Header().Get("Content-Type"))
	}
	list := serve(router, http.MethodGet, "http://example.test/api/v1/iam/accounts?offset=0&limit=1", nil, &resolved)
	if list.Code != http.StatusOK || !bytes.Contains(list.Body.Bytes(), []byte(`"limit":1`)) || !bytes.Contains(list.Body.Bytes(), []byte(`"total":1`)) {
		t.Fatalf("paginated list = %d, %s", list.Code, list.Body.String())
	}
	detail := serve(router, http.MethodGet, "http://example.test/api/v1/iam/accounts/"+resolved.Identity.AccountID, nil, &resolved)
	if detail.Code != http.StatusOK || !bytes.Contains(detail.Body.Bytes(), []byte(`"activeSessionCount":1`)) || !bytes.Contains(detail.Body.Bytes(), []byte(`"authorizationRevision"`)) || !bytes.Contains(detail.Body.Bytes(), []byte(`"createdAt"`)) {
		t.Fatalf("account detail = %d, %s", detail.Code, detail.Body.String())
	}
	missing := serve(router, http.MethodGet, "http://example.test/api/v1/iam/accounts/missing-account", nil, &resolved)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing account detail status = %d, body = %s", missing.Code, missing.Body.String())
	}
	_ = session
}

func TestBatchAccountMutationRequiresAndReplaysIdempotencyKey(t *testing.T) {
	iam, resource := testService(t)
	defer resource.Close()
	handler, err := NewHandler(iam, nil)
	if err != nil {
		t.Fatal(err)
	}
	router := humaRouter(handler)
	setupResponse := serve(router, http.MethodPost, "http://example.test/api/v1/iam/setup", []byte(`{"setupToken":"setup-secret","username":"owner","displayName":"Owner","password":"123456789012345"}`), nil)
	if setupResponse.Code != http.StatusCreated {
		t.Fatalf("setup status = %d, body = %s", setupResponse.Code, setupResponse.Body.String())
	}
	var setupSession sessionResponse
	if err := json.Unmarshal(setupResponse.Body.Bytes(), &setupSession); err != nil {
		t.Fatal(err)
	}
	resolved, err := iam.Resolve(t.Context(), setupResponse.Result().Cookies()[0].Value)
	if err != nil {
		t.Fatal(err)
	}
	member, err := iam.CreateAccount(t.Context(), "batch-member", "Batch Member", "abcdefghijklmno")
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(map[string]any{"accountIds": []string{member.ID, "missing-id"}, "status": "disabled"})
	if err != nil {
		t.Fatal(err)
	}
	withMutationHeaders := func(request *http.Request) {
		request.Header.Set("X-CSRF-Token", setupSession.CSRFToken)
		request.Header.Set("Idempotency-Key", "batch-http-1")
	}

	first := serve(router, http.MethodPost, "http://example.test/api/v1/iam/accounts/batch-status", body, &resolved, withMutationHeaders)
	if first.Code != http.StatusOK || !bytes.Contains(first.Body.Bytes(), []byte(`"requestedCount":2`)) || !bytes.Contains(first.Body.Bytes(), []byte(`"processedCount":2`)) || !bytes.Contains(first.Body.Bytes(), []byte(`"succeeded":[`)) || !bytes.Contains(first.Body.Bytes(), []byte(`"failed":[`)) {
		t.Fatalf("first batch response = %d, %s", first.Code, first.Body.String())
	}
	replayed := serve(router, http.MethodPost, "http://example.test/api/v1/iam/accounts/batch-status", body, &resolved, withMutationHeaders)
	if replayed.Code != http.StatusOK || replayed.Body.String() != first.Body.String() {
		t.Fatalf("replayed batch response = %d, %s", replayed.Code, replayed.Body.String())
	}

	conflictingBody, err := json.Marshal(map[string]any{"accountIds": []string{member.ID}, "status": "active"})
	if err != nil {
		t.Fatal(err)
	}
	conflict := serve(router, http.MethodPost, "http://example.test/api/v1/iam/accounts/batch-status", conflictingBody, &resolved, withMutationHeaders)
	if conflict.Code != http.StatusConflict || !bytes.Contains(conflict.Body.Bytes(), []byte(`"idempotency_conflict"`)) {
		t.Fatalf("idempotency conflict = %d, %s", conflict.Code, conflict.Body.String())
	}
}

// TestApiTokenBatchRevokeContract 验证批量吊销令牌 HTTP 契约（090 PAGE-090-002）：
// Idempotency-Key 稳定重放、逐项成功/失败集合、缺失 CSRF 拒绝。
func TestApiTokenBatchRevokeContract(t *testing.T) {
	iam, resource := testService(t)
	defer resource.Close()
	handler, err := NewHandler(iam, nil)
	if err != nil {
		t.Fatal(err)
	}
	router := humaRouter(handler)
	setupResponse := serve(router, http.MethodPost, "http://example.test/api/v1/iam/setup", []byte(`{"setupToken":"setup-secret","username":"owner","displayName":"Owner","password":"123456789012345"}`), nil)
	if setupResponse.Code != http.StatusCreated {
		t.Fatalf("setup status = %d, body = %s", setupResponse.Code, setupResponse.Body.String())
	}
	var setupSession sessionResponse
	if err := json.Unmarshal(setupResponse.Body.Bytes(), &setupSession); err != nil {
		t.Fatal(err)
	}
	resolved, err := iam.Resolve(t.Context(), setupResponse.Result().Cookies()[0].Value)
	if err != nil {
		t.Fatal(err)
	}
	// 创建两个令牌用于批量吊销。
	createBody := []byte(`{"name":"batch-a","description":"","scopes":["iam:account:self:read"],"expiresAt":"2027-01-01T00:00:00Z"}`)
	created := serve(router, http.MethodPost, "http://example.test/api/v1/iam/api-tokens", createBody, &resolved, func(request *http.Request) { request.Header.Set("X-CSRF-Token", setupSession.CSRFToken) })
	if created.Code != http.StatusOK {
		t.Fatalf("create token status = %d, body = %s", created.Code, created.Body.String())
	}
	var issued apiTokenIssuedResponse
	if err := json.Unmarshal(created.Body.Bytes(), &issued); err != nil {
		t.Fatal(err)
	}
	secondBody := []byte(`{"name":"batch-b","description":"","scopes":["iam:account:self:read"],"expiresAt":"2027-01-01T00:00:00Z"}`)
	secondCreated := serve(router, http.MethodPost, "http://example.test/api/v1/iam/api-tokens", secondBody, &resolved, func(request *http.Request) { request.Header.Set("X-CSRF-Token", setupSession.CSRFToken) })
	var secondIssued apiTokenIssuedResponse
	if err := json.Unmarshal(secondCreated.Body.Bytes(), &secondIssued); err != nil {
		t.Fatal(err)
	}
	withBatchHeaders := func(request *http.Request) {
		request.Header.Set("X-CSRF-Token", setupSession.CSRFToken)
		request.Header.Set("Idempotency-Key", "token-batch-http-1")
	}
	revokeBody, err := json.Marshal(map[string]any{"tokenIds": []string{issued.ID, secondIssued.ID, "missing-token"}})
	if err != nil {
		t.Fatal(err)
	}
	// 缺失 CSRF 拒绝。
	noCSRF := serve(router, http.MethodPost, "http://example.test/api/v1/iam/api-tokens/batch-revoke", revokeBody, &resolved)
	if noCSRF.Code != http.StatusForbidden {
		t.Fatalf("batch revoke without csrf status = %d, body = %s", noCSRF.Code, noCSRF.Body.String())
	}
	first := serve(router, http.MethodPost, "http://example.test/api/v1/iam/api-tokens/batch-revoke", revokeBody, &resolved, withBatchHeaders)
	if first.Code != http.StatusOK || !bytes.Contains(first.Body.Bytes(), []byte(`"requestedCount":3`)) || !bytes.Contains(first.Body.Bytes(), []byte(`"processedCount":3`)) || !bytes.Contains(first.Body.Bytes(), []byte(`"succeeded":[`)) || !bytes.Contains(first.Body.Bytes(), []byte(`"failed":[`)) {
		t.Fatalf("first batch revoke response = %d, %s", first.Code, first.Body.String())
	}
	replayed := serve(router, http.MethodPost, "http://example.test/api/v1/iam/api-tokens/batch-revoke", revokeBody, &resolved, withBatchHeaders)
	if replayed.Code != http.StatusOK || replayed.Body.String() != first.Body.String() {
		t.Fatalf("replayed batch revoke = %d, %s", replayed.Code, replayed.Body.String())
	}
	// 已吊销令牌认证失败。
	if _, err := iam.ResolveApiToken(t.Context(), issued.Secret); !errors.Is(err, service.ErrSessionInvalid) {
		t.Fatalf("revoked secret resolve error = %v", err)
	}
}

func TestDynamicAssignmentContractVersion409AndSnapshot(t *testing.T) {
	iam, resource := testService(t)
	defer resource.Close()
	handler, err := NewHandler(iam, nil)
	if err != nil {
		t.Fatal(err)
	}
	router := humaRouter(handler)
	setupResponse := serve(router, http.MethodPost, "http://example.test/api/v1/iam/setup", []byte(`{"setupToken":"setup-secret","username":"owner","displayName":"Owner","password":"123456789012345"}`), nil)
	if setupResponse.Code != http.StatusCreated {
		t.Fatalf("setup status = %d, body = %s", setupResponse.Code, setupResponse.Body.String())
	}
	var setupSession sessionResponse
	if err := json.Unmarshal(setupResponse.Body.Bytes(), &setupSession); err != nil {
		t.Fatal(err)
	}
	cookie := setupResponse.Result().Cookies()[0]
	resolved, err := iam.Resolve(t.Context(), cookie.Value)
	if err != nil {
		t.Fatal(err)
	}
	withCSRF := func(request *http.Request) { request.Header.Set("X-CSRF-Token", setupSession.CSRFToken) }
	createRole := serve(router, http.MethodPost, "http://example.test/api/v1/iam/roles", []byte(`{"code":"reader","name":"Reader","description":""}`), &resolved, withCSRF)
	if createRole.Code != http.StatusCreated {
		t.Fatalf("create role status = %d, body = %s", createRole.Code, createRole.Body.String())
	}
	var role roleResponse
	if err := json.Unmarshal(createRole.Body.Bytes(), &role); err != nil {
		t.Fatal(err)
	}
	if role.ID == "" {
		t.Fatalf("create role body = %s", createRole.Body.String())
	}
	if _, err := iam.RolePermissionsSnapshot(t.Context(), role.ID); err != nil {
		t.Fatalf("role exists check = %v", err)
	}
	// 过期 expected version → 409。
	stale := serve(router, http.MethodPut, "http://example.test/api/v1/iam/roles/"+role.ID+"/permissions", []byte(`{"expectedRoleVersion":99,"permissionKeys":["iam:account:self:read"]}`), &resolved, withCSRF)
	if stale.Code != http.StatusConflict {
		t.Fatalf("stale version status = %d, body = %s", stale.Code, stale.Body.String())
	}
	// 正确版本写入返回 diff 与 revision。
	saved := serve(router, http.MethodPut, "http://example.test/api/v1/iam/roles/"+role.ID+"/permissions", []byte(`{"expectedRoleVersion":1,"permissionKeys":["iam:account:self:read","iam:role:read"]}`), &resolved, withCSRF)
	if saved.Code != http.StatusOK {
		t.Fatalf("replace permissions status = %d, body = %s", saved.Code, saved.Body.String())
	}
	if !bytes.Contains(saved.Body.Bytes(), []byte(`"added":2`)) || !bytes.Contains(saved.Body.Bytes(), []byte(`"entityVersion":2`)) || !bytes.Contains(saved.Body.Bytes(), []byte(`"authorizationRevision"`)) {
		t.Fatalf("replace permissions body = %s", saved.Body.String())
	}
	// 快照读取返回版本、revision 与完整集合。
	view := serve(router, http.MethodGet, "http://example.test/api/v1/iam/roles/"+role.ID+"/permissions", nil, &resolved)
	if view.Code != http.StatusOK || !bytes.Contains(view.Body.Bytes(), []byte(`"roleVersion":2`)) || !bytes.Contains(view.Body.Bytes(), []byte(`"iam:account:self:read"`)) {
		t.Fatalf("permissions snapshot = %d, %s", view.Code, view.Body.String())
	}
	detail := serve(router, http.MethodGet, "http://example.test/api/v1/iam/roles/"+role.ID, nil, &resolved)
	if detail.Code != http.StatusOK || !bytes.Contains(detail.Body.Bytes(), []byte(`"assignedAccountCount":0`)) || !bytes.Contains(detail.Body.Bytes(), []byte(`"elevatedPermissionCount":1`)) || !bytes.Contains(detail.Body.Bytes(), []byte(`"risk":"elevated"`)) {
		t.Fatalf("role detail = %d, %s", detail.Code, detail.Body.String())
	}
	missing := serve(router, http.MethodGet, "http://example.test/api/v1/iam/roles/missing-role", nil, &resolved)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("missing role detail status = %d, body = %s", missing.Code, missing.Body.String())
	}
}

// TestSelfPreferencesContract 验证跨设备用户偏好 HTTP 契约（BE-090-005）：
// 未设置返回默认；PATCH 合并更新并持久化；非法值 400；缺失权限 403。
func TestSelfPreferencesContract(t *testing.T) {
	iam, resource := testService(t)
	defer resource.Close()
	handler, err := NewHandler(iam, nil)
	if err != nil {
		t.Fatal(err)
	}
	router := humaRouter(handler)
	setupResponse := serve(router, http.MethodPost, "http://example.test/api/v1/iam/setup", []byte(`{"setupToken":"setup-secret","username":"owner","displayName":"Owner","password":"123456789012345"}`), nil)
	if setupResponse.Code != http.StatusCreated {
		t.Fatalf("setup status = %d, body = %s", setupResponse.Code, setupResponse.Body.String())
	}
	var setupSession sessionResponse
	if err := json.Unmarshal(setupResponse.Body.Bytes(), &setupSession); err != nil {
		t.Fatal(err)
	}
	resolved, err := iam.Resolve(t.Context(), setupResponse.Result().Cookies()[0].Value)
	if err != nil {
		t.Fatal(err)
	}
	withCSRF := func(request *http.Request) { request.Header.Set("X-CSRF-Token", setupSession.CSRFToken) }

	// 未设置 → 返回默认值（language en-US, themeMode system, density comfortable）。
	initial := serve(router, http.MethodGet, "http://example.test/api/v1/iam/self/preferences", nil, &resolved)
	if initial.Code != http.StatusOK || !bytes.Contains(initial.Body.Bytes(), []byte(`"themeMode":"system"`)) || !bytes.Contains(initial.Body.Bytes(), []byte(`"density":"comfortable"`)) || !bytes.Contains(initial.Body.Bytes(), []byte(`"language":"en-US"`)) {
		t.Fatalf("initial preferences = %d, %s", initial.Code, initial.Body.String())
	}

	// PATCH 更新主题/密度/语言（CSRF 必须）。
	patchBody := []byte(`{"language":"zh-CN","themeMode":"dark","themePreset":"green","density":"compact"}`)
	noCSRF := serve(router, http.MethodPatch, "http://example.test/api/v1/iam/self/preferences", patchBody, &resolved)
	if noCSRF.Code != http.StatusForbidden {
		t.Fatalf("patch without csrf status = %d, body = %s", noCSRF.Code, noCSRF.Body.String())
	}
	updated := serve(router, http.MethodPatch, "http://example.test/api/v1/iam/self/preferences", patchBody, &resolved, withCSRF)
	if updated.Code != http.StatusOK || !bytes.Contains(updated.Body.Bytes(), []byte(`"themeMode":"dark"`)) || !bytes.Contains(updated.Body.Bytes(), []byte(`"density":"compact"`)) || !bytes.Contains(updated.Body.Bytes(), []byte(`"language":"zh-CN"`)) {
		t.Fatalf("updated preferences = %d, %s", updated.Code, updated.Body.String())
	}
	// 通知布尔可显式关闭。
	notifBody := []byte(`{"notifications":{"emailDigest":false,"inApp":true,"showSummaries":false,"dailySummary":true}}`)
	notif := serve(router, http.MethodPatch, "http://example.test/api/v1/iam/self/preferences", notifBody, &resolved, withCSRF)
	if notif.Code != http.StatusOK || !bytes.Contains(notif.Body.Bytes(), []byte(`"emailDigest":false`)) || !bytes.Contains(notif.Body.Bytes(), []byte(`"inApp":true`)) {
		t.Fatalf("notification preferences = %d, %s", notif.Code, notif.Body.String())
	}
	// 非法枚举 → 422（Huma schema enum 校验在到达 service 前拦截）。
	invalid := serve(router, http.MethodPatch, "http://example.test/api/v1/iam/self/preferences", []byte(`{"themeMode":"neon"}`), &resolved, withCSRF)
	if invalid.Code != http.StatusUnprocessableEntity || !bytes.Contains(invalid.Body.Bytes(), []byte(`body.themeMode`)) {
		t.Fatalf("invalid theme status = %d, body = %s", invalid.Code, invalid.Body.String())
	}
}

// TestListQueryContractRejectsInvalidSortAndPage 验证 BE-090-001：非法排序与
// 过大分页在 HTTP 边界返回稳定 400 invalid_request（不静默忽略、不 500）。
func TestListQueryContractRejectsInvalidSortAndPage(t *testing.T) {
	iam, resource := testService(t)
	defer resource.Close()
	handler, err := NewHandler(iam, nil)
	if err != nil {
		t.Fatal(err)
	}
	router := humaRouter(handler)
	setupResponse := serve(router, http.MethodPost, "http://example.test/api/v1/iam/setup", []byte(`{"setupToken":"setup-secret","username":"owner","displayName":"Owner","password":"123456789012345"}`), nil)
	if setupResponse.Code != http.StatusCreated {
		t.Fatalf("setup status = %d, body = %s", setupResponse.Code, setupResponse.Body.String())
	}
	resolved, err := iam.Resolve(t.Context(), setupResponse.Result().Cookies()[0].Value)
	if err != nil {
		t.Fatal(err)
	}
	// 账号列表非法排序列 → 400 invalid_request。
	badSort := serve(router, http.MethodGet, "http://example.test/api/v1/iam/accounts?sort=password:asc", nil, &resolved)
	if badSort.Code != http.StatusBadRequest || !bytes.Contains(badSort.Body.Bytes(), []byte(`"invalid_request"`)) {
		t.Fatalf("bad sort status = %d, body = %s", badSort.Code, badSort.Body.String())
	}
	// 过大分页 → 422（Huma maximum:100 schema 校验在到达 service 前拦截）。
	bigPage := serve(router, http.MethodGet, "http://example.test/api/v1/iam/accounts?limit=1001", nil, &resolved)
	if bigPage.Code != http.StatusUnprocessableEntity || !bytes.Contains(bigPage.Body.Bytes(), []byte(`query.limit`)) {
		t.Fatalf("big page status = %d, body = %s", bigPage.Code, bigPage.Body.String())
	}
	// 合法排序仍可用。
	ok := serve(router, http.MethodGet, "http://example.test/api/v1/iam/accounts?sort=username:desc", nil, &resolved)
	if ok.Code != http.StatusOK {
		t.Fatalf("valid sort status = %d, body = %s", ok.Code, ok.Body.String())
	}
}

func humaRouter(handler *Handler) http.Handler {
	router := chi.NewRouter()
	config := huma.DefaultConfig("test", "1")
	config.OpenAPIPath, config.DocsPath, config.SchemasPath = "", "", ""
	RegisterHuma(humachi.New(router, config), handler)
	return router
}

func serve(handler http.Handler, method, target string, body []byte, resolved *service.Session, decorate ...func(*http.Request)) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, target, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", "http://example.test")
	if resolved != nil {
		request = service.WithResolvedSession(request, resolved.ID, *resolved)
	}
	for _, apply := range decorate {
		apply(request)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func testService(t *testing.T) (*service.Service, database.Resource) {
	t.Helper()
	config := database.DefaultConfig()
	config.Driver = database.DriverSQLite
	config.DSN = filepath.Join(t.TempDir(), "iam-http.db")
	runner, err := dbmigrate.New(t.Context(), dbmigrate.Config{Database: config, LockTimeout: 5 * time.Second}, migrationbinding.Set())
	if err != nil {
		t.Fatal(err)
	}
	if err := runner.Up(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err := runner.Close(); err != nil {
		t.Fatal(err)
	}
	resource, err := database.NewGORM(t.Context(), &config)
	if err != nil {
		t.Fatal(err)
	}
	store, err := repo.New(testAccess{resource})
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := permissioncatalog.BuildCatalog(iampermission.Definitions()...)
	if err != nil {
		t.Fatal(err)
	}
	runtime, err := authorization.New(store, catalog)
	if err != nil {
		t.Fatal(err)
	}
	iam, err := service.New(store, clock.Fixed(time.Date(2026, 8, 22, 1, 0, 0, 0, time.UTC)), idgen.UUID(), passwordadapter.Hasher{}, service.Config{SetupToken: "setup-secret", IdleTimeout: 30 * time.Minute, AbsoluteTimeout: 12 * time.Hour, MaxFailedAttempts: 3, LockDuration: 15 * time.Minute, PasswordPolicy: model.DefaultPasswordPolicy()}, catalog, runtime)
	if err != nil {
		t.Fatal(err)
	}
	return iam, resource
}

type testAccess struct{ resource database.Resource }

func (access testAccess) Use(ctx context.Context, use func(database.Client) error) error {
	return database.Borrow(ctx, access.resource.Client(), use)
}
func (access testAccess) WithinTx(ctx context.Context, use func(context.Context, database.Client, database.Tx) error) error {
	return access.Use(ctx, func(client database.Client) error {
		return client.WithinTx(ctx, func(txContext context.Context, tx database.Tx) error { return use(txContext, client, tx) })
	})
}
