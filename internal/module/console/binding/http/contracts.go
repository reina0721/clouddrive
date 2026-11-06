package httpbinding

import (
	"context"
	"errors"
	permission "github.com/reina0721/clouddrive/internal/permission"
	"net/http"
	"time"
)

// IdentityAccess 是控制台使用方拥有的 IAM 窄契约；composition 负责跨模块转换。
type IdentityAccess interface {
	Setup(context.Context, string, string, string, string) (Session, error)
	Login(context.Context, string, string) (Session, error)
	VerifyMFAChallenge(context.Context, string, string) (Session, error)
	Logout(context.Context, string) error
	ChangePassword(context.Context, string, string, string) error
	VerifySessionPassword(context.Context, string, string) error
	Registration(context.Context) (RegistrationSettings, error)
	UpdateRegistration(context.Context, RegistrationSettings) error
	CreateConsoleAccount(context.Context, string, string, string, []string, string, bool) (Account, error)
	ListAccounts(context.Context, int, int, AccountFilter) (AccountList, error)
	AccountDetail(context.Context, string) (AccountDetail, error)
	RoleDetail(context.Context, string) (RoleDetail, error)
	ListRoles(context.Context, int, int, string) (RoleList, error)
	AccountRolesSnapshot(context.Context, string) (AccountRoles, error)
	RolePermissionsSnapshot(context.Context, string) (RolePermissions, error)
	UpdateConsoleProfile(context.Context, string, uint64, string, string) error
	SetAccountStatusVersion(context.Context, string, string, uint64) error
	ReplaceAccountRoles(context.Context, string, uint64, []string) (uint64, error)
	WriteConsoleRole(context.Context, string, uint64, string, []permission.Key) (string, error)
	ListSessions(context.Context, string, int, int, string) (SessionList, error)
	RevokeSessions(context.Context, string, []string) (int, error)
	RequireConsolePermission(context.Context, string, permission.Key) error
}
type SessionIdentity struct {
	AccountID, Username, DisplayName string
	Permissions                      []permission.Key
	MustChangePassword               bool
}
type Session struct {
	ID, CSRFToken                               string
	Identity                                    SessionIdentity
	CreatedAt, IdleExpiresAt, AbsoluteExpiresAt time.Time
}
type sessionContextKey struct{}

func WithSession(r *http.Request, value Session) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), sessionContextKey{}, value))
}
func SessionFromContext(ctx context.Context) (string, Session, bool) {
	value, ok := ctx.Value(sessionContextKey{}).(Session)
	return value.ID, value, ok
}

type Account struct {
	ID, Username, DisplayName, Status string
	Version                           uint64
	CreatedAt, UpdatedAt              time.Time
}
type AccountList struct {
	Items []Account
	Total int64
}
type AccountDetail struct {
	Account Account
	Roles   []CoreRole
}
type CoreRole struct {
	ID, Name                 string
	System, Active, Archived bool
	Version                  uint64
	CreatedAt, UpdatedAt     time.Time
}
type RoleList struct {
	Items []CoreRole
	Total int64
}
type RoleDetail struct {
	Role                 CoreRole
	Permissions          []permission.Definition
	AssignedAccountCount int64
}
type AccountFilter struct {
	Query, Status, RoleID, Sort string
	Archived                    *bool
}
type AccountRoles struct{ RoleIDs []string }
type RolePermissions struct{ PermissionKeys []permission.Key }
type RegistrationSettings struct {
	ID            int       `json:"-"`
	Enabled       bool      `json:"enabled"`
	DefaultRoleID string    `json:"defaultRoleId"`
	Version       uint64    `json:"version"`
	UpdatedAt     time.Time `json:"updatedAt"`
}
type SessionInfo struct {
	IDHash                                                  string
	CreatedAt, LastSeenAt, IdleExpiresAt, AbsoluteExpiresAt time.Time
}
type SessionList struct {
	Items []SessionInfo
	Total int64
}

const SessionListActive = "active"
const AccountActive = "active"

var (
	ErrSetupClosed         = errors.New("console setup closed")
	ErrPasswordReused      = errors.New("console password already used")
	ErrInvalidCredentials  = errors.New("console invalid credentials")
	ErrSessionInvalid      = errors.New("console invalid session")
	ErrMFAInvalidCode      = ErrInvalidCredentials
	ErrMFAChallengeInvalid = ErrInvalidCredentials
	ErrRegistrationClosed  = errors.New("console registration disabled")
	ErrAccountDisabled     = errors.New("console account disabled")
	ErrAccountLocked       = errors.New("console account locked")
	ErrVersionConflict     = errors.New("console version conflict")
	ErrOwnerInvariant      = errors.New("console last administrator protection")
	ErrImmutableOwner      = errors.New("console protected role")
	ErrInvalidUsername     = errors.New("console invalid username")
	ErrInvalidName         = errors.New("console invalid name")
	ErrInvalidPassword     = errors.New("console invalid password")
	ErrInvalidID           = errors.New("console invalid id")
	ErrUnknownPermission   = errors.New("console unknown permission")
	ErrInvalidQuery        = errors.New("console invalid query")
)

type MFARequiredError struct{ ChallengeID string }

func (e *MFARequiredError) Error() string { return "multi-factor verification required" }

type TodoStatus string
type Todo struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Status      TodoStatus `json:"status"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}
type TodoList struct {
	Items  []Todo `json:"items"`
	Offset int    `json:"offset"`
	Limit  int    `json:"limit"`
	Total  int64  `json:"total"`
}
type ListTodosParams struct{ Offset, Limit *int }
type CreateTodoRequest struct {
	Title string `json:"title"`
}
type TodoOperations interface {
	ListTodos(context.Context, ListTodosParams) (TodoList, error)
	CreateTodo(context.Context, CreateTodoRequest) (Todo, error)
	CompleteTodo(context.Context, string) (Todo, error)
}
type NavigationMenu struct {
	ID               string `json:"id"`
	ModuleID         string `json:"moduleId"`
	RouteID          string `json:"routeId"`
	TitleMessageID   string `json:"titleMessageId"`
	IconID           string `json:"iconId"`
	DefaultParentID  string `json:"defaultParentId"`
	DefaultOrder     int    `json:"defaultOrder"`
	Enabled          bool   `json:"enabled"`
	ParentID         string `json:"parentId"`
	Order            int    `json:"order"`
	Version          uint64 `json:"version"`
	Overridden       bool   `json:"overridden"`
	ParentOverridden bool   `json:"parentOverridden"`
	OrderOverridden  bool   `json:"orderOverridden"`
	Label            string `json:"label"`
	Permission       string `json:"permission"`
}
type NavigationMenus struct {
	Items              []NavigationMenu `json:"items"`
	CatalogRevision    string           `json:"catalogRevision"`
	NavigationRevision string           `json:"navigationRevision"`
}
type NavigationOperations interface {
	ListMenus(context.Context) (NavigationMenus, error)
}
