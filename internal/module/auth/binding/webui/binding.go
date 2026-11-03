// Package webui 声明 Auth 低敏审计查询页面。
package webui

import (
	"github.com/reina0721/clouddrive/internal/module"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
)

func Binding() webuicontract.Binding {
	return webuicontract.Binding{ModuleID: string(module.ID("auth")), Entries: []webuicontract.Entry{{ID: "auth.audit", SourcePath: "AuditPage.tsx"}}, Routes: []webuicontract.Route{{ID: "auth.audit", Path: "/admin/audit", EntryID: "auth.audit", TitleMessageID: "webui.auth.audit.title", ViewOperationID: "auth.audit.list", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented}}, Navigation: []webuicontract.Navigation{
		{ID: "auth.governance", RouteID: "auth.audit", TitleMessageID: "webui.auth.governance.title", IconID: "shield", Order: 50},
		{ID: "auth.audit", ParentID: "auth.governance", RouteID: "auth.audit", TitleMessageID: "webui.auth.audit.title", IconID: "list", Order: 110},
	}, Locales: []webuicontract.Locale{{Language: "en-US", Namespace: "webui.auth", SourcePath: "locale/en-US.json"}, {Language: "zh-CN", Namespace: "webui.auth", SourcePath: "locale/zh-CN.json"}}, MockSource: "mock.ts", Requires: []webuicontract.SDKRequirement{{ID: "runtime", MajorVersion: 1}, {ID: "http", MajorVersion: 1}, {ID: "i18n", MajorVersion: 1}, {ID: "ui", MajorVersion: 1}, {ID: "mock", MajorVersion: 1}}}
}
