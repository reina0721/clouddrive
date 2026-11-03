// Package webui 声明 Settings 设置中心的八个分区页面与两级菜单。
package webui

import (
	"github.com/reina0721/clouddrive/internal/module"
	webuicontract "github.com/reina0721/clouddrive/internal/webui"
)

func Binding() webuicontract.Binding {
	return webuicontract.Binding{ModuleID: string(module.ID("settings")), Entries: []webuicontract.Entry{
		{ID: "settings.layout", SourcePath: "SettingsLayout.tsx"},
		{ID: "settings.profile", SourcePath: "ProfilePage.tsx"},
		{ID: "settings.account", SourcePath: "AccountPage.tsx"},
		{ID: "settings.security", SourcePath: "SecurityPage.tsx"},
		{ID: "settings.appearance", SourcePath: "AppearancePage.tsx"},
		{ID: "settings.notifications", SourcePath: "NotificationsPage.tsx"},
		{ID: "settings.language", SourcePath: "LanguagePage.tsx"},
		{ID: "settings.about", SourcePath: "AboutPage.tsx"},
		{ID: "settings.acknowledgement", SourcePath: "AcknowledgementPage.tsx"},
	}, Routes: []webuicontract.Route{
		// 073：八个分区共享设置分组布局（GroupLayoutID → settings.layout），
		// 固定页内导航 + 宿主注入的内容区。
		{ID: "settings.profile", Path: "/settings/profile", EntryID: "settings.profile", GroupLayoutID: "settings.layout", TitleMessageID: "webui.settings.profile.title", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
		{ID: "settings.account", Path: "/settings/account", EntryID: "settings.account", GroupLayoutID: "settings.layout", TitleMessageID: "webui.settings.account.title", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
		{ID: "settings.security", Path: "/settings/security", EntryID: "settings.security", GroupLayoutID: "settings.layout", TitleMessageID: "webui.settings.security.title", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
		{ID: "settings.appearance", Path: "/settings/appearance", EntryID: "settings.appearance", GroupLayoutID: "settings.layout", TitleMessageID: "webui.settings.appearance.title", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
		{ID: "settings.notifications", Path: "/settings/notifications", EntryID: "settings.notifications", GroupLayoutID: "settings.layout", TitleMessageID: "webui.settings.notifications.title", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
		{ID: "settings.language", Path: "/settings/language", EntryID: "settings.language", GroupLayoutID: "settings.layout", TitleMessageID: "webui.settings.language.title", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
		{ID: "settings.about", Path: "/settings/about", EntryID: "settings.about", GroupLayoutID: "settings.layout", TitleMessageID: "webui.settings.about.title", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
		{ID: "settings.acknowledgement", Path: "/settings/acknowledgement", EntryID: "settings.acknowledgement", GroupLayoutID: "settings.layout", TitleMessageID: "webui.settings.acknowledgement.title", Layout: webuicontract.RouteLayoutApp, DeliveryState: webuicontract.DeliveryImplemented},
	}, Navigation: []webuicontract.Navigation{
		// 083 LAYOUT-003（DEC-002 B-2）：Settings 全局菜单收敛为单入口 settings.center，
		// 八个分区由页内 SectionNav（SettingsLayout）导航，不再重复挂全局侧边栏子项。
		{ID: "settings.center", RouteID: "settings.profile", TitleMessageID: "webui.settings.center.title", IconID: "settings", Order: 20},
	}, Locales: []webuicontract.Locale{{Language: "en-US", Namespace: "webui.settings", SourcePath: "locale/en-US.json"}, {Language: "zh-CN", Namespace: "webui.settings", SourcePath: "locale/zh-CN.json"}}, MockSource: "mock.ts", Requires: []webuicontract.SDKRequirement{{ID: "runtime", MajorVersion: 1}, {ID: "http", MajorVersion: 1}, {ID: "i18n", MajorVersion: 1}, {ID: "ui", MajorVersion: 1}, {ID: "mock", MajorVersion: 1}}}
}
