// Package webui 声明 Organization 的部门、岗位与账号组织分配页面。
package webui

import (
	"github.com/reina0721/clouddrive/internal/module"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
)

func Binding() webuicontract.Binding {
	return webuicontract.Binding{ModuleID: string(module.ID("organization")), Entries: []webuicontract.Entry{{ID: "organization.departments", SourcePath: "DepartmentsPage.tsx"}, {ID: "organization.positions", SourcePath: "PositionsPage.tsx"}, {ID: "organization.assignments", SourcePath: "AssignmentsPage.tsx"}}, Routes: []webuicontract.Route{
		{ID: "organization.departments", Path: "/admin/departments", EntryID: "organization.departments", TitleMessageID: "webui.organization.departments.title", ViewOperationID: "organization.departments.list", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
		{ID: "organization.positions", Path: "/admin/positions", EntryID: "organization.positions", TitleMessageID: "webui.organization.positions.title", ViewOperationID: "organization.positions.list", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
		{ID: "organization.assignments", Path: "/admin/account-organization", EntryID: "organization.assignments", TitleMessageID: "webui.organization.assignments.title", ViewOperationID: "organization.assignments.get", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
	}, Navigation: []webuicontract.Navigation{
		{ID: "organization.directory", RouteID: "organization.departments", TitleMessageID: "webui.organization.directory.title", IconID: "building", Order: 80},
		{ID: "organization.departments", ParentID: "organization.directory", RouteID: "organization.departments", TitleMessageID: "webui.organization.departments.title", IconID: "building", Order: 90},
		{ID: "organization.positions", ParentID: "organization.directory", RouteID: "organization.positions", TitleMessageID: "webui.organization.positions.title", IconID: "briefcase", Order: 100},
		{ID: "organization.assignments", ParentID: "organization.directory", RouteID: "organization.assignments", TitleMessageID: "webui.organization.assignments.title", IconID: "users", Order: 110},
	}, ActionPermissions: []webuicontract.ActionPermission{
		{OperationID: "organization.departments.create"},
		{OperationID: "organization.departments.update"},
		{OperationID: "organization.positions.create"},
		{OperationID: "organization.positions.update"},
		{OperationID: "organization.assignments.replace"},
	}, Locales: []webuicontract.Locale{{Language: "en-US", Namespace: "webui.organization", SourcePath: "locale/en-US.json"}, {Language: "zh-CN", Namespace: "webui.organization", SourcePath: "locale/zh-CN.json"}}, MockSource: "mock.ts", Requires: []webuicontract.SDKRequirement{{ID: "runtime", MajorVersion: 1}, {ID: "http", MajorVersion: 1}, {ID: "i18n", MajorVersion: 1}, {ID: "ui", MajorVersion: 1}, {ID: "mock", MajorVersion: 1}}}
}
