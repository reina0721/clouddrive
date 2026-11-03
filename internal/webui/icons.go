package webui

// IconCatalog 是 WebUI 受控图标目录的 Go authority：Navigation/分区注入点的 IconID
// 取值必须属于该目录。Lucide 图标映射与 TS 联合类型由前端 webui/src/icon-catalog.ts
// 持有，一致性由 TestIconCatalogMatchesFrontendRegistry 守护；禁止任一侧私自增删。
//
// 目录刻意保持受限：先覆盖当前真实使用与已确认的常用操作图标，模块自定义图标
// entry 属于后续独立研究，不能以字符串透传绕过目录。
var IconCatalog = map[string]struct{}{
	"activity":      {},
	"bell":          {},
	"book":          {},
	"briefcase":     {},
	"building":      {},
	"check":         {},
	"chevron-right": {},
	"dashboard":     {},
	"info":          {},
	"key":           {},
	"languages":     {},
	"list":          {},
	"menu":          {},
	"palette":       {},
	"pencil":        {},
	"plus":          {},
	"refresh":       {},
	"reset":         {},
	"search":        {},
	"settings":      {},
	"shield":        {},
	"sliders":       {},
	"star":          {},
	"trash":         {},
	"user":          {},
	"users":         {},
	"x":             {},
}

// ValidIconID 报告 iconID 是否属于受控图标目录。
func ValidIconID(iconID string) bool {
	_, ok := IconCatalog[iconID]
	return ok
}
