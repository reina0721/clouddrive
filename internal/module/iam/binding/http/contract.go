// Package httpbinding 通过项目 HTTP 边界发布 IAM 能力。
package httpbinding

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	"github.com/reina0721/clouddrive/internal/module/iam/service"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

const (
	opSetup                = "iam.setup"
	opLogin                = "iam.login"
	opSession              = "iam.session.read"
	opLogout               = "iam.logout"
	opChangePassword       = "iam.self.password.change"
	opSelfProfileUpdate    = "iam.self.profile.update"
	opSelfPreferences      = "iam.self.preferences.read"
	opSelfPreferencesWrite = "iam.self.preferences.write"
	opSelfArchive          = "iam.self.archive"
	opSelfArchiveConfirm   = "iam.self.archive.confirm"
	opAccounts             = "iam.accounts.list"
	opAccountRead          = "iam.accounts.read"
	opCreateAccount        = "iam.accounts.create"
	opAccountStatus        = "iam.accounts.status"
	opAccountUpdate        = "iam.accounts.update"
	opAccountArchive       = "iam.accounts.archive"
	opAccountStatusBatch   = "iam.accounts.status.batch"
	opAccountArchiveBatch  = "iam.accounts.archive.batch"
	opResetPassword        = "iam.accounts.password.reset"
	opAccountRolesRead     = "iam.accounts.roles.read"
	opAccountRoles         = "iam.accounts.roles.replace"
	opRoles                = "iam.roles.list"
	opRoleRead             = "iam.roles.read"
	opCreateRole           = "iam.roles.create"
	opRoleUpdate           = "iam.roles.update"
	opRoleArchive          = "iam.roles.archive"
	opRolePermissionsRead  = "iam.roles.permissions.read"
	opRolePermissions      = "iam.roles.permissions.replace"
	opRoleAccountsRead     = "iam.roles.accounts.list"
	opPermissions          = "iam.permissions.list"
	opPermissionRolesRead  = "iam.permissions.roles.list"
	opSessionList          = "iam.sessions.list"
	opSessionRevoke        = "iam.sessions.revoke"
	opApiTokens            = "iam.api-tokens.list"
	opApiTokenCreate       = "iam.api-tokens.create"
	opApiTokenUpdate       = "iam.api-tokens.update"
	opApiTokenRotate       = "iam.api-tokens.rotate"
	opApiTokenDisable      = "iam.api-tokens.disable"
	opApiTokenEnable       = "iam.api-tokens.enable"
	opApiTokenRevoke       = "iam.api-tokens.revoke"
	opApiTokenRevokeBatch  = "iam.api-tokens.revoke.batch"
	opMFABegin             = "iam.self.mfa.begin"
	opMFAStatus            = "iam.self.mfa.status"
	opMFAConfirm           = "iam.self.mfa.confirm"
	opMFADisable           = "iam.self.mfa.disable"
	opMFAVerify            = "iam.login.mfa-verify"
)

type Handler struct {
	service        *service.Service
	allowedOrigins map[string]struct{}
}

func NewHandler(iam *service.Service, allowedOrigins []string) (*Handler, error) {
	if iam == nil {
		return nil, errors.New("iam HTTP service is nil")
	}
	values := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		values[origin] = struct{}{}
	}
	return &Handler{service: iam, allowedOrigins: values}, nil
}

func (h *Handler) originAllowed(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return false
	}
	if httpx.SameOrigin(r, origin) {
		return true
	}
	_, ok := h.allowedOrigins[origin]
	return ok
}

type identityResponse struct {
	AccountID          string                  `json:"accountId"`
	Username           string                  `json:"username"`
	DisplayName        string                  `json:"displayName"`
	Nickname           string                  `json:"nickname"`
	Bio                string                  `json:"bio"`
	BirthDate          string                  `json:"birthDate"`
	Permissions        []permissioncatalog.Key `json:"permissions"`
	MustChangePassword bool                    `json:"mustChangePassword"`
	SecurityRevision   uint64                  `json:"securityRevision"`
}
type sessionResponse struct {
	Identity          identityResponse `json:"identity"`
	CSRFToken         string           `json:"csrfToken,omitempty"`
	CreatedAt         time.Time        `json:"createdAt,omitempty"`
	IdleExpiresAt     time.Time        `json:"idleExpiresAt,omitempty"`
	AbsoluteExpiresAt time.Time        `json:"absoluteExpiresAt,omitempty"`
}

// preferencesResponse 是跨设备用户偏好的 HTTP 投影（BE-090-005）：返回
// 默认值合并用户覆盖后的有效值；source 保留字段供后续组织策略覆盖扩展。
type preferencesResponse struct {
	Version       uint64                           `json:"version"`
	Language      string                           `json:"language"`
	TimeZone      string                           `json:"timeZone,omitempty"`
	ThemeMode     string                           `json:"themeMode" enum:"system,light,dark"`
	ThemePreset   string                           `json:"themePreset" enum:"blue,cyan,green,violet,orange"`
	Density       string                           `json:"density" enum:"comfortable,compact"`
	ReduceMotion  bool                             `json:"reduceMotion"`
	Notifications preferencesNotificationsResponse `json:"notifications"`
}
type preferencesNotificationsResponse struct {
	EmailDigest   bool `json:"emailDigest"`
	InApp         bool `json:"inApp"`
	ShowSummaries bool `json:"showSummaries"`
	DailySummary  bool `json:"dailySummary"`
}

func preferencesFromModel(value model.UserPreferences) preferencesResponse {
	return preferencesResponse{Version: value.Version,
		Language: string(value.Language), TimeZone: string(value.TimeZone),
		ThemeMode: string(value.ThemeMode), ThemePreset: string(value.ThemePreset),
		Density: string(value.Density), ReduceMotion: value.ReduceMotion,
		Notifications: preferencesNotificationsResponse{
			EmailDigest: value.Notifications.EmailDigest, InApp: value.Notifications.InApp,
			ShowSummaries: value.Notifications.ShowSummaries, DailySummary: value.Notifications.DailySummary,
		},
	}
}

type accountResponse struct {
	ID                 string              `json:"id"`
	Username           string              `json:"username"`
	DisplayName        string              `json:"displayName"`
	Nickname           string              `json:"nickname"`
	Bio                string              `json:"bio"`
	BirthDate          string              `json:"birthDate"`
	Status             model.AccountStatus `json:"status" enum:"active,disabled"`
	Archived           bool                `json:"archived"`
	MustChangePassword bool                `json:"mustChangePassword"`
	SecurityRevision   uint64              `json:"securityRevision"`
	Version            uint64              `json:"version"`
}
type accountDetailResponse struct {
	Account               accountResponse `json:"account"`
	Roles                 []roleResponse  `json:"roles"`
	AuthorizationRevision uint64          `json:"authorizationRevision"`
	ActiveSessionCount    int64           `json:"activeSessionCount"`
	TotalSessionCount     int64           `json:"totalSessionCount"`
	ActiveAPITokenCount   int64           `json:"activeApiTokenCount"`
	CreatedAt             time.Time       `json:"createdAt"`
	UpdatedAt             time.Time       `json:"updatedAt"`
}
type profileResponse struct {
	Username  string `json:"username"`
	Nickname  string `json:"nickname"`
	Bio       string `json:"bio"`
	BirthDate string `json:"birthDate"`
	Version   uint64 `json:"version"`
}
type roleResponse struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Active      bool   `json:"active"`
	Archived    bool   `json:"archived"`
	System      bool   `json:"system"`
	Version     uint64 `json:"version"`
}
type permissionResponse struct {
	Key                  string                 `json:"key"`
	OwnerModuleID        string                 `json:"ownerModuleId"`
	DescriptionMessageID string                 `json:"descriptionMessageId"`
	Risk                 permissioncatalog.Risk `json:"risk" enum:"standard,elevated,critical"`
}
type roleDetailResponse struct {
	Role                    roleResponse         `json:"role"`
	Permissions             []permissionResponse `json:"permissions"`
	AuthorizationRevision   uint64               `json:"authorizationRevision"`
	AssignedAccountCount    int64                `json:"assignedAccountCount"`
	OwnerModuleCount        int                  `json:"ownerModuleCount"`
	ElevatedPermissionCount int                  `json:"elevatedPermissionCount"`
	CriticalPermissionCount int                  `json:"criticalPermissionCount"`
	CreatedAt               time.Time            `json:"createdAt"`
	UpdatedAt               time.Time            `json:"updatedAt"`
}
type accountRolesResponse struct {
	AccountID             string   `json:"accountId"`
	AccountVersion        uint64   `json:"accountVersion"`
	AuthorizationRevision uint64   `json:"authorizationRevision"`
	RoleIDs               []string `json:"roleIds"`
}
type rolePermissionsResponse struct {
	RoleID                string                  `json:"roleId"`
	RoleVersion           uint64                  `json:"roleVersion"`
	AuthorizationRevision uint64                  `json:"authorizationRevision"`
	PermissionKeys        []permissioncatalog.Key `json:"permissionKeys"`
}
type assignmentResponse struct {
	EntityID              string `json:"entityId"`
	EntityVersion         uint64 `json:"entityVersion"`
	AuthorizationRevision uint64 `json:"authorizationRevision"`
	Added                 int    `json:"added"`
	Removed               int    `json:"removed"`
}
type listResponse[T any] struct {
	Items  []T   `json:"items"`
	Offset int   `json:"offset"`
	Limit  int   `json:"limit"`
	Total  int64 `json:"total"`
}

// sessionInfoResponse 是会话集中管理的元数据视图；只暴露摘要 IDHash（hex）
// 与过期信息，绝不泄露明文 SessionID 或 CSRF。
type sessionInfoResponse struct {
	IDHash            string     `json:"idHash"`
	AccountID         string     `json:"accountId"`
	CreatedAt         time.Time  `json:"createdAt"`
	LastSeenAt        time.Time  `json:"lastSeenAt"`
	IdleExpiresAt     time.Time  `json:"idleExpiresAt"`
	AbsoluteExpiresAt time.Time  `json:"absoluteExpiresAt"`
	RevokedAt         *time.Time `json:"revokedAt,omitempty"`
}

// API-Token（078/080）：管理视图不携带明文；Issued 响应只在创建/轮换时含 secret。
type apiTokenResponse struct {
	Version     uint64                  `json:"version"`
	ID          string                  `json:"id"`
	Name        string                  `json:"name"`
	Description string                  `json:"description,omitempty"`
	Scopes      []permissioncatalog.Key `json:"scopes"`
	ExpiresAt   *time.Time              `json:"expiresAt,omitempty"`
	RevokedAt   *time.Time              `json:"revokedAt,omitempty"`
	DisabledAt  *time.Time              `json:"disabledAt,omitempty"`
	CreatedAt   time.Time               `json:"createdAt"`
	LastUsed    *time.Time              `json:"lastUsedAt,omitempty"`
	Status      string                  `json:"status"`
}
type apiTokenIssuedResponse struct {
	Version     uint64                  `json:"version"`
	ID          string                  `json:"id"`
	Name        string                  `json:"name"`
	Description string                  `json:"description,omitempty"`
	Scopes      []permissioncatalog.Key `json:"scopes"`
	ExpiresAt   *time.Time              `json:"expiresAt,omitempty"`
	RevokedAt   *time.Time              `json:"revokedAt,omitempty"`
	DisabledAt  *time.Time              `json:"disabledAt,omitempty"`
	CreatedAt   time.Time               `json:"createdAt"`
	LastUsed    *time.Time              `json:"lastUsedAt,omitempty"`
	Status      string                  `json:"status"`
	Secret      string                  `json:"secret"`
}
type apiTokenListInput struct {
	Offset int    `query:"offset" minimum:"0" default:"0"`
	Limit  int    `query:"limit" minimum:"1" maximum:"100" default:"20"`
	Status string `query:"status" enum:"active,disabled,expired,revoked,all"`
	Sort   string `query:"sort" maxLength:"32"`
}
type apiTokenCreateInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		Name        string                  `json:"name" minLength:"1" maxLength:"128"`
		Description string                  `json:"description" maxLength:"1024"`
		Scopes      []permissioncatalog.Key `json:"scopes"`
		ExpiresAt   *time.Time              `json:"expiresAt,omitempty"`
	}
}
type apiTokenUpdateInput struct {
	IfMatch   string `header:"If-Match"`
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		Name         string     `json:"name" minLength:"1" maxLength:"128"`
		Description  string     `json:"description" maxLength:"1024"`
		ExpiresAt    *time.Time `json:"expiresAt,omitempty"`
		NeverExpires bool       `json:"neverExpires,omitempty"`
	}
}
type apiTokenPathInput struct {
	IfMatch   string `header:"If-Match"`
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
}

// apiTokenBatchRevokeInput 是批量吊销令牌的请求：Idempotency-Key 复用既有
// 批量语义（稳定重放、冲突/进行中稳定错误码）。
type apiTokenBatchRevokeInput struct {
	Origin         string `header:"Origin" required:"true"`
	CSRFToken      string `header:"X-CSRF-Token" required:"true"`
	IdempotencyKey string `header:"Idempotency-Key" required:"true" minLength:"1" maxLength:"128"`
	Body           struct {
		TokenIDs []string `json:"tokenIds" minLength:"1" maxLength:"100"`
	}
}

// MFA/TOTP（078）：绑定预览/确认/解绑与登录第二步验证输入输出。
type mfaEnrollResponse struct {
	Secret string `json:"secret"`
	URI    string `json:"uri"`
}
type mfaStatusResponse struct {
	Registered bool `json:"registered"`
}
type mfaConfirmResponse struct {
	RecoveryCodes []string `json:"recoveryCodes"`
}
type mfaCodeInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		Code string `json:"code" minLength:"4" maxLength:"64"`
	}
}
type mfaVerifyInput struct {
	Origin string `header:"Origin" required:"true"`
	Body   struct {
		ChallengeID string `json:"challengeId" minLength:"1" maxLength:"128"`
		Code        string `json:"code" minLength:"4" maxLength:"64"`
	}
}
type emptyInput struct{}

type sessionListInput struct {
	AccountID string `query:"accountId"`
	Offset    int    `query:"offset" minimum:"0" default:"0"`
	Limit     int    `query:"limit" minimum:"1" maximum:"100" default:"20"`
	Status    string `query:"status" enum:"all,active,revoked"`
	Sort      string `query:"sort" maxLength:"32"`
}

type sessionRevokeInput struct {
	AccountID string `query:"accountId"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		IDHashes []string `json:"idHashes"`
	}
}

func accountOutput(v model.Account) accountResponse {
	return accountResponse{v.ID, v.Username, v.DisplayName, v.Nickname, v.Bio, v.BirthDate, v.Status, v.Archived, v.MustChangePassword, v.SecurityRevision, v.Version}
}
func accountDetailOutput(v service.AccountDetailView) accountDetailResponse {
	roles := make([]roleResponse, len(v.Roles))
	for index, role := range v.Roles {
		roles[index] = roleOutput(role)
	}
	return accountDetailResponse{
		Account: accountOutput(v.Account), Roles: roles,
		AuthorizationRevision: v.AuthorizationRevision,
		ActiveSessionCount:    v.ActiveSessionCount, TotalSessionCount: v.TotalSessionCount,
		ActiveAPITokenCount: v.ActiveAPITokenCount,
		CreatedAt:           v.Account.CreatedAt, UpdatedAt: v.Account.UpdatedAt,
	}
}
func roleOutput(v model.Role) roleResponse {
	return roleResponse{v.ID, v.Code, v.Name, v.Description, v.Active, v.Archived, v.System, v.Version}
}
func permissionOutput(v permissioncatalog.Definition) permissionResponse {
	return permissionResponse{Key: string(v.Key), OwnerModuleID: string(v.OwnerModuleID), DescriptionMessageID: v.DescriptionMessageID, Risk: v.Risk}
}
func roleDetailOutput(v service.RoleDetailView) roleDetailResponse {
	permissions := make([]permissionResponse, len(v.Permissions))
	for index, permission := range v.Permissions {
		permissions[index] = permissionOutput(permission)
	}
	return roleDetailResponse{
		Role: roleOutput(v.Role), Permissions: permissions,
		AuthorizationRevision: v.AuthorizationRevision, AssignedAccountCount: v.AssignedAccountCount,
		OwnerModuleCount: v.OwnerModuleCount, ElevatedPermissionCount: v.ElevatedPermissionCount,
		CriticalPermissionCount: v.CriticalPermissionCount,
		CreatedAt:               v.Role.CreatedAt, UpdatedAt: v.Role.UpdatedAt,
	}
}
func accountRolesOutput(v service.AccountRolesView) accountRolesResponse {
	return accountRolesResponse{AccountID: v.AccountID, AccountVersion: v.AccountVersion, AuthorizationRevision: v.AuthorizationRevision, RoleIDs: v.RoleIDs}
}
func rolePermissionsOutput(v service.RolePermissionsView) rolePermissionsResponse {
	return rolePermissionsResponse{RoleID: v.RoleID, RoleVersion: v.RoleVersion, AuthorizationRevision: v.AuthorizationRevision, PermissionKeys: v.PermissionKeys}
}
func assignmentOutput(id string, v service.AssignmentResult) assignmentResponse {
	return assignmentResponse{EntityID: id, EntityVersion: v.EntityVersion, AuthorizationRevision: v.AuthorizationRevision, Added: v.Added, Removed: v.Removed}
}
func apiTokenViewOutput(v service.ApiTokenView) apiTokenResponse {
	return apiTokenResponse{Version: v.Version, ID: v.ID, Name: v.Name, Description: v.Description, Scopes: v.Scopes, ExpiresAt: v.ExpiresAt, RevokedAt: v.RevokedAt, DisabledAt: v.DisabledAt, CreatedAt: v.CreatedAt, LastUsed: v.LastUsed, Status: v.Status}
}
func apiTokenIssuedOutput(v service.ApiTokenIssued) apiTokenIssuedResponse {
	return apiTokenIssuedResponse{Version: v.Version, ID: v.ID, Name: v.Name, Description: v.Description, Scopes: v.Scopes, ExpiresAt: v.ExpiresAt, RevokedAt: v.RevokedAt, DisabledAt: v.DisabledAt, CreatedAt: v.CreatedAt, LastUsed: v.LastUsed, Status: v.Status, Secret: v.Secret}
}

func serviceError(err error) error {
	var mfaRequired *service.MFARequiredError
	switch {
	case errors.As(err, &mfaRequired):
		return statusError(http.StatusConflict, "mfa_required", err)
	case errors.Is(err, model.ErrInvalidUsername), errors.Is(err, model.ErrInvalidName), errors.Is(err, model.ErrInvalidPassword), errors.Is(err, model.ErrInvalidProfile), errors.Is(err, model.ErrInvalidConfirmation), errors.Is(err, model.ErrInvalidTime), errors.Is(err, model.ErrInvalidPreferences), errors.Is(err, service.ErrInvalidQuery):
		return statusError(http.StatusBadRequest, "invalid_request", err)
	case errors.Is(err, service.ErrInvalidCredentials), errors.Is(err, service.ErrMFAInvalidCode), errors.Is(err, service.ErrMFAChallengeInvalid):
		return statusError(http.StatusUnauthorized, "invalid_credentials", err)
	case errors.Is(err, service.ErrAccountLocked):
		return statusError(http.StatusTooManyRequests, "account_locked", err)
	case errors.Is(err, service.ErrAccountDisabled):
		return statusError(http.StatusForbidden, "account_disabled", err)
	case errors.Is(err, service.ErrApiTokenScopeNotOwned):
		return statusError(http.StatusForbidden, "api_token_scope_not_owned", err)
	case errors.Is(err, service.ErrIdempotencyConflict):
		return statusError(http.StatusConflict, "idempotency_conflict", err)
	case errors.Is(err, service.ErrIdempotencyInProgress):
		return statusError(http.StatusConflict, "idempotency_in_progress", err)
	case errors.Is(err, service.ErrSetupClosed), errors.Is(err, model.ErrOwnerInvariant), errors.Is(err, service.ErrImmutableOwner), errors.Is(err, service.ErrUnknownPermission), errors.Is(err, service.ErrVersionConflict), errors.Is(err, service.ErrPasswordReused), errors.Is(err, service.ErrMFANotBound), errors.Is(err, service.ErrApiTokenLimit), repo.IsDuplicate(err), repo.IsConflict(err):
		return statusError(http.StatusConflict, "conflict", err)
	case repo.IsNotFound(err):
		return statusError(http.StatusNotFound, "not_found", err)
	default:
		return statusError(http.StatusInternalServerError, "internal_server_error", err)
	}
}
func statusError(status int, code string, err error) error {
	return &httpx.StatusError{StatusCode: status, Code: code, Message: code, Err: err}
}

func expectedTokenVersion(value string) []uint64 {
	if value == "" {
		return nil
	}
	version, err := strconv.ParseUint(strings.Trim(value, "\""), 10, 64)
	if err != nil || version == 0 {
		return []uint64{0}
	}
	return []uint64{version}
}

func optionalVersion(value *uint64) []uint64 {
	if value == nil {
		return nil
	}
	return []uint64{*value}
}
