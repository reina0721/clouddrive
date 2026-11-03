// Package webui 声明 IAM 的认证、安全、账号、角色和权限页面。
package webui

import (
	"github.com/reina0721/clouddrive/internal/module"
	"github.com/reina0721/clouddrive/internal/webui"
)

func Binding() webui.Binding {
	return webui.Binding{ModuleID: string(module.ID("iam")), Entries: []webui.Entry{{ID: "iam.setup", SourcePath: "SetupPage.tsx"}, {ID: "iam.login", SourcePath: "LoginPage.tsx"}, {ID: "iam.security", SourcePath: "SecurityPage.tsx"}, {ID: "iam.accounts", SourcePath: "AccountsPage.tsx"}, {ID: "iam.roles", SourcePath: "RolesPage.tsx"}, {ID: "iam.permissions", SourcePath: "PermissionsPage.tsx"}, {ID: "iam.sessions", SourcePath: "SessionsPage.tsx"}, {ID: "iam.api-tokens", SourcePath: "ApiTokensPage.tsx"}}, Routes: []webui.Route{
		{ID: "iam.setup", Path: "/setup", EntryID: "iam.setup", TitleMessageID: "webui.iam.setup.title", Layout: webui.RouteLayoutBlank, DeliveryState: webui.DeliveryImplemented},
		{ID: "iam.login", Path: "/login", EntryID: "iam.login", TitleMessageID: "webui.iam.login.title", Layout: webui.RouteLayoutBlank, DeliveryState: webui.DeliveryImplemented, UnauthenticatedDefault: true},
		{ID: "iam.security", Path: "/account/security", EntryID: "iam.security", TitleMessageID: "webui.iam.security.title", ViewOperationID: "iam.session.read", Layout: webui.RouteLayoutApp, DeliveryState: webui.DeliveryImplemented},
		{ID: "iam.accounts", Path: "/admin/accounts", EntryID: "iam.accounts", TitleMessageID: "webui.iam.accounts.title", ViewOperationID: "iam.accounts.list", Layout: webui.RouteLayoutApp, DeliveryState: webui.DeliveryImplemented},
		{ID: "iam.roles", Path: "/admin/roles", EntryID: "iam.roles", TitleMessageID: "webui.iam.roles.title", ViewOperationID: "iam.roles.list", Layout: webui.RouteLayoutApp, DeliveryState: webui.DeliveryImplemented},
		{ID: "iam.permissions", Path: "/admin/permissions", EntryID: "iam.permissions", TitleMessageID: "webui.iam.permissions.title", ViewOperationID: "iam.permissions.list", Layout: webui.RouteLayoutApp, DeliveryState: webui.DeliveryImplemented},
		{ID: "iam.sessions", Path: "/admin/sessions", EntryID: "iam.sessions", TitleMessageID: "webui.iam.sessions.title", ViewOperationID: "iam.sessions.list", Layout: webui.RouteLayoutApp, DeliveryState: webui.DeliveryImplemented},
		{ID: "iam.api-tokens", Path: "/admin/api-tokens", EntryID: "iam.api-tokens", TitleMessageID: "webui.iam.apiTokens.title", ViewOperationID: "iam.api-tokens.list", Layout: webui.RouteLayoutApp, DeliveryState: webui.DeliveryImplemented},
	}, Navigation: []webui.Navigation{
		{ID: "iam.access", RouteID: "iam.accounts", TitleMessageID: "webui.iam.access.title", IconID: "users", Order: 30},
		// 074：iam 页面职责归位——账号安全页回到身份权限组；设置中心自行实现安全页并调用 iam 接口。
		{ID: "iam.security", ParentID: "iam.access", RouteID: "iam.security", TitleMessageID: "webui.iam.security.title", IconID: "user", Order: 40},
		{ID: "iam.accounts", ParentID: "iam.access", RouteID: "iam.accounts", TitleMessageID: "webui.iam.accounts.title", IconID: "users", Order: 50},
		{ID: "iam.roles", ParentID: "iam.access", RouteID: "iam.roles", TitleMessageID: "webui.iam.roles.title", IconID: "shield", Order: 60},
		{ID: "iam.permissions", ParentID: "iam.access", RouteID: "iam.permissions", TitleMessageID: "webui.iam.permissions.title", IconID: "key", Order: 70},
		{ID: "iam.sessions", ParentID: "iam.access", RouteID: "iam.sessions", TitleMessageID: "webui.iam.sessions.title", IconID: "refresh", Order: 75},
		{ID: "iam.api-tokens", ParentID: "iam.access", RouteID: "iam.api-tokens", TitleMessageID: "webui.iam.apiTokens.title", IconID: "key", Order: 80},
	}, ActionPermissions: []webui.ActionPermission{
		{OperationID: "iam.accounts.create"},
		{OperationID: "iam.accounts.status"},
		{OperationID: "iam.accounts.update"},
		{OperationID: "iam.accounts.archive"},
		{OperationID: "iam.accounts.password.reset"},
		{OperationID: "iam.accounts.roles.replace"},
		{OperationID: "iam.roles.create"},
		{OperationID: "iam.roles.update"},
		{OperationID: "iam.roles.archive"},
		{OperationID: "iam.roles.permissions.replace"},
		{OperationID: "iam.api-tokens.create"},
		{OperationID: "iam.api-tokens.update"},
		{OperationID: "iam.api-tokens.rotate"},
		{OperationID: "iam.api-tokens.disable"},
		{OperationID: "iam.api-tokens.enable"},
		{OperationID: "iam.api-tokens.revoke"},
	}, Locales: []webui.Locale{{Language: "en-US", Namespace: "webui.iam", SourcePath: "locale/en-US.json"}, {Language: "zh-CN", Namespace: "webui.iam", SourcePath: "locale/zh-CN.json"}}, MockSource: "mock.ts", Requires: []webui.SDKRequirement{{ID: "runtime", MajorVersion: 1}, {ID: "http", MajorVersion: 1}, {ID: "i18n", MajorVersion: 1}, {ID: "ui", MajorVersion: 1}, {ID: "mock", MajorVersion: 1}}}
}
