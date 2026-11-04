package composition

import (
	"context"
	"errors"
	"fmt"
	"github.com/reina0721/clouddrive/internal/module/console"
	iammodel "github.com/reina0721/clouddrive/internal/module/iam/model"
	iamrepo "github.com/reina0721/clouddrive/internal/module/iam/repo"
	iamservice "github.com/reina0721/clouddrive/internal/module/iam/service"
	navigationhandler "github.com/reina0721/clouddrive/internal/module/navigation/handler"
	todohandler "github.com/reina0721/clouddrive/internal/module/todo/handler"
	permission "github.com/reina0721/clouddrive/internal/permission"
	"net/http"
)

// consoleIAMPort 只转换模块间输入、投影及错误，不创建第二套身份或权限状态。
type consoleIAMPort struct{ service *iamservice.Service }

func consoleError(err error) error {
	if err == nil {
		return nil
	}
	var challenge *iamservice.MFARequiredError
	if errors.As(err, &challenge) {
		return &console.MFARequiredError{ChallengeID: challenge.ChallengeID}
	}
	mappings := []struct{ source, target error }{
		{iamservice.ErrSetupClosed, console.ErrSetupClosed}, {iamservice.ErrPasswordReused, console.ErrPasswordReused},
		{iamservice.ErrInvalidCredentials, console.ErrInvalidCredentials}, {iamservice.ErrSessionInvalid, console.ErrSessionInvalid}, {iamservice.ErrMFAInvalidCode, console.ErrMFAInvalidCode}, {iamservice.ErrMFAChallengeInvalid, console.ErrMFAChallengeInvalid},
		{iamservice.ErrRegistrationClosed, console.ErrRegistrationClosed}, {iamservice.ErrAccountDisabled, console.ErrAccountDisabled}, {iamservice.ErrAccountLocked, console.ErrAccountLocked}, {iamservice.ErrVersionConflict, console.ErrVersionConflict}, {iammodel.ErrOwnerInvariant, console.ErrOwnerInvariant}, {iamservice.ErrImmutableOwner, console.ErrImmutableOwner},
		{iammodel.ErrInvalidUsername, console.ErrInvalidUsername}, {iammodel.ErrInvalidName, console.ErrInvalidName}, {iammodel.ErrInvalidPassword, console.ErrInvalidPassword}, {iammodel.ErrInvalidID, console.ErrInvalidID}, {iamservice.ErrUnknownPermission, console.ErrUnknownPermission}, {iamservice.ErrInvalidQuery, console.ErrInvalidQuery},
	}
	for _, mapping := range mappings {
		if errors.Is(err, mapping.source) {
			return fmt.Errorf("%w: %w", mapping.target, err)
		}
	}
	return err
}
func consoleSession(value iamservice.Session) console.Session {
	return console.Session{ID: value.ID, CSRFToken: value.CSRFToken, Identity: console.SessionIdentity{AccountID: value.Identity.AccountID, Username: value.Identity.Username, DisplayName: value.Identity.DisplayName, Permissions: value.Identity.Permissions, MustChangePassword: value.Identity.MustChangePassword}, CreatedAt: value.CreatedAt, IdleExpiresAt: value.IdleExpiresAt, AbsoluteExpiresAt: value.AbsoluteExpiresAt}
}
func consoleAccount(value iammodel.Account) console.Account {
	return console.Account{ID: value.ID, Username: value.Username, DisplayName: value.DisplayName, Status: string(value.Status), Version: value.Version, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}
func consoleRole(value iammodel.Role) console.CoreRole {
	return console.CoreRole{ID: value.ID, Name: value.Name, System: value.System, Active: value.Active, Archived: value.Archived, Version: value.Version, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
}
func (port consoleIAMPort) Setup(ctx context.Context, token, username, name, password string) (console.Session, error) {
	value, err := port.service.Setup(ctx, token, username, name, password)
	return consoleSession(value), consoleError(err)
}
func (port consoleIAMPort) Login(ctx context.Context, username, password string) (console.Session, error) {
	value, err := port.service.Login(ctx, username, password)
	return consoleSession(value), consoleError(err)
}
func (port consoleIAMPort) VerifyMFAChallenge(ctx context.Context, id, code string) (console.Session, error) {
	value, err := port.service.VerifyMFAChallenge(ctx, id, code)
	return consoleSession(value), consoleError(err)
}
func (port consoleIAMPort) Logout(ctx context.Context, id string) error {
	return consoleError(port.service.Logout(ctx, id))
}
func (port consoleIAMPort) ChangePassword(ctx context.Context, id, current, next string) error {
	return consoleError(port.service.ChangePassword(ctx, id, current, next))
}
func (port consoleIAMPort) Registration(ctx context.Context) (console.RegistrationSettings, error) {
	value, err := port.service.Registration(ctx)
	return console.RegistrationSettings(value), consoleError(err)
}
func (port consoleIAMPort) UpdateRegistration(ctx context.Context, value console.RegistrationSettings) error {
	return consoleError(port.service.UpdateRegistration(ctx, iamrepo.RegistrationSettings(value)))
}
func (port consoleIAMPort) CreateConsoleAccount(ctx context.Context, email, name, password string, roles []string, status string, public bool) (console.Account, error) {
	value, err := port.service.CreateConsoleAccount(ctx, email, name, password, roles, iammodel.AccountStatus(status), public)
	return consoleAccount(value), consoleError(err)
}
func (port consoleIAMPort) ListAccounts(ctx context.Context, offset, limit int, filter console.AccountFilter) (console.AccountList, error) {
	value, err := port.service.ListAccounts(ctx, offset, limit, iamrepo.AccountFilter{Query: filter.Query, Status: filter.Status, Archived: filter.Archived, RoleID: filter.RoleID, Sort: filter.Sort})
	items := make([]console.Account, len(value.Items))
	for i, item := range value.Items {
		items[i] = consoleAccount(item)
	}
	return console.AccountList{Items: items, Total: value.Total}, consoleError(err)
}
func (port consoleIAMPort) AccountDetail(ctx context.Context, id string) (console.AccountDetail, error) {
	value, err := port.service.AccountDetail(ctx, id)
	roles := make([]console.CoreRole, len(value.Roles))
	for i, role := range value.Roles {
		roles[i] = consoleRole(role)
	}
	return console.AccountDetail{Account: consoleAccount(value.Account), Roles: roles}, consoleError(err)
}
func (port consoleIAMPort) RoleDetail(ctx context.Context, id string) (console.RoleDetail, error) {
	value, err := port.service.RoleDetail(ctx, id)
	return console.RoleDetail{Role: consoleRole(value.Role), Permissions: value.Permissions, AssignedAccountCount: value.AssignedAccountCount}, consoleError(err)
}
func (port consoleIAMPort) ListRoles(ctx context.Context, offset, limit int, query string) (console.RoleList, error) {
	value, err := port.service.ListRoles(ctx, offset, limit, query)
	roles := make([]console.CoreRole, len(value.Items))
	for i, role := range value.Items {
		roles[i] = consoleRole(role)
	}
	return console.RoleList{Items: roles, Total: value.Total}, consoleError(err)
}
func (port consoleIAMPort) AccountRolesSnapshot(ctx context.Context, id string) (console.AccountRoles, error) {
	value, err := port.service.AccountRolesSnapshot(ctx, id)
	return console.AccountRoles{RoleIDs: value.RoleIDs}, consoleError(err)
}
func (port consoleIAMPort) RolePermissionsSnapshot(ctx context.Context, id string) (console.RolePermissions, error) {
	value, err := port.service.RolePermissionsSnapshot(ctx, id)
	return console.RolePermissions{PermissionKeys: value.PermissionKeys}, consoleError(err)
}
func (port consoleIAMPort) UpdateConsoleProfile(ctx context.Context, id string, version uint64, name, email string) error {
	return consoleError(port.service.UpdateConsoleProfile(ctx, id, version, name, email))
}
func (port consoleIAMPort) SetAccountStatusVersion(ctx context.Context, id, status string, version uint64) error {
	return consoleError(port.service.SetAccountStatusVersion(ctx, id, iammodel.AccountStatus(status), version))
}
func (port consoleIAMPort) ReplaceAccountRoles(ctx context.Context, id string, version uint64, roles []string) (uint64, error) {
	value, err := port.service.ReplaceAccountRoles(ctx, id, version, roles)
	return value.EntityVersion, consoleError(err)
}
func (port consoleIAMPort) WriteConsoleRole(ctx context.Context, id string, version uint64, name string, keys []permission.Key) (string, error) {
	value, err := port.service.WriteConsoleRole(ctx, id, version, name, keys)
	return value, consoleError(err)
}
func (port consoleIAMPort) ListSessions(ctx context.Context, id string, offset, limit int, status string) (console.SessionList, error) {
	value, err := port.service.ListSessions(ctx, id, offset, limit, iamservice.SessionListStatus(status))
	items := make([]console.SessionInfo, len(value.Items))
	for i, item := range value.Items {
		items[i] = console.SessionInfo{IDHash: item.IDHash, CreatedAt: item.CreatedAt, LastSeenAt: item.LastSeenAt, IdleExpiresAt: item.IdleExpiresAt, AbsoluteExpiresAt: item.AbsoluteExpiresAt}
	}
	return console.SessionList{Items: items, Total: value.Total}, consoleError(err)
}
func (port consoleIAMPort) RevokeSessions(ctx context.Context, id string, hashes []string) (int, error) {
	value, err := port.service.RevokeSessions(ctx, id, hashes)
	return value, consoleError(err)
}
func (port consoleIAMPort) RequireConsolePermission(ctx context.Context, id string, key permission.Key) error {
	return consoleError(port.service.RequireConsolePermission(ctx, id, key))
}

func consoleAuthenticate(source func(*http.Request) (*http.Request, error)) func(*http.Request) (*http.Request, error) {
	return func(request *http.Request) (*http.Request, error) {
		authenticated, err := source(request)
		if err != nil {
			return nil, consoleError(err)
		}
		_, session, ok := iamservice.SessionFromContext(authenticated.Context())
		if !ok {
			return nil, console.ErrSessionInvalid
		}
		return console.WithSession(authenticated, consoleSession(session)), nil
	}
}

type consoleTodoPort struct{ operations todohandler.Operations }

func consoleTodo(value todohandler.Todo) console.Todo {
	return console.Todo{ID: value.ID, Title: value.Title, Status: console.TodoStatus(value.Status), CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt, CompletedAt: value.CompletedAt}
}
func (port consoleTodoPort) ListTodos(ctx context.Context, params console.ListTodosParams) (console.TodoList, error) {
	value, err := port.operations.ListTodos(ctx, todohandler.ListTodosParams{Offset: params.Offset, Limit: params.Limit})
	items := make([]console.Todo, len(value.Items))
	for i, item := range value.Items {
		items[i] = consoleTodo(item)
	}
	return console.TodoList{Items: items, Offset: value.Offset, Limit: value.Limit, Total: value.Total}, err
}
func (port consoleTodoPort) CreateTodo(ctx context.Context, input console.CreateTodoRequest) (console.Todo, error) {
	value, err := port.operations.CreateTodo(ctx, todohandler.CreateTodoRequest{Title: input.Title})
	return consoleTodo(value), err
}
func (port consoleTodoPort) CompleteTodo(ctx context.Context, id string) (console.Todo, error) {
	value, err := port.operations.CompleteTodo(ctx, id)
	return consoleTodo(value), err
}

type consoleNavigationPort struct{ operations navigationhandler.Operations }

func (port consoleNavigationPort) ListMenus(ctx context.Context) (console.NavigationMenus, error) {
	value, err := port.operations.ListMenus(ctx)
	items := make([]console.NavigationMenu, len(value.Items))
	for i, item := range value.Items {
		items[i] = console.NavigationMenu{ID: item.ID, ModuleID: item.ModuleID, RouteID: item.RouteID, TitleMessageID: item.TitleMessageID, IconID: item.IconID, DefaultParentID: item.DefaultParentID, DefaultOrder: item.DefaultOrder, Enabled: item.Enabled, ParentID: item.ParentID, Order: item.Order, Version: item.Version, Overridden: item.Overridden, ParentOverridden: item.ParentOverridden, OrderOverridden: item.OrderOverridden, Label: item.Label, Permission: item.Permission}
	}
	return console.NavigationMenus{Items: items, CatalogRevision: value.CatalogRevision, NavigationRevision: value.NavigationRevision}, err
}
