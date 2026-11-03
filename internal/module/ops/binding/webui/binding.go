// Package webui 提供 Ops module 按需贡献的 WebUI 页面声明。
package webui

import (
	"github.com/reina0721/clouddrive/internal/module"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
)

// Binding 返回 Ops 真实运行状态看板声明；同时声明分区注入点（顶栏快捷入口与
// 底部 Management 数据源状态）与动作级权限钩子。
func Binding() webuicontract.Binding {
	return webuicontract.Binding{
		ModuleID: string(module.ID("ops")),
		Entries: []webuicontract.Entry{
			{ID: "ops.capabilities", SourcePath: "CapabilitiesPage.tsx"},
			{ID: "ops.dashboard", SourcePath: "DashboardPage.tsx"},
			{ID: "ops.capabilities-entry", SourcePath: "HeaderAction.tsx"},
			{ID: "ops.management-status", SourcePath: "FooterStatus.tsx"},
		},
		HeaderActions: []webuicontract.HeaderAction{{
			ZoneContributionBase: webuicontract.ZoneContributionBase{
				ID: "ops.capabilities-entry", EntryID: "ops.capabilities-entry",
				TitleMessageID: "webui.ops.capabilities.entry.title", OperationID: "ops.diagnostics", Order: 10,
			},
			IconID: "dashboard",
		}},
		FooterStatusItems: []webuicontract.FooterStatusItem{{
			ZoneContributionBase: webuicontract.ZoneContributionBase{
				ID: "ops.management-status", EntryID: "ops.management-status",
				TitleMessageID: "webui.ops.footer.status.title", OperationID: "ops.diagnostics", Order: 10,
			},
			Kind: webuicontract.FooterStatusKindStatus,
		}},
		ActionPermissions: []webuicontract.ActionPermission{{OperationID: "ops.diagnostics"}},
		Routes: []webuicontract.Route{
			{ID: "ops.dashboard", Path: "/dashboard", EntryID: "ops.dashboard", TitleMessageID: "webui.ops.dashboard.title", ViewOperationID: "ops.diagnostics", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented, DegradedCapabilities: []string{"diagnostics", "metrics"}, Default: true},
			{ID: "ops.capabilities", Path: "/dashboard/capabilities", EntryID: "ops.capabilities", TitleMessageID: "webui.ops.capabilities.title", ViewOperationID: "ops.diagnostics", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented, DegradedCapabilities: []string{"diagnostics"}},
		},
		Navigation: []webuicontract.Navigation{
			{ID: "ops.dashboard", RouteID: "ops.dashboard", TitleMessageID: "webui.ops.dashboard.title", IconID: "activity", Order: 10},
			{ID: "ops.capabilities", ParentID: "ops.dashboard", RouteID: "ops.capabilities", TitleMessageID: "webui.ops.capabilities.title", IconID: "activity", Order: 20},
		},
		Locales: []webuicontract.Locale{
			{Language: "en-US", Namespace: "webui.ops", SourcePath: "locale/en-US.json"},
			{Language: "zh-CN", Namespace: "webui.ops", SourcePath: "locale/zh-CN.json"},
		},
		MockSource: "mock.ts",
		Requires: []webuicontract.SDKRequirement{
			{ID: "runtime", MajorVersion: 1},
			{ID: "http", MajorVersion: 1},
			{ID: "i18n", MajorVersion: 1},
			{ID: "query", MajorVersion: 1},
			{ID: "ui", MajorVersion: 1},
			{ID: "mock", MajorVersion: 1},
			{ID: "zone", MajorVersion: 1},
		},
	}
}
