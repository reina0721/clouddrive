// Package httpbinding 发布 console-web 的协议投影，身份与授权始终由 IAM 提供。
package httpbinding

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	permission "github.com/reina0721/clouddrive/internal/permission"
	"github.com/reina0721/clouddrive/pkg/database"
	"github.com/reina0721/clouddrive/pkg/execution"
	"github.com/reina0721/clouddrive/pkg/httpx"
	"github.com/reina0721/clouddrive/pkg/logger"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const Prefix = "/api/console/v1"
const NativePrefix = Prefix + "/native/"
const NativeTargetPrefix = "/api/v1/"
const csrfCookie = "__Host-clouddrive_console_csrf"
const nativeCSRFCookie = "__Host-clouddrive_native_csrf"

type Handler struct {
	runtime             func() RuntimeMetadata
	iam                 IdentityAccess
	cookieName          string
	native              http.Handler
	origins             map[string]bool
	mux                 *http.ServeMux
	store               Persistence
	logger              logger.Logger
	relay               RelayPolicy
	executor            execution.OperationExecutor
	authenticateRequest func(*http.Request) (*http.Request, error)
	todos               TodoOperations
	navigation          NavigationOperations
}

type Dependencies struct {
	Runtime      func() RuntimeMetadata
	IAM          IdentityAccess
	CookieName   string
	Native       http.Handler
	Origins      []string
	Data         Persistence
	Logger       logger.Logger
	Relay        RelayPolicy
	Executor     execution.OperationExecutor
	Authenticate func(*http.Request) (*http.Request, error)
	Todos        TodoOperations
	Navigation   NavigationOperations
}

// New 显式注入当前 Generation 的 IAM 服务及原生 API，不拥有共享资源关闭权。
func New(dependencies Dependencies) (*Handler, error) {
	iam, native, origins, logging, relay, executor := dependencies.IAM, dependencies.Native, dependencies.Origins, dependencies.Logger, dependencies.Relay, dependencies.Executor
	if iam == nil || native == nil || dependencies.Data == nil || dependencies.Runtime == nil || dependencies.Authenticate == nil || dependencies.Todos == nil || dependencies.Navigation == nil || logging == nil || executor == nil {
		return nil, errors.New("console dependencies are incomplete")
	}
	h := &Handler{iam: iam, native: native, origins: map[string]bool{}, mux: http.NewServeMux()}
	h.store = dependencies.Data
	h.runtime = dependencies.Runtime
	h.cookieName = dependencies.CookieName
	h.logger = logging
	h.relay = relay
	h.executor = executor
	h.authenticateRequest = dependencies.Authenticate
	h.todos = dependencies.Todos
	h.navigation = dependencies.Navigation
	for _, origin := range origins {
		h.origins[origin] = true
	}
	h.routes()
	h.dataRoutes()
	h.workbenchRoutes()
	h.dashboardRoutes()
	return h, nil
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	path := strings.TrimPrefix(r.URL.Path, Prefix)
	if r.Method != "GET" && r.Method != "HEAD" {
		origin := r.Header.Get("Origin")
		if origin == "" || (!httpx.SameOrigin(r, origin) && !h.origins[origin]) {
			failure(w, http.StatusForbidden, "forbidden", "")
			return
		}
		cookie, err := r.Cookie(csrfCookie)
		if err != nil || cookie.Value == "" || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(r.Header.Get("X-CSRF-Token"))) != 1 {
			failure(w, 403, "forbidden", "")
			return
		}
	}
	if path != "/auth/csrf" && path != "/auth/login" && path != "/auth/register" && path != "/auth/setup" && path != "/auth/registration-policy" {
		authenticated, err := h.authenticateRequest(r)
		if err != nil {
			failure(w, 401, "unauthenticated", "")
			return
		}
		r = authenticated
		session := current(r)
		if session.Identity.MustChangePassword && path != "/auth/password" && path != "/auth/session" && path != "/auth/logout" {
			failure(w, 403, "forbidden", "")
			return
		}
	}
	tracked := &responseStatus{ResponseWriter: w, status: 200}
	h.mux.ServeHTTP(tracked, r)
	if r.Method != "GET" && r.Method != "HEAD" {
		h.record(r, tracked.status)
	}
}

func reply(w http.ResponseWriter, value any) {
	if err := json.NewEncoder(w).Encode(value); err != nil {
		return
	}
}
func failure(w http.ResponseWriter, status int, code, reason string) {
	w.WriteHeader(status)
	body := map[string]string{"code": code}
	if reason != "" {
		body["reason"] = reason
	}
	reply(w, map[string]any{"error": body})
}
func problem(w http.ResponseWriter, err error) {
	var status *httpx.StatusError
	if errors.As(err, &status) && status.StatusCode >= 400 && status.StatusCode < 500 {
		code := "validation"
		switch status.StatusCode {
		case 401:
			code = "unauthenticated"
		case 403:
			code = "forbidden"
		case 404:
			code = "not-found"
		case 409:
			code = "conflict"
		}
		failure(w, status.StatusCode, code, "")
		return
	}
	switch {
	case err == nil:
		return
	case errors.Is(err, ErrInvalidCredentials), errors.Is(err, ErrSessionInvalid), errors.Is(err, ErrMFAInvalidCode), errors.Is(err, ErrMFAChallengeInvalid):
		failure(w, 401, "unauthenticated", "")
	case errors.Is(err, ErrAccountLocked):
		failure(w, 429, "forbidden", "")
	case errors.Is(err, ErrSetupClosed), errors.Is(err, ErrPasswordReused):
		failure(w, 409, "conflict", "")
	case errors.Is(err, ErrRegistrationClosed), errors.Is(err, ErrAccountDisabled):
		failure(w, 403, "forbidden", "")
	case errors.Is(err, ErrVersionConflict), errors.Is(err, database.ErrOptimisticConflict):
		failure(w, 409, "conflict", "stale-version")
	case errors.Is(err, ErrOwnerInvariant):
		failure(w, 409, "conflict", "last-administrator")
	case errors.Is(err, ErrImmutableOwner):
		failure(w, 409, "conflict", "protected-role")
	case errors.Is(err, database.ErrDuplicateKey):
		failure(w, 409, "conflict", "duplicate-email")
	case errors.Is(err, database.ErrNotFound):
		failure(w, 404, "not-found", "")
	case errors.Is(err, ErrInvalidUsername), errors.Is(err, ErrInvalidName), errors.Is(err, ErrInvalidPassword), errors.Is(err, ErrInvalidID), errors.Is(err, ErrUnknownPermission), errors.Is(err, ErrInvalidQuery):
		failure(w, 422, "validation", "")
	default:
		failure(w, 500, "unavailable", "")
	}
}
func decode(w http.ResponseWriter, r *http.Request, value any) bool {
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2<<20))
	d.DisallowUnknownFields()
	if err := d.Decode(value); err != nil {
		failure(w, 422, "validation", "")
		return false
	}
	if err := d.Decode(new(any)); err != io.EOF {
		failure(w, 422, "validation", "")
		return false
	}
	return true
}
func current(r *http.Request) Session {
	_, s, _ := SessionFromContext(r.Context())
	return s
}
func allowed(r *http.Request, key string) bool {
	for _, p := range current(r).Identity.Permissions {
		if string(p) == key {
			return true
		}
	}
	return false
}
func require(w http.ResponseWriter, r *http.Request, key string) bool {
	if !allowed(r, key) {
		failure(w, 403, "forbidden", "")
		return false
	}
	return true
}

var permissions = map[string]permission.Key{
	"users.read": "iam:account:read", "users.create": "iam:account:write", "users.update": "iam:account:write", "users.status": "iam:account:write", "users.roles": "iam:account:write",
	"account.update": "iam:account:self:profile:write", "roles.read": "iam:role:read", "roles.create": "iam:role:write", "roles.update": "iam:role:write", "audit.read": "auth:audit:read", "settings.read": "console:settings:read", "settings.update": "console:settings:write",
}

func projectedPermissions(keys []permission.Key) []string {
	result := []string{}
	for name, key := range permissions {
		for _, v := range keys {
			if v == key {
				result = append(result, name)
				break
			}
		}
	}
	return result
}
func nativePermissions(names []string) ([]permission.Key, error) {
	result := []permission.Key{}
	seen := map[permission.Key]bool{}
	for _, name := range names {
		key, ok := permissions[name]
		if !ok {
			return nil, ErrUnknownPermission
		}
		if !seen[key] {
			result = append(result, key)
			seen[key] = true
		}
	}
	return result, nil
}

func (h *Handler) routes() {
	h.mux.HandleFunc("GET "+Prefix+"/navigation", func(w http.ResponseWriter, r *http.Request) {
		value, err := h.navigation.ListMenus(r.Context())
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, value)
	})
	h.mux.HandleFunc("GET "+Prefix+"/auth/csrf", func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(csrfCookie)
		token := ""
		if err == nil {
			token = cookie.Value
		}
		if len(token) != 64 {
			bytes := make([]byte, 32)
			if _, err = rand.Read(bytes); err != nil {
				problem(w, err)
				return
			}
			token = hex.EncodeToString(bytes)
			http.SetCookie(w, &http.Cookie{Name: csrfCookie, Value: token, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode})
		}
		reply(w, map[string]string{"token": token})
	})
	h.mux.HandleFunc("GET "+Prefix+"/auth/registration-policy", func(w http.ResponseWriter, r *http.Request) {
		s, err := h.iam.Registration(r.Context())
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, map[string]bool{"enabled": s.Enabled})
	})
	h.mux.HandleFunc("POST "+Prefix+"/auth/{action}", h.authenticate)
	h.mux.HandleFunc("GET "+Prefix+"/auth/session", func(w http.ResponseWriter, r *http.Request) { h.session(w, current(r)) })
	h.mux.HandleFunc("GET "+Prefix+"/system/runtime", h.runtimeMetadata)
	h.mux.HandleFunc("GET "+Prefix+"/auth/access", func(w http.ResponseWriter, r *http.Request) {
		u, err := h.user(r, current(r).Identity.AccountID)
		if err != nil {
			problem(w, err)
			return
		}
		reply(w, map[string]any{"user": u, "permissions": projectedPermissions(current(r).Identity.Permissions), "nativePermissions": current(r).Identity.Permissions})
	})
	h.mux.HandleFunc("POST "+Prefix+"/auth/sessions/revoke-others", h.revokeSession)
	h.mux.HandleFunc("GET "+Prefix+"/auth/sessions", h.sessions)
	h.mux.HandleFunc("DELETE "+Prefix+"/auth/sessions/{id}", h.revokeSession)
	h.mux.HandleFunc(NativePrefix, h.forwardNative)
	h.mux.HandleFunc("GET "+Prefix+"/users", h.listUsers)
	h.mux.HandleFunc("POST "+Prefix+"/users", h.createUser)
	h.mux.HandleFunc("GET "+Prefix+"/users/{id}", h.readUser)
	h.mux.HandleFunc("PATCH "+Prefix+"/users/{id}", h.updateUser)
	h.mux.HandleFunc("PATCH "+Prefix+"/users/{id}/{action}", h.mutateUser)
	h.mux.HandleFunc("POST "+Prefix+"/users/batch-status", h.batchStatus)
	h.mux.HandleFunc("GET "+Prefix+"/me", h.readUser)
	h.mux.HandleFunc("PATCH "+Prefix+"/me", h.updateUser)
	h.mux.HandleFunc("GET "+Prefix+"/roles", h.listRoles)
	h.mux.HandleFunc("GET "+Prefix+"/roles/{id}", h.readRole)
	h.mux.HandleFunc("POST "+Prefix+"/roles", h.writeRole)
	h.mux.HandleFunc("PATCH "+Prefix+"/roles/{id}", h.writeRole)
	h.mux.HandleFunc("GET "+Prefix+"/roles/{id}/members", h.roleMembers)
	h.mux.HandleFunc("POST "+Prefix+"/roles/{id}/members", h.roleMember)
	h.mux.HandleFunc("DELETE "+Prefix+"/roles/{id}/members/{userId}", h.roleMember)
	h.mux.HandleFunc("GET "+Prefix+"/system/registration", h.registration)
	h.mux.HandleFunc("PATCH "+Prefix+"/system/registration", h.registration)
}

func (h *Handler) session(w http.ResponseWriter, s Session) {
	expires := s.IdleExpiresAt
	if s.AbsoluteExpiresAt.Before(expires) {
		expires = s.AbsoluteExpiresAt
	}
	sum := sha256.Sum256([]byte(s.ID))
	reply(w, map[string]any{"user": map[string]string{"id": s.Identity.AccountID, "name": s.Identity.DisplayName, "email": s.Identity.Username}, "expiresAt": expires.UnixMilli(), "sessionId": hex.EncodeToString(sum[:]), "mustChangePassword": s.Identity.MustChangePassword})
}

func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request) {
	action := r.PathValue("action")
	if action == "logout" {
		id, _, _ := SessionFromContext(r.Context())
		if err := h.iam.Logout(r.Context(), id); err != nil {
			problem(w, err)
			return
		}
		http.SetCookie(w, &http.Cookie{Name: h.cookieName, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
		http.SetCookie(w, &http.Cookie{Name: nativeCSRFCookie, Path: "/", Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1})
		w.WriteHeader(204)
		return
	}
	if action == "password" {
		var body struct {
			CurrentPassword string `json:"currentPassword"`
			NewPassword     string `json:"newPassword"`
		}
		if !decode(w, r, &body) {
			return
		}
		if !require(w, r, "iam:account:self:password:write") {
			return
		}
		if err := h.iam.ChangePassword(r.Context(), current(r).Identity.AccountID, body.CurrentPassword, body.NewPassword); err != nil {
			problem(w, err)
			return
		}
		w.WriteHeader(204)
		return
	}
	if action == "sessions/revoke-others" {
		h.revokeSession(w, r)
		return
	}
	var body struct {
		Name        string `json:"name"`
		Email       string `json:"email"`
		Password    string `json:"password"`
		SetupToken  string `json:"setupToken"`
		ChallengeID string `json:"challengeId"`
		Code        string `json:"code"`
	}
	if !decode(w, r, &body) {
		return
	}
	var session Session
	var err error
	switch action {
	case "setup":
		session, err = h.iam.Setup(r.Context(), body.SetupToken, body.Email, body.Name, body.Password)
	case "login":
		if body.ChallengeID != "" {
			session, err = h.iam.VerifyMFAChallenge(r.Context(), body.ChallengeID, body.Code)
		} else {
			session, err = h.iam.Login(r.Context(), body.Email, body.Password)
		}
	case "register":
		_, err = h.iam.CreateConsoleAccount(r.Context(), body.Email, body.Name, body.Password, nil, AccountActive, true)
		if err == nil {
			session, err = h.iam.Login(r.Context(), body.Email, body.Password)
		}
	default:
		failure(w, 404, "not-found", "")
		return
	}
	var challenge *MFARequiredError
	if errors.As(err, &challenge) {
		reply(w, map[string]any{"mfaRequired": true, "challengeId": challenge.ChallengeID})
		return
	}
	if err != nil {
		if errors.Is(err, database.ErrOperationFailed) {
			h.logger.Error("console authentication failed", logger.String("owner", "console"), logger.String("phase", "authenticate"), logger.Error(err))
		}
		problem(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: h.cookieName, Value: session.ID, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode})
	http.SetCookie(w, &http.Cookie{Name: nativeCSRFCookie, Value: session.CSRFToken, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteStrictMode})
	h.session(w, session)
}

func (h *Handler) sessions(w http.ResponseWriter, r *http.Request) {
	list, err := h.iam.ListSessions(r.Context(), current(r).Identity.AccountID, 0, 100, SessionListActive)
	if err != nil {
		problem(w, err)
		return
	}
	id, _, _ := SessionFromContext(r.Context())
	sum := sha256.Sum256([]byte(id))
	hash := hex.EncodeToString(sum[:])
	items := []any{}
	for _, s := range list.Items {
		expires := s.IdleExpiresAt
		if s.AbsoluteExpiresAt.Before(expires) {
			expires = s.AbsoluteExpiresAt
		}
		items = append(items, map[string]any{"id": s.IDHash, "device": "Web", "createdAt": s.CreatedAt, "lastActiveAt": s.LastSeenAt, "expiresAt": expires, "current": s.IDHash == hash})
	}
	reply(w, map[string]any{"items": items})
}
func (h *Handler) revokeSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ids := []string{id}
	if id == "" {
		list, err := h.iam.ListSessions(r.Context(), current(r).Identity.AccountID, 0, 100, SessionListActive)
		if err != nil {
			problem(w, err)
			return
		}
		sessionID, _, _ := SessionFromContext(r.Context())
		sum := sha256.Sum256([]byte(sessionID))
		currentHash := hex.EncodeToString(sum[:])
		ids = []string{}
		for _, s := range list.Items {
			if s.IDHash != currentHash {
				ids = append(ids, s.IDHash)
			}
		}
	}
	if len(ids) > 0 {
		if _, err := h.iam.RevokeSessions(r.Context(), current(r).Identity.AccountID, ids); err != nil {
			problem(w, err)
			return
		}
	}
	w.WriteHeader(204)
}
func (h *Handler) forwardNative(w http.ResponseWriter, r *http.Request) {
	copy := r.Clone(r.Context())
	u := *r.URL
	copy.URL = &u
	copy.URL.Path = NativeTargetPrefix + strings.TrimPrefix(r.URL.Path, NativePrefix)
	if r.Method != "GET" && r.Method != "HEAD" {
		// 登录时镜像 IAM 会话的 CSRF token；每次转发轮换会让并发上传互相失效。
		csrf, err := r.Cookie(nativeCSRFCookie)
		if err != nil || csrf.Value == "" {
			failure(w, http.StatusUnauthorized, "unauthenticated", "")
			return
		}
		copy.Header.Set("X-CSRF-Token", csrf.Value)
	}
	h.native.ServeHTTP(w, copy)
}

func (h *Handler) registration(w http.ResponseWriter, r *http.Request) {
	key := "console:settings:read"
	if r.Method == "PATCH" {
		key = "console:settings:write"
	}
	if !require(w, r, key) {
		return
	}
	if r.Method == "PATCH" {
		var body RegistrationSettings
		if !decode(w, r, &body) {
			return
		}
		if err := h.iam.UpdateRegistration(r.Context(), body); err != nil {
			problem(w, err)
			return
		}
	}
	value, err := h.iam.Registration(r.Context())
	if err != nil {
		problem(w, err)
		return
	}
	reply(w, map[string]any{"settings": value})
}

func page(r *http.Request) (int, int, error) {
	p := 1
	size := 20
	var err error
	if v := r.URL.Query().Get("page"); v != "" {
		p, err = strconv.Atoi(v)
		if err != nil {
			return 0, 0, ErrInvalidQuery
		}
	}
	if v := r.URL.Query().Get("pageSize"); v != "" {
		size, err = strconv.Atoi(v)
		if err != nil {
			return 0, 0, ErrInvalidQuery
		}
	}
	if p < 1 || p > 100000 || (size != 10 && size != 20 && size != 50) {
		return 0, 0, ErrInvalidQuery
	}
	return p, size, nil
}
func queryFilter(q url.Values) AccountFilter {
	archived := false
	filter := AccountFilter{Query: q.Get("q"), Archived: &archived}
	if v := q.Get("status"); v != "all" {
		filter.Status = v
	}
	if v := q.Get("roleId"); v != "all" {
		filter.RoleID = v
	}
	sort := q.Get("sort")
	if sort == "name" {
		sort = "display_name"
	}
	if sort == "email" {
		sort = "username"
	}
	if sort == "createdAt" {
		sort = "created_at"
	}
	direction := q.Get("direction")
	if direction == "" {
		direction = "asc"
	}
	if sort != "" {
		filter.Sort = sort + ":" + direction
	}
	return filter
}
