// Package webui 声明 Navigation 菜单策略管理页面。
package webui

import (
	"github.com/reina0721/clouddrive/internal/module"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
)

func Binding() webuicontract.Binding {
	return webuicontract.Binding{ModuleID: string(module.ID("navigation")), Entries: []webuicontract.Entry{{ID: "navigation.menus", SourcePath: "MenusPage.tsx"}}, Routes: []webuicontract.Route{{ID: "navigation.menus", Path: "/admin/menus", EntryID: "navigation.menus", TitleMessageID: "webui.navigation.menus.title", ViewOperationID: "navigation.menus.list", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented}}, Navigation: []webuicontract.Navigation{{ID: "navigation.menus", RouteID: "navigation.menus", TitleMessageID: "webui.navigation.menus.title", IconID: "menu", Order: 120}}, ActionPermissions: []webuicontract.ActionPermission{{OperationID: "navigation.menus.update"}}, Locales: []webuicontract.Locale{{Language: "en-US", Namespace: "webui.navigation", SourcePath: "locale/en-US.json"}, {Language: "zh-CN", Namespace: "webui.navigation", SourcePath: "locale/zh-CN.json"}}, MockSource: "mock.ts", Requires: []webuicontract.SDKRequirement{{ID: "runtime", MajorVersion: 1}, {ID: "http", MajorVersion: 1}, {ID: "i18n", MajorVersion: 1}, {ID: "ui", MajorVersion: 1}, {ID: "mock", MajorVersion: 1}}}
}
