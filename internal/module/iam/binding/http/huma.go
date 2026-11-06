package httpbinding

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	iampermission "github.com/reina0721/clouddrive/internal/module/iam/binding/permission"
	"github.com/reina0721/clouddrive/internal/module/iam/model"
	"github.com/reina0721/clouddrive/internal/module/iam/repo"
	"github.com/reina0721/clouddrive/internal/module/iam/service"
	permissioncatalog "github.com/reina0721/clouddrive/internal/permission"
	"github.com/reina0721/clouddrive/internal/transport/http/humabinding"
	"github.com/reina0721/clouddrive/pkg/httpx"
)

type originInput struct {
	Origin string `header:"Origin" required:"true"`
}
type loginInput struct {
	Origin string `header:"Origin" required:"true"`
	Body   struct {
		Username string `json:"username" minLength:"3" maxLength:"254"`
		Password string `json:"password" minLength:"1" maxLength:"128"`
	}
}
type setupInput struct {
	Origin string `header:"Origin" required:"true"`
	Body   struct {
		SetupToken  string `json:"setupToken" minLength:"1" maxLength:"512"`
		Username    string `json:"username" minLength:"3" maxLength:"254"`
		DisplayName string `json:"displayName" minLength:"1" maxLength:"128"`
		Password    string `json:"password" minLength:"1" maxLength:"128"`
	}
}
type pageInput struct {
	Offset int    `query:"offset" minimum:"0" default:"0"`
	Limit  int    `query:"limit" minimum:"1" maximum:"100" default:"20"`
	Query  string `query:"query" maxLength:"128"`
	Sort   string `query:"sort" maxLength:"32"`
}
type accountsListInput struct {
	Offset   int                          `query:"offset" minimum:"0" default:"0"`
	Limit    int                          `query:"limit" minimum:"1" maximum:"100" default:"20"`
	Query    string                       `query:"query" maxLength:"128"`
	Status   humabinding.Optional[string] `query:"status" enum:"active,disabled"`
	Archived humabinding.Optional[bool]   `query:"archived"`
	RoleID   string                       `query:"roleId" maxLength:"36"`
	Sort     string                       `query:"sort" maxLength:"32"`
}
type roleAccountsInput struct {
	ID     string `path:"id"`
	Offset int    `query:"offset" minimum:"0" default:"0"`
	Limit  int    `query:"limit" minimum:"1" maximum:"100" default:"20"`
}
type permissionRolesInput struct {
	Key    string `query:"key" minLength:"1" maxLength:"128"`
	Offset int    `query:"offset" minimum:"0" default:"0"`
	Limit  int    `query:"limit" minimum:"1" maximum:"100" default:"20"`
}
type idInput struct {
	ID string `path:"id"`
}

// mutationInput 是带 {id} path 参数的 mutation 公共字段；huma 对 embedded
// struct 的 path 参数绑定不可靠，使用它的输入类型必须在自身结构体扁平声明。
type mutationInput struct {
	IfMatch   string `header:"If-Match"`
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
}
type createAccountInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		Username    string `json:"username" minLength:"3" maxLength:"254"`
		DisplayName string `json:"displayName" minLength:"1" maxLength:"128"`
		Password    string `json:"password" minLength:"1" maxLength:"128"`
	}
}
type statusInput struct {
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		Status model.AccountStatus `json:"status" enum:"active,disabled"`
	}
}
type updateAccountInput struct {
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		ExpectedAccountVersion uint64 `json:"expectedAccountVersion"`
		DisplayName            string `json:"displayName" minLength:"1" maxLength:"128"`
	}
}
type archiveInput struct {
	IfMatch   string `header:"If-Match"`
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
}
type passwordInput struct {
	IfMatch   string `header:"If-Match"`
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		Password string `json:"password" minLength:"1" maxLength:"128"`
	}
}

// batchAccountInput 是批量账号操作的请求（状态/归档共用）：
// 扁平声明 Header 与 Body，避免 embedded struct 的 path 绑定不可靠问题。
type batchAccountInput struct {
	Origin         string `header:"Origin" required:"true"`
	CSRFToken      string `header:"X-CSRF-Token" required:"true"`
	IdempotencyKey string `header:"Idempotency-Key" required:"true" minLength:"1" maxLength:"128"`
	Body           struct {
		AccountIDs []string            `json:"accountIds" minItems:"1" maxItems:"100"`
		Status     model.AccountStatus `json:"status" enum:"active,disabled"`
	}
}

// batchResultOutput 返回请求、处理、成功和失败的完整集合，并用 correlationId
// 关联同一次管理操作产生的审计与诊断。
type batchResultOutput struct {
	RequestedCount int                        `json:"requestedCount"`
	ProcessedCount int                        `json:"processedCount"`
	Succeeded      []service.BatchItemSuccess `json:"succeeded"`
	Failed         []service.BatchItemFailure `json:"failed"`
	CorrelationID  string                     `json:"correlationId,omitempty"`
}

func batchResultOutputFrom(result service.BatchResult) batchResultOutput {
	return batchResultOutput{RequestedCount: result.RequestedCount, ProcessedCount: result.ProcessedCount, Succeeded: result.Succeeded, Failed: result.Failed, CorrelationID: result.CorrelationID}
}

// roleIDsInput 扁平声明路径/Header 与 body，避免 embedded struct 的 path
// 参数绑定歧义；huma 只直接绑定本结构体字段。
type roleIDsInput struct {
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		ExpectedAccountVersion uint64   `json:"expectedAccountVersion"`
		RoleIDs                []string `json:"roleIds"`
	}
}
type permissionKeysInput struct {
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		ExpectedRoleVersion uint64                  `json:"expectedRoleVersion"`
		PermissionKeys      []permissioncatalog.Key `json:"permissionKeys"`
	}
}
type changePasswordInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		CurrentPassword string `json:"currentPassword" minLength:"1" maxLength:"128"`
		NewPassword     string `json:"newPassword" minLength:"1" maxLength:"128"`
	}
}

type verifyPasswordInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		Password string `json:"password" minLength:"1" maxLength:"128"`
	}
}

type passwordVerifiedResponse struct {
	Verified bool `json:"verified"`
}
type updateSelfProfileInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		ExpectedVersion uint64 `json:"expectedVersion"`
		Nickname        string `json:"nickname" maxLength:"64"`
		Bio             string `json:"bio" maxLength:"2048"`
		BirthDate       string `json:"birthDate" maxLength:"16"`
	}
}

// updatePreferencesInput 是偏好更新的 HTTP 输入：字段省略表示保持现值
// （PATCH 语义）；显式枚举/布尔字段必须合法，非法值返回 400。
type updatePreferencesInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		Version       *uint64 `json:"version,omitempty"`
		Language      string  `json:"language,omitempty" enum:"zh-CN,en-US"`
		TimeZone      string  `json:"timeZone,omitempty" maxLength:"64"`
		ThemeMode     string  `json:"themeMode,omitempty" enum:"system,light,dark"`
		ThemePreset   string  `json:"themePreset,omitempty" enum:"blue,cyan,green,violet,orange"`
		Density       string  `json:"density,omitempty" enum:"comfortable,compact"`
		ReduceMotion  *bool   `json:"reduceMotion,omitempty"`
		Notifications *struct {
			EmailDigest   *bool `json:"emailDigest,omitempty"`
			InApp         *bool `json:"inApp,omitempty"`
			ShowSummaries *bool `json:"showSummaries,omitempty"`
			DailySummary  *bool `json:"dailySummary,omitempty"`
		} `json:"notifications,omitempty"`
	}
}
type selfArchiveInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		ConfirmationID string `json:"confirmationId"`
	}
}
type selfArchiveBeginOutput struct {
	Body struct {
		ConfirmationID string `json:"confirmationId"`
	}
}
type createRoleInput struct {
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		Code        string `json:"code" minLength:"2" maxLength:"64"`
		Name        string `json:"name" minLength:"1" maxLength:"128"`
		Description string `json:"description" maxLength:"1024"`
	}
}
type updateRoleInput struct {
	ID        string `path:"id"`
	Origin    string `header:"Origin" required:"true"`
	CSRFToken string `header:"X-CSRF-Token" required:"true"`
	Body      struct {
		ExpectedRoleVersion uint64 `json:"expectedRoleVersion"`
		Name                string `json:"name" minLength:"1" maxLength:"128"`
		Description         string `json:"description" maxLength:"1024"`
	}
}

// accountFilter 把账号列表 HTTP 过滤参数转换为 repo typed 过滤条件；
// 空参数保持与既有无过滤语义一致。
func accountFilter(input *accountsListInput) repo.AccountFilter {
	filter := repo.AccountFilter{Query: input.Query, RoleID: input.RoleID, Sort: input.Sort}
	if status := input.Status.Pointer(); status != nil {
		filter.Status = *status
	}
	if archived := input.Archived.Pointer(); archived != nil {
		filter.Archived = archived
	}
	return filter
}

type sessionOutputEnvelope struct {
	SetCookie    string `header:"Set-Cookie"`
	CacheControl string `header:"Cache-Control"`
	Body         sessionResponse
}

// loginResultBody 平铺会话字段（与 sessionResponse 顶层同构，兼容既有登录
// 客户端读取 csrfToken/identity）；MFA 需要时只输出 mfaRequired/challengeId。
type loginResultBody struct {
	Identity          identityResponse `json:"identity,omitempty"`
	CSRFToken         string           `json:"csrfToken,omitempty"`
	CreatedAt         time.Time        `json:"createdAt,omitempty"`
	IdleExpiresAt     time.Time        `json:"idleExpiresAt,omitempty"`
	AbsoluteExpiresAt time.Time        `json:"absoluteExpiresAt,omitempty"`
	MFARequired       bool             `json:"mfaRequired,omitempty"`
	ChallengeID       string           `json:"challengeId,omitempty"`
}
type loginResultEnvelope struct {
	SetCookie    string `header:"Set-Cookie"`
	CacheControl string `header:"Cache-Control"`
	Body         loginResultBody
}

func loginResultBodyFrom(session service.Session) loginResultBody {
	return loginResultBody{Identity: sessionOutput(session).Identity, CSRFToken: session.CSRFToken, CreatedAt: session.CreatedAt, IdleExpiresAt: session.IdleExpiresAt, AbsoluteExpiresAt: session.AbsoluteExpiresAt}
}

type emptyOutput struct{}
type logoutOutput struct {
	SetCookie string `header:"Set-Cookie"`
}
type jsonOutput[T any] struct {
	CacheControl string `header:"Cache-Control"`
	Body         T
}

func definition(id, method, path, security, policy, scope, action string) huma.Operation {
	operation := huma.Operation{OperationID: id, Method: method, Path: path, Tags: []string{"IAM"}}
	metadata := humabinding.Definition{ID: id, Method: method, Path: path, Security: security, Policy: policy, Scope: scope, Action: action}
	if method == http.MethodGet || method == http.MethodHead {
		return humabinding.Define(operation, metadata)
	}
	return humabinding.JSONDefinition(operation, metadata)
}
func protected(id, method, path, scope, action string) huma.Operation {
	_ = action
	return definition(id, method, path, humabinding.SecurityWebUISession, humabinding.PolicyProtected, scope, id)
}
func public(id, method, path string) huma.Operation {
	return definition(id, method, path, humabinding.SecurityNone, humabinding.PolicyPublic, "", "")
}
func problem(ctx context.Context, err error) error {
	return httpx.NewProtocolProblemError(ctx, serviceError(err))
}

// RegisterHuma 注册 IAM 的完整 typed HTTP 契约。Huma 类型只停留在模块 binding 边界。
func RegisterHuma(api huma.API, handler *Handler) {
	setup := public(opSetup, http.MethodPost, "/api/v1/iam/setup")
	setup.DefaultStatus = http.StatusCreated
	setup.Middlewares = huma.Middlewares{handler.requireOrigin}
	huma.Register(api, setup, func(ctx context.Context, in *setupInput) (*sessionOutputEnvelope, error) {
		v, err := handler.service.Setup(ctx, in.Body.SetupToken, in.Body.Username, in.Body.DisplayName, in.Body.Password)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return sessionEnvelope(v), nil
	})
	login := public(opLogin, http.MethodPost, "/api/v1/iam/login")
	login.Middlewares = huma.Middlewares{handler.requireOrigin}
	huma.Register(api, login, func(ctx context.Context, in *loginInput) (*loginResultEnvelope, error) {
		v, err := handler.service.Login(ctx, in.Body.Username, in.Body.Password)
		var mfaRequired *service.MFARequiredError
		if errors.As(err, &mfaRequired) {
			return &loginResultEnvelope{CacheControl: "no-store", Body: loginResultBody{MFARequired: true, ChallengeID: mfaRequired.ChallengeID}}, nil
		}
		if err != nil {
			return nil, problem(ctx, err)
		}
		return &loginResultEnvelope{SetCookie: sessionCookie(v.ID), CacheControl: "no-store", Body: loginResultBodyFrom(v)}, nil
	})
	huma.Register(api, protected(opSession, http.MethodGet, "/api/v1/iam/session", string(iampermission.SelfRead), "read"), func(ctx context.Context, _ *struct{}) (*sessionOutputEnvelope, error) {
		id, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		csrf, err := handler.service.RotateCSRF(ctx, id)
		if err != nil {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", err))
		}
		current.CSRFToken = csrf
		return sessionEnvelope(current), nil
	})
	logout := protected(opLogout, http.MethodPost, "/api/v1/iam/logout", string(iampermission.SelfRead), "execute")
	logout.DefaultStatus = http.StatusNoContent
	logout.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, logout, func(ctx context.Context, _ *originInput) (*logoutOutput, error) {
		id, _, _ := service.SessionFromContext(ctx)
		if err := handler.service.Logout(ctx, id); err != nil {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusInternalServerError, "internal_server_error", err))
		}
		return &logoutOutput{SetCookie: expiredCookie()}, nil
	})
	verify := protected(opVerifyPassword, http.MethodPost, "/api/v1/iam/self/password/verify", string(iampermission.SelfRead), "execute")
	verify.MaxBodyBytes = 2048
	verify.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, verify, func(ctx context.Context, in *verifyPasswordInput) (*jsonOutput[passwordVerifiedResponse], error) {
		id, _, _ := service.SessionFromContext(ctx)
		if err := handler.service.VerifySessionPassword(ctx, id, in.Body.Password); err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(passwordVerifiedResponse{Verified: true}), nil
	})
	change := protected(opChangePassword, http.MethodPost, "/api/v1/iam/self/password", string(iampermission.SelfPasswordWrite), "execute")
	change.DefaultStatus = http.StatusNoContent
	change.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, change, func(ctx context.Context, in *changePasswordInput) (*emptyOutput, error) {
		_, current, _ := service.SessionFromContext(ctx)
		if err := handler.service.ChangePassword(ctx, current.Identity.AccountID, in.Body.CurrentPassword, in.Body.NewPassword); err != nil {
			return nil, problem(ctx, err)
		}
		return &emptyOutput{}, nil
	})

	// 072：自服务主页资料更新：昵称/介绍/出生日期（乐观锁），不撤销会话。
	selfProfile := protected(opSelfProfileUpdate, http.MethodPatch, "/api/v1/iam/self/profile", string(iampermission.SelfProfileWrite), "update")
	selfProfile.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, selfProfile, func(ctx context.Context, in *updateSelfProfileInput) (*jsonOutput[profileResponse], error) {
		_, current, _ := service.SessionFromContext(ctx)
		updated, err := handler.service.UpdateSelfProfile(ctx, current.Identity.AccountID, in.Body.ExpectedVersion, in.Body.Nickname, in.Body.Bio, in.Body.BirthDate)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(profileResponse{Username: updated.Username, Nickname: updated.Nickname, Bio: updated.Bio, BirthDate: updated.BirthDate, Version: updated.Version}), nil
	})

	// 090 BE-090-005：跨设备用户偏好（自服务）：读取有效偏好（默认+覆盖）与
	// PATCH 合并更新；写操作要求 CSRF。偏好不撤销会话、不触发安全告警。
	selfPreferences := protected(opSelfPreferences, http.MethodGet, "/api/v1/iam/self/preferences", string(iampermission.SelfPreferencesRead), "read")
	huma.Register(api, selfPreferences, func(ctx context.Context, _ *struct{}) (*jsonOutput[preferencesResponse], error) {
		_, current, _ := service.SessionFromContext(ctx)
		value, err := handler.service.SelfPreferences(ctx, current.Identity.AccountID)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(preferencesFromModel(value)), nil
	})
	selfPreferencesWrite := protected(opSelfPreferencesWrite, http.MethodPatch, "/api/v1/iam/self/preferences", string(iampermission.SelfPreferencesWrite), "update")
	selfPreferencesWrite.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, selfPreferencesWrite, func(ctx context.Context, in *updatePreferencesInput) (*jsonOutput[preferencesResponse], error) {
		_, current, _ := service.SessionFromContext(ctx)
		updates := model.UserPreferences{
			Language: model.PreferenceLanguage(in.Body.Language), TimeZone: model.PreferenceTimeZone(in.Body.TimeZone),
			ThemeMode: model.PreferenceThemeMode(in.Body.ThemeMode), ThemePreset: model.PreferenceThemePreset(in.Body.ThemePreset),
			Density: model.PreferenceDensity(in.Body.Density), ReduceMotion: in.Body.ReduceMotion != nil && *in.Body.ReduceMotion,
		}
		var notifications *service.NotificationUpdate
		if in.Body.Notifications != nil {
			notifications = &service.NotificationUpdate{
				EmailDigest:   in.Body.Notifications.EmailDigest,
				InApp:         in.Body.Notifications.InApp,
				ShowSummaries: in.Body.Notifications.ShowSummaries,
				DailySummary:  in.Body.Notifications.DailySummary,
			}
		}
		value, err := handler.service.UpdateSelfPreferences(ctx, current.Identity.AccountID, updates, notifications, optionalVersion(in.Body.Version)...)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(preferencesFromModel(value)), nil
	})

	// 072：自服务软注销（两步确认）：首调生成 confirmationId，二次确认归档并吊销会话。
	selfArchiveBegin := protected(opSelfArchive, http.MethodPost, "/api/v1/iam/self/archive", string(iampermission.SelfArchive), "archive")
	selfArchiveBegin.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, selfArchiveBegin, func(ctx context.Context, _ *originInput) (*selfArchiveBeginOutput, error) {
		_, current, _ := service.SessionFromContext(ctx)
		confirmationID, err := handler.service.BeginSelfArchive(ctx, current.Identity.AccountID)
		if err != nil {
			return nil, problem(ctx, err)
		}
		out := &selfArchiveBeginOutput{}
		out.Body.ConfirmationID = confirmationID
		return out, nil
	})
	selfArchiveConfirm := protected(opSelfArchiveConfirm, http.MethodPost, "/api/v1/iam/self/archive/confirm", string(iampermission.SelfArchive), "archive")
	selfArchiveConfirm.DefaultStatus = http.StatusNoContent
	selfArchiveConfirm.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, selfArchiveConfirm, func(ctx context.Context, in *selfArchiveInput) (*emptyOutput, error) {
		_, current, _ := service.SessionFromContext(ctx)
		if err := handler.service.ConfirmSelfArchive(ctx, current.Identity.AccountID, in.Body.ConfirmationID); err != nil {
			return nil, problem(ctx, err)
		}
		return &emptyOutput{}, nil
	})

	// 会话集中管理：列表（自助/管理员按账号，支持分页与 active/revoked/all 过滤）
	// 与批量吊销。列表返回摘要视图（IDHash hex），不泄露明文 SessionID。
	huma.Register(api, protected(opSessionList, http.MethodGet, "/api/v1/iam/sessions", string(iampermission.SelfRead), "list"), func(ctx context.Context, in *sessionListInput) (*jsonOutput[listResponse[sessionInfoResponse]], error) {
		accountID := in.AccountID
		if accountID == "" {
			_, current, ok := service.SessionFromContext(ctx)
			if !ok {
				return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
			}
			accountID = current.Identity.AccountID
		}
		result, err := handler.service.ListSessionsSorted(ctx, accountID, in.Offset, in.Limit, service.SessionListStatus(in.Status), in.Sort)
		if err != nil {
			return nil, problem(ctx, err)
		}
		output := make([]sessionInfoResponse, len(result.Items))
		for index, item := range result.Items {
			output[index] = sessionInfoResponse{
				IDHash: item.IDHash, AccountID: item.AccountID,
				CreatedAt: item.CreatedAt, LastSeenAt: item.LastSeenAt,
				IdleExpiresAt: item.IdleExpiresAt, AbsoluteExpiresAt: item.AbsoluteExpiresAt,
				RevokedAt: item.RevokedAt,
			}
		}
		return jsonEnvelope(listResponse[sessionInfoResponse]{Items: output, Offset: result.Offset, Limit: result.Limit, Total: result.Total}), nil
	})
	revoke := protected(opSessionRevoke, http.MethodPost, "/api/v1/iam/sessions/revoke", string(iampermission.AccountWrite), "revoke")
	revoke.DefaultStatus = http.StatusNoContent
	revoke.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, revoke, func(ctx context.Context, in *sessionRevokeInput) (*emptyOutput, error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		accountID := in.AccountID
		if accountID == "" {
			accountID = current.Identity.AccountID
		}
		if _, err := handler.service.RevokeSessions(ctx, accountID, in.Body.IDHashes); err != nil {
			return nil, problem(ctx, err)
		}
		return &emptyOutput{}, nil
	})

	huma.Register(api, protected(opAccounts, http.MethodGet, "/api/v1/iam/accounts", string(iampermission.AccountRead), "list"), func(ctx context.Context, in *accountsListInput) (*jsonOutput[listResponse[accountResponse]], error) {
		result, err := handler.service.ListAccounts(ctx, in.Offset, in.Limit, accountFilter(in))
		if err != nil {
			return nil, problem(ctx, err)
		}
		items := make([]accountResponse, len(result.Items))
		for i, item := range result.Items {
			items[i] = accountOutput(item)
		}
		return jsonEnvelope(listResponse[accountResponse]{items, result.Offset, result.Limit, result.Total}), nil
	})
	huma.Register(api, protected(opAccountRead, http.MethodGet, "/api/v1/iam/accounts/{id}", string(iampermission.AccountRead), "read"), func(ctx context.Context, in *idInput) (*jsonOutput[accountDetailResponse], error) {
		result, err := handler.service.AccountDetail(ctx, in.ID)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(accountDetailOutput(result)), nil
	})
	createAccount := protected(opCreateAccount, http.MethodPost, "/api/v1/iam/accounts", string(iampermission.AccountWrite), "create")
	createAccount.DefaultStatus = http.StatusCreated
	createAccount.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, createAccount, func(ctx context.Context, in *createAccountInput) (*jsonOutput[accountResponse], error) {
		item, err := handler.service.CreateAccount(ctx, in.Body.Username, in.Body.DisplayName, in.Body.Password)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(accountOutput(item)), nil
	})
	registerMutation(api, handler, protected(opAccountStatus, http.MethodPatch, "/api/v1/iam/accounts/{id}/status", string(iampermission.AccountWrite), "update"), func(ctx context.Context, in *statusInput) error {
		return handler.service.SetAccountStatus(ctx, in.ID, in.Body.Status)
	})
	registerMutation(api, handler, protected(opAccountUpdate, http.MethodPatch, "/api/v1/iam/accounts/{id}", string(iampermission.AccountWrite), "update"), func(ctx context.Context, in *updateAccountInput) error {
		return handler.service.UpdateAccountInfo(ctx, in.ID, in.Body.ExpectedAccountVersion, in.Body.DisplayName)
	})
	registerMutation(api, handler, protected(opAccountArchive, http.MethodPost, "/api/v1/iam/accounts/{id}/archive", string(iampermission.AccountWrite), "archive"), func(ctx context.Context, in *archiveInput) error {
		return handler.service.ArchiveAccount(ctx, in.ID, expectedTokenVersion(in.IfMatch)...)
	})
	// 批量启停/批量归档：逐账号复用既有安全语义（owner 不变量/安全 revision/
	// session 撤销/审计），失败不中止，返回成功与失败计数（084 产品化补全）。
	batchStatus := protected(opAccountStatusBatch, http.MethodPost, "/api/v1/iam/accounts/batch-status", string(iampermission.AccountWrite), "update")
	batchStatus.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, batchStatus, func(ctx context.Context, in *batchAccountInput) (*jsonOutput[batchResultOutput], error) {
		correlationID, _ := httpx.RequestIDFromContext(ctx)
		result, err := handler.service.BatchSetAccountStatusIdempotent(ctx, in.IdempotencyKey, correlationID, in.Body.AccountIDs, in.Body.Status)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(batchResultOutputFrom(result)), nil
	})
	batchArchive := protected(opAccountArchiveBatch, http.MethodPost, "/api/v1/iam/accounts/batch-archive", string(iampermission.AccountWrite), "archive")
	batchArchive.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, batchArchive, func(ctx context.Context, in *batchAccountInput) (*jsonOutput[batchResultOutput], error) {
		correlationID, _ := httpx.RequestIDFromContext(ctx)
		result, err := handler.service.BatchArchiveAccountsIdempotent(ctx, in.IdempotencyKey, correlationID, in.Body.AccountIDs)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(batchResultOutputFrom(result)), nil
	})
	registerMutation(api, handler, protected(opResetPassword, http.MethodPost, "/api/v1/iam/accounts/{id}/password-reset", string(iampermission.AccountWrite), "execute"), func(ctx context.Context, in *passwordInput) error {
		return handler.service.ResetPassword(ctx, in.ID, in.Body.Password, expectedTokenVersion(in.IfMatch)...)
	})
	huma.Register(api, protected(opAccountRolesRead, http.MethodGet, "/api/v1/iam/accounts/{id}/roles", string(iampermission.AccountRead), "read"), func(ctx context.Context, in *idInput) (*jsonOutput[accountRolesResponse], error) {
		view, err := handler.service.AccountRolesSnapshot(ctx, in.ID)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(accountRolesOutput(view)), nil
	})
	accountRolesReplace := protected(opAccountRoles, http.MethodPut, "/api/v1/iam/accounts/{id}/roles", string(iampermission.AccountWrite), "replace")
	accountRolesReplace.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, accountRolesReplace, func(ctx context.Context, in *roleIDsInput) (*jsonOutput[assignmentResponse], error) {
		result, err := handler.service.ReplaceAccountRoles(ctx, in.ID, in.Body.ExpectedAccountVersion, in.Body.RoleIDs)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(assignmentOutput(in.ID, result)), nil
	})

	huma.Register(api, protected(opRoles, http.MethodGet, "/api/v1/iam/roles", string(iampermission.RoleRead), "list"), func(ctx context.Context, in *pageInput) (*jsonOutput[listResponse[roleResponse]], error) {
		result, err := handler.service.ListRolesSorted(ctx, in.Offset, in.Limit, in.Query, in.Sort)
		if err != nil {
			return nil, problem(ctx, err)
		}
		items := make([]roleResponse, len(result.Items))
		for i, item := range result.Items {
			items[i] = roleOutput(item)
		}
		return jsonEnvelope(listResponse[roleResponse]{items, result.Offset, result.Limit, result.Total}), nil
	})
	huma.Register(api, protected(opRoleRead, http.MethodGet, "/api/v1/iam/roles/{id}", string(iampermission.RoleRead), "read"), func(ctx context.Context, in *idInput) (*jsonOutput[roleDetailResponse], error) {
		result, err := handler.service.RoleDetail(ctx, in.ID)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(roleDetailOutput(result)), nil
	})
	createRole := protected(opCreateRole, http.MethodPost, "/api/v1/iam/roles", string(iampermission.RoleWrite), "create")
	createRole.DefaultStatus = http.StatusCreated
	createRole.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, createRole, func(ctx context.Context, in *createRoleInput) (*jsonOutput[roleResponse], error) {
		item, err := handler.service.CreateRole(ctx, in.Body.Code, in.Body.Name, in.Body.Description)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(roleOutput(item)), nil
	})
	roleUpdate := protected(opRoleUpdate, http.MethodPatch, "/api/v1/iam/roles/{id}", string(iampermission.RoleWrite), "update")
	roleUpdate.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, roleUpdate, func(ctx context.Context, in *updateRoleInput) (*jsonOutput[roleResponse], error) {
		item, err := handler.service.UpdateRoleInfo(ctx, in.ID, in.Body.ExpectedRoleVersion, in.Body.Name, in.Body.Description)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(roleOutput(item)), nil
	})
	registerMutation(api, handler, protected(opRoleArchive, http.MethodPost, "/api/v1/iam/roles/{id}/archive", string(iampermission.RoleWrite), "archive"), func(ctx context.Context, in *archiveInput) error {
		return handler.service.ArchiveRole(ctx, in.ID)
	})
	huma.Register(api, protected(opRolePermissionsRead, http.MethodGet, "/api/v1/iam/roles/{id}/permissions", string(iampermission.RoleRead), "read"), func(ctx context.Context, in *idInput) (*jsonOutput[rolePermissionsResponse], error) {
		view, err := handler.service.RolePermissionsSnapshot(ctx, in.ID)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(rolePermissionsOutput(view)), nil
	})
	permissionsReplace := protected(opRolePermissions, http.MethodPut, "/api/v1/iam/roles/{id}/permissions", string(iampermission.RoleWrite), "replace")
	permissionsReplace.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, permissionsReplace, func(ctx context.Context, in *permissionKeysInput) (*jsonOutput[assignmentResponse], error) {
		result, err := handler.service.ReplaceRolePermissions(ctx, in.ID, in.Body.ExpectedRoleVersion, in.Body.PermissionKeys)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(assignmentOutput(in.ID, result)), nil
	})
	huma.Register(api, protected(opPermissions, http.MethodGet, "/api/v1/iam/permissions", string(iampermission.PermissionRead), "list"), func(_ context.Context, _ *struct{}) (*jsonOutput[[]permissionResponse], error) {
		definitions := handler.service.Permissions()
		items := make([]permissionResponse, len(definitions))
		for i, item := range definitions {
			items[i] = permissionOutput(item)
		}
		return jsonEnvelope(items), nil
	})
	// 反向影响分析（076）：角色→持有账号、权限键→使用角色；只读、分页，
	// 权限复用既有 role:read / permission:read，不新增权限键。
	huma.Register(api, protected(opRoleAccountsRead, http.MethodGet, "/api/v1/iam/roles/{id}/accounts", string(iampermission.RoleRead), "read"), func(ctx context.Context, in *roleAccountsInput) (*jsonOutput[listResponse[accountResponse]], error) {
		result, err := handler.service.ListAccountsForRole(ctx, in.ID, in.Offset, in.Limit)
		if err != nil {
			return nil, problem(ctx, err)
		}
		items := make([]accountResponse, len(result.Items))
		for index, item := range result.Items {
			items[index] = accountOutput(item)
		}
		return jsonEnvelope(listResponse[accountResponse]{Items: items, Offset: result.Offset, Limit: result.Limit, Total: result.Total}), nil
	})
	huma.Register(api, protected(opPermissionRolesRead, http.MethodGet, "/api/v1/iam/permissions/roles", string(iampermission.PermissionRead), "list"), func(ctx context.Context, in *permissionRolesInput) (*jsonOutput[listResponse[roleResponse]], error) {
		result, err := handler.service.ListRolesForPermission(ctx, permissioncatalog.Key(in.Key), in.Offset, in.Limit)
		if err != nil {
			return nil, problem(ctx, err)
		}
		items := make([]roleResponse, len(result.Items))
		for index, item := range result.Items {
			items[index] = roleOutput(item)
		}
		return jsonEnvelope(listResponse[roleResponse]{Items: items, Offset: result.Offset, Limit: result.Limit, Total: result.Total}), nil
	})

	// API-Token（078/080，R078-001/R080-001）：机器访问凭据；secret 明文只在
	// 创建/轮换响应一次；列表支持 status 过滤；PATCH 元数据与 disable/enable。
	huma.Register(api, protected(opApiTokens, http.MethodGet, "/api/v1/iam/api-tokens", string(iampermission.ApiTokenRead), "list"), func(ctx context.Context, in *apiTokenListInput) (*jsonOutput[listResponse[apiTokenResponse]], error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		result, err := handler.service.ListApiTokensSorted(ctx, current.Identity.AccountID, in.Offset, in.Limit, service.ApiTokenStatus(in.Status), in.Sort)
		if err != nil {
			return nil, problem(ctx, err)
		}
		items := make([]apiTokenResponse, len(result.Items))
		for index, item := range result.Items {
			items[index] = apiTokenViewOutput(item)
		}
		return jsonEnvelope(listResponse[apiTokenResponse]{Items: items, Offset: result.Offset, Limit: result.Limit, Total: result.Total}), nil
	})
	createApiToken := protected(opApiTokenCreate, http.MethodPost, "/api/v1/iam/api-tokens", string(iampermission.ApiTokenWrite), "create")
	createApiToken.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, createApiToken, func(ctx context.Context, in *apiTokenCreateInput) (*jsonOutput[apiTokenIssuedResponse], error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		issued, err := handler.service.CreateApiToken(ctx, current.Identity.AccountID, in.Body.Name, in.Body.Description, in.Body.Scopes, in.Body.ExpiresAt)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(apiTokenIssuedOutput(issued)), nil
	})
	updateApiToken := protected(opApiTokenUpdate, http.MethodPatch, "/api/v1/iam/api-tokens/{id}", string(iampermission.ApiTokenWrite), "update")
	updateApiToken.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, updateApiToken, func(ctx context.Context, in *apiTokenUpdateInput) (*emptyOutput, error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		if err := handler.service.UpdateApiToken(ctx, current.Identity.AccountID, in.ID, in.Body.Name, in.Body.Description, in.Body.ExpiresAt, in.Body.NeverExpires, expectedTokenVersion(in.IfMatch)...); err != nil {
			return nil, problem(ctx, err)
		}
		return &emptyOutput{}, nil
	})
	rotateApiToken := protected(opApiTokenRotate, http.MethodPost, "/api/v1/iam/api-tokens/{id}/rotate", string(iampermission.ApiTokenWrite), "rotate")
	rotateApiToken.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, rotateApiToken, func(ctx context.Context, in *apiTokenPathInput) (*jsonOutput[apiTokenIssuedResponse], error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		issued, err := handler.service.RotateApiToken(ctx, current.Identity.AccountID, in.ID, expectedTokenVersion(in.IfMatch)...)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(apiTokenIssuedOutput(issued)), nil
	})
	disableApiToken := protected(opApiTokenDisable, http.MethodPost, "/api/v1/iam/api-tokens/{id}/disable", string(iampermission.ApiTokenWrite), "disable")
	disableApiToken.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, disableApiToken, func(ctx context.Context, in *apiTokenPathInput) (*emptyOutput, error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		if err := handler.service.DisableApiToken(ctx, current.Identity.AccountID, in.ID, expectedTokenVersion(in.IfMatch)...); err != nil {
			return nil, problem(ctx, err)
		}
		return &emptyOutput{}, nil
	})
	enableApiToken := protected(opApiTokenEnable, http.MethodPost, "/api/v1/iam/api-tokens/{id}/enable", string(iampermission.ApiTokenWrite), "enable")
	enableApiToken.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, enableApiToken, func(ctx context.Context, in *apiTokenPathInput) (*emptyOutput, error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		if err := handler.service.EnableApiToken(ctx, current.Identity.AccountID, in.ID, expectedTokenVersion(in.IfMatch)...); err != nil {
			return nil, problem(ctx, err)
		}
		return &emptyOutput{}, nil
	})
	revokeApiToken := protected(opApiTokenRevoke, http.MethodPost, "/api/v1/iam/api-tokens/{id}/revoke", string(iampermission.ApiTokenWrite), "revoke")
	revokeApiToken.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, revokeApiToken, func(ctx context.Context, in *apiTokenPathInput) (*emptyOutput, error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		if err := handler.service.RevokeApiToken(ctx, current.Identity.AccountID, in.ID, expectedTokenVersion(in.IfMatch)...); err != nil {
			return nil, problem(ctx, err)
		}
		return &emptyOutput{}, nil
	})
	// 批量吊销令牌（090 PAGE-090-002）：Idempotency-Key 稳定重放，逐项失败不中止。
	revokeBatch := protected(opApiTokenRevokeBatch, http.MethodPost, "/api/v1/iam/api-tokens/batch-revoke", string(iampermission.ApiTokenWrite), "revoke")
	revokeBatch.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, revokeBatch, func(ctx context.Context, in *apiTokenBatchRevokeInput) (*jsonOutput[batchResultOutput], error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		correlationID, _ := httpx.RequestIDFromContext(ctx)
		result, err := handler.service.BatchRevokeApiTokensIdempotent(ctx, in.IdempotencyKey, correlationID, current.Identity.AccountID, in.Body.TokenIDs)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(batchResultOutputFrom(result)), nil
	})

	// MFA/TOTP（078，R078-002）：自助绑定/确认/解绑 + 登录第二步验证。
	mfaBegin := protected(opMFABegin, http.MethodPost, "/api/v1/iam/self/mfa", string(iampermission.SelfPasswordWrite), "enroll")
	mfaBegin.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, mfaBegin, func(ctx context.Context, _ *emptyInput) (*jsonOutput[mfaEnrollResponse], error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		view, err := handler.service.BeginMFAEnroll(ctx, current.Identity.AccountID)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(mfaEnrollResponse{Secret: view.Secret, URI: view.URI}), nil
	})
	huma.Register(api, protected(opMFAStatus, http.MethodGet, "/api/v1/iam/self/mfa", string(iampermission.SelfRead), "read"), func(ctx context.Context, _ *struct{}) (*jsonOutput[mfaStatusResponse], error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		registered, err := handler.service.MFABound(ctx, current.Identity.AccountID)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(mfaStatusResponse{Registered: registered}), nil
	})
	mfaConfirm := protected(opMFAConfirm, http.MethodPost, "/api/v1/iam/self/mfa/confirm", string(iampermission.SelfPasswordWrite), "confirm")
	mfaConfirm.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, mfaConfirm, func(ctx context.Context, in *mfaCodeInput) (*jsonOutput[mfaConfirmResponse], error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		codes, err := handler.service.ConfirmMFAEnroll(ctx, current.Identity.AccountID, in.Body.Code)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return jsonEnvelope(mfaConfirmResponse{RecoveryCodes: codes}), nil
	})
	mfaDisable := protected(opMFADisable, http.MethodPost, "/api/v1/iam/self/mfa/disable", string(iampermission.SelfPasswordWrite), "disable")
	mfaDisable.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, mfaDisable, func(ctx context.Context, in *mfaCodeInput) (*emptyOutput, error) {
		_, current, ok := service.SessionFromContext(ctx)
		if !ok {
			return nil, httpx.NewProtocolProblemError(ctx, statusError(http.StatusUnauthorized, "unauthenticated", nil))
		}
		if err := handler.service.DisableMFA(ctx, current.Identity.AccountID, in.Body.Code); err != nil {
			return nil, problem(ctx, err)
		}
		return &emptyOutput{}, nil
	})
	mfaVerify := public(opMFAVerify, http.MethodPost, "/api/v1/iam/login/mfa-verify")
	mfaVerify.Middlewares = huma.Middlewares{handler.requireOrigin}
	huma.Register(api, mfaVerify, func(ctx context.Context, in *mfaVerifyInput) (*sessionOutputEnvelope, error) {
		v, err := handler.service.VerifyMFAChallenge(ctx, in.Body.ChallengeID, in.Body.Code)
		if err != nil {
			return nil, problem(ctx, err)
		}
		return sessionEnvelope(v), nil
	})
}

func registerMutation[I any](api huma.API, handler *Handler, operation huma.Operation, call func(context.Context, *I) error) {
	operation.DefaultStatus = http.StatusNoContent
	operation.Middlewares = huma.Middlewares{handler.requireMutation}
	huma.Register(api, operation, func(ctx context.Context, in *I) (*emptyOutput, error) {
		if err := call(ctx, in); err != nil {
			return nil, problem(ctx, err)
		}
		return &emptyOutput{}, nil
	})
}
func HumaRegistration(handler *Handler) humabinding.Registration {
	return func(api huma.API) { RegisterHuma(api, handler) }
}
func (handler *Handler) requireOrigin(ctx huma.Context, next func(huma.Context)) {
	request, writer := humabinding.UnwrapHTTP(ctx)
	if handler == nil || !handler.originAllowed(request) {
		httpx.WriteProblem(writer, request, statusError(http.StatusForbidden, "origin_rejected", nil))
		return
	}
	next(ctx)
}
func (handler *Handler) requireMutation(ctx huma.Context, next func(huma.Context)) {
	request, writer := humabinding.UnwrapHTTP(ctx)
	id, _, ok := service.SessionFromContext(request.Context())
	if !ok || handler == nil || !handler.originAllowed(request) || handler.service.ValidateCSRF(request.Context(), id, request.Header.Get("X-CSRF-Token")) != nil {
		httpx.WriteProblem(writer, request, statusError(http.StatusForbidden, "csrf_rejected", nil))
		return
	}
	next(ctx)
}
func sessionEnvelope(v service.Session) *sessionOutputEnvelope {
	return &sessionOutputEnvelope{SetCookie: sessionCookie(v.ID), CacheControl: "no-store", Body: sessionOutput(v)}
}
func sessionCookie(id string) string {
	return (&http.Cookie{Name: service.SessionCookieName, Value: id, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode}).String()
}
func expiredCookie() string {
	return (&http.Cookie{Name: service.SessionCookieName, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode}).String()
}
func jsonEnvelope[T any](body T) *jsonOutput[T] {
	return &jsonOutput[T]{CacheControl: "no-store", Body: body}
}
func sessionOutput(v service.Session) sessionResponse {
	return sessionResponse{Identity: identityResponse{v.Identity.AccountID, v.Identity.Username, v.Identity.DisplayName, v.Identity.Nickname, v.Identity.Bio, v.Identity.BirthDate, v.Identity.Permissions, v.Identity.MustChangePassword, v.Identity.SecurityRevision}, CSRFToken: v.CSRFToken, CreatedAt: v.CreatedAt, IdleExpiresAt: v.IdleExpiresAt, AbsoluteExpiresAt: v.AbsoluteExpiresAt}
}
