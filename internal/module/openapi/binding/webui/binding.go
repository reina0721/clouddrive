// Package webui 声明 OpenAPI 模块的 WebUI 页面（075-009）：单路由 /openapi 工作台
// （左资源树 + 顶部多标签 + 请求/响应上下分割），对齐 Apifox 核心骨架、视觉沿用系统主题。
package webui

import (
	"github.com/reina0721/clouddrive/internal/module"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
)

// Binding 返回 OpenAPI 契约可视化页面的 WebUI 声明：`/openapi` 单路由承载工作台，
// 页面渲染 `webui generate` 生成的契约快照（openapi-spec.ts），浏览零请求，因此
// mock 源为空路由表；动态选择（当前操作/请求 Tab）走 query 深链（?op=&mode=）。
// 页面访问门槛：绑定 iam.session.read（R075-008），未登录跳转 /login、菜单隐藏。
func Binding() webuicontract.Binding {
	return webuicontract.Binding{ModuleID: string(module.ID("openapi")), Entries: []webuicontract.Entry{
		{ID: "openapi.workspace", SourcePath: "OpenAPIPage.tsx"},
	}, Routes: []webuicontract.Route{
		// 契约是公开仓库产物，页面不发起后端 operation；访问门槛复用 iam.session.read。
		// 087 DEC-087-001：openapi.workspace 是首批 singleton workspace 工作区——
		// 同一 principal 只保留一个实例，重复打开只激活（普通页面不生成标签）。
		{ID: "openapi.workspace", Path: "/openapi", EntryID: "openapi.workspace", TitleMessageID: "webui.openapi.docs.title", ViewOperationID: "iam.session.read", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented, WorkspaceTab: webuicontract.WorkspaceTabPolicy{Mode: webuicontract.WorkspaceTabSingleton, Restorable: true}},
	}, Navigation: []webuicontract.Navigation{
		{ID: "openapi.developer", RouteID: "openapi.workspace", TitleMessageID: "webui.openapi.developer.title", IconID: "sliders", Order: 60},
		{ID: "openapi.docs", ParentID: "openapi.developer", RouteID: "openapi.workspace", TitleMessageID: "webui.openapi.docs.title", IconID: "book", Order: 120},
	}, Locales: []webuicontract.Locale{{Language: "en-US", Namespace: "webui.openapi", SourcePath: "locale/en-US.json"}, {Language: "zh-CN", Namespace: "webui.openapi", SourcePath: "locale/zh-CN.json"}}, MockSource: "mock.ts", Requires: []webuicontract.SDKRequirement{{ID: "runtime", MajorVersion: 1}, {ID: "i18n", MajorVersion: 1}, {ID: "ui", MajorVersion: 1}, {ID: "mock", MajorVersion: 1}}}
}
