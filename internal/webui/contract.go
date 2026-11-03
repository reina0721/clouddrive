// Package webui 定义 WebUI 的项目自有声明与运行时 manifest 契约。
package webui

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/reina0721/clouddrive/internal/projectlayout"
	"golang.org/x/text/language"
)

// DeliveryState 表示页面实现是否已经交付，不混入运行时可用性或访问结果。
type DeliveryState string

const (
	DeliveryImplemented    DeliveryState = "implemented"
	DeliveryNotImplemented DeliveryState = "not-implemented"
)

// RouteLayout 表示页面应由哪一种宿主布局承载。
type RouteLayout string

const (
	RouteLayoutApp   RouteLayout = "app"
	RouteLayoutBlank RouteLayout = "blank"
)

// WorkspaceTabMode 表示 route 是否可以作为宿主 Workspace Tab 的显式独立工作上下文。
// 默认 disabled：普通菜单访问、列表、设置分区、详情/编辑 Drawer 与普通子路由
// 一律不生成标签（087 恢复 085 Rev.1 的 opt-in 模型），宿主不得从访问历史推断资格。
type WorkspaceTabMode string

const (
	WorkspaceTabDisabled   WorkspaceTabMode = "disabled"
	WorkspaceTabSingleton  WorkspaceTabMode = "singleton"
	WorkspaceTabContextual WorkspaceTabMode = "contextual"
)

// WorkspaceTabPolicy 是 route 的显式工作上下文资格声明；零值归一化为 disabled。
// Restorable 表示该工作区只允许持久化低敏标签元数据（routeID/pinned/顺序/allowlist
// 后的 pathname 与 search），绝不保存草稿、凭据、响应 body、任意 query 或 dirty
// （085 REQ-085-008，087 保留该边界）。contextual 的实例 ID 不在静态 manifest 中，
// 由运行时打开动作提供。
type WorkspaceTabPolicy struct {
	Mode       WorkspaceTabMode
	Restorable bool
}

// NormalizedWorkspaceTabMode 把空值与未知值收敛为 disabled（fail closed）：
// 判定语义单一，避免调用方把空字符串当成可 opt-in 的合法值。
func NormalizedWorkspaceTabMode(mode WorkspaceTabMode) WorkspaceTabMode {
	if mode != WorkspaceTabSingleton && mode != WorkspaceTabContextual {
		return WorkspaceTabDisabled
	}
	return mode
}

// ManifestWorkspaceTabPolicy 是 WorkspaceTabPolicy 的安全运行时投影（仅非 disabled
// 时出现；disabled 省略字段，前端按 disabled 处理）。不含任何实例 ID 或业务数据。
type ManifestWorkspaceTabPolicy struct {
	Mode       WorkspaceTabMode `json:"mode"`
	Restorable bool             `json:"restorable"`
}

// ZoneID 标识宿主骨架分区；zone 是分区注入点的稳定枚举（Go 与前端共享契约）。
type ZoneID string

const (
	// ZoneHeaderActions 是顶栏操作区注入点（全局快捷入口、环境快捷操作）。
	ZoneHeaderActions ZoneID = "header-actions"
	// ZoneSidebarPanels 是侧边栏辅助面板区注入点（辅助信息面板、模块状态摘要）。
	ZoneSidebarPanels ZoneID = "sidebar-panels"
	// ZonePageHeader 是页面页头区域注入点（页头动作、状态摘要）。
	ZonePageHeader ZoneID = "page-header"
	// ZoneFooterStatus 是底部状态栏注入点（版本/revision/模块状态项）。
	ZoneFooterStatus ZoneID = "footer-status"
)

// PageHeaderItemKind 区分页头注入内容的呈现形态。
type PageHeaderItemKind string

const (
	PageHeaderItemKindAction PageHeaderItemKind = "action"
	PageHeaderItemKindStatus PageHeaderItemKind = "status"
)

// FooterStatusKind 区分底部状态注入内容的呈现形态。
type FooterStatusKind string

const (
	FooterStatusKindStatus FooterStatusKind = "status"
	FooterStatusKindMeta   FooterStatusKind = "meta"
)

// Access 表示当前请求对页面查看 operation 的访问结果。
type Access string

const (
	AccessAllowed                Access = "allowed"
	AccessAuthenticationRequired Access = "authentication-required"
	AccessDenied                 Access = "denied"
)

// ActivationState 表示应用是否发布模块。它不表示页面是否已实现或运行时是否可用。
type ActivationState string

const (
	ActivationEnabled  ActivationState = "enabled"
	ActivationDisabled ActivationState = "disabled"
)

// AvailabilityState 表示服务端为某个 route 提供的运行时能力快照。
type AvailabilityState string

const (
	AvailabilityAvailable   AvailabilityState = "available"
	AvailabilityDegraded    AvailabilityState = "degraded"
	AvailabilityUnavailable AvailabilityState = "unavailable"
)

// Availability 是安全 manifest 中的 route 级运行时能力视图。
type Availability struct {
	State        AvailabilityState
	Capabilities []string
}

// SDKRequirement 是模块对项目自有 WebUI SDK 主版本的构建期声明。
type SDKRequirement struct {
	ID           string
	MajorVersion uint
}

// SDKInventory 是 composition 当前实际提供的 SDK capability 主版本清单。
type SDKInventory map[string]uint

// ModuleRegistration 是应用 composition 对模块选择和发布状态的显式声明。
type ModuleRegistration struct {
	Binding    Binding
	Activation ActivationState
}

// Binding 是模块拥有的不可变 WebUI 声明。声明 Entry 的模块必须同时声明 locale 与
// mock 数据源；SourcePath 只用于构建期生成。分区注入点（HeaderActions 等）是
// 既有 route/menu 之上新增的类型化骨架注入面，语义保持向后兼容。
type Binding struct {
	ModuleID   string
	Entries    []Entry
	Routes     []Route
	Navigation []Navigation
	// HeaderActions 是顶栏操作区注入点。
	HeaderActions []HeaderAction
	// SidebarPanels 是侧边栏辅助面板区注入点。
	SidebarPanels []SidebarPanel
	// PageHeaderItems 是页头区域注入点。
	PageHeaderItems []PageHeaderItem
	// FooterStatusItems 是底部状态栏注入点。
	FooterStatusItems []FooterStatusItem
	// ActionPermissions 是模块页面内动作的权限钩子声明（OperationID 集合）。
	// Manifest 投影为 actionPermissions 供 SDK useActionAccess 控制呈现，不构成授权。
	ActionPermissions []ActionPermission
	Locales           []Locale
	// MockSource 是模块浏览器端 mock 数据路由表的源文件（webui facet 相对路径，如 mock.ts）。
	// 声明 Entry 的模块必须提供，保证显式声明 mock 环境时整个 WebUI 有完整本地数据。
	MockSource string
	Requires   []SDKRequirement
}

// Entry 是一个可延迟加载的页面入口。
type Entry struct {
	ID         string
	SourcePath string
}

// Route 是宿主 Router 使用的稳定页面声明。
type Route struct {
	ID              string
	Path            string
	EntryID         string
	TitleMessageID  string
	ViewOperationID string
	Layout          RouteLayout
	// GroupLayoutID 是本模块布局入口 entry（073）：同一 GroupLayoutID 的一族路由
	// 由共享的模块布局组件承载（如设置中心固定页内导航 + 内容区），切换路由时
	// 布局不卸载重挂；空值表示该路由独立渲染。
	GroupLayoutID string
	// WorkspaceTab 是 route 的显式工作上下文资格（085/087）；零值归一化为 disabled，
	// 普通页面不声明即不生成标签。
	WorkspaceTab           WorkspaceTabPolicy
	DeliveryState          DeliveryState
	DegradedCapabilities   []string
	Default                bool
	UnauthenticatedDefault bool
}

// Navigation 是宿主菜单使用的稳定节点。
type Navigation struct {
	ID             string
	ParentID       string
	RouteID        string
	TitleMessageID string
	IconID         string
	Order          int
}

// ZoneContributionBase 是所有分区注入点的公共字段；每类 zone 用独立结构体组合它，
// 避免万能 map/any 容器。EntryID 复用 Binding.Entries 声明（渲染组件仍懒加载）。
type ZoneContributionBase struct {
	ID             string
	EntryID        string
	TitleMessageID string
	// OperationID 是可选的动作级权限钩子；非空时必须存在于应用 operation inventory，
	// Manifest 投影时经 access 判定（呈现控制，不构成授权）。
	OperationID string
	Order       int
}

// HeaderAction 是顶栏操作区注入点。
type HeaderAction struct {
	ZoneContributionBase
	IconID string
}

// SidebarPanel 是侧边栏辅助面板区注入点。
type SidebarPanel struct {
	ZoneContributionBase
	IconID string
}

// PageHeaderItem 是页头区域注入点。
type PageHeaderItem struct {
	ZoneContributionBase
	Kind PageHeaderItemKind
}

// FooterStatusItem 是底部状态栏注入点。
type FooterStatusItem struct {
	ZoneContributionBase
	Kind FooterStatusKind
}

// ActionPermission 是模块页面内动作的权限钩子：OperationID 必须存在于应用
// operation inventory；Manifest 投影为 actionPermissions，供前端做呈现控制。
type ActionPermission struct {
	OperationID string
}

// Locale 是模块拥有的浏览器语言资源。
type Locale struct {
	Language   string
	Namespace  string
	SourcePath string
}

// HostNavigation 是宿主声明的导航项（owner=host，070 双向归属）：
// 用于平台分组/宿主平台页收纳业务模块页面；任何模块的 Navigation 都可引用它作为父级，
// 它也可引用任何已声明 navigation 作为父级（宿主导航分组可编排任意页面）。
type HostNavigation struct {
	ID             string
	RouteID        string
	TitleMessageID string
	IconID         string
	Order          int
	ParentID       string
}

// Catalog 是通过校验并冻结后的全部模块声明。
type Catalog struct {
	Bindings []Binding
	// HostNavigation 是宿主声明的导航项（070），随 manifest 投影。
	HostNavigation []HostNavigation
	Revision       string
}

// NavigationPolicy 是 Navigation Service 可提供的稀疏运行时策略；缺失项沿用静态声明。
type NavigationPolicy struct {
	NavigationID   string
	Enabled        bool
	ParentOverride *string
	OrderOverride  *int
}

type effectiveNavigationPolicy struct {
	NavigationID string
	Enabled      bool
	ParentID     string
	Order        int
}

// NavigationPolicySnapshot 是已校验、不可变并绑定到某一 Catalog revision 的有效策略快照。
type NavigationPolicySnapshot struct {
	Revision        string
	catalogRevision string
	policies        map[string]effectiveNavigationPolicy
}

// Manifest 是可安全返回给浏览器的运行时视图，不包含文件系统路径。
type Manifest struct {
	CatalogRevision    string                     `json:"catalogRevision"`
	NavigationRevision string                     `json:"navigationRevision"`
	Routes             []ManifestRoute            `json:"routes"`
	Menu               []ManifestMenu             `json:"menu"`
	Zones              []ManifestZone             `json:"zones"`
	ActionPermissions  []ManifestActionPermission `json:"actionPermissions,omitempty"`
}

// ManifestZone 是剥离构建期字段后的分区注入点：已通过 access/availability 门禁的
// 模块骨架贡献。Kind 只对 page-header/footer-status 注入点有意义，其余 zone 为空。
type ManifestZone struct {
	ModuleID       string `json:"moduleId"`
	Zone           ZoneID `json:"zone"`
	ID             string `json:"id"`
	EntryID        string `json:"entryId"`
	TitleMessageID string `json:"titleMessageId"`
	IconID         string `json:"iconId,omitempty"`
	Kind           string `json:"kind,omitempty"`
	Order          int    `json:"order"`
	Access         Access `json:"access"`
}

// ManifestActionPermission 是动作级权限钩子的运行时视图：服务端按 operation 判定
// access 后投影，前端据此控制触发器的呈现（不构成授权）。
type ManifestActionPermission struct {
	OperationID string `json:"operationId"`
	Access      Access `json:"access"`
}

// ManifestRoute 是剥离构建期字段后的路由。
type ManifestRoute struct {
	ModuleID        string      `json:"moduleId"`
	ID              string      `json:"id"`
	Path            string      `json:"path"`
	EntryID         string      `json:"entryId"`
	TitleMessageID  string      `json:"titleMessageId"`
	ViewOperationID string      `json:"viewOperationId,omitempty"`
	Layout          RouteLayout `json:"layout"`
	GroupLayoutID   string      `json:"groupLayoutId,omitempty"`
	// WorkspaceTab 是 workspace 资格的非 disabled 投影；disabled 省略，前端按 disabled 处理。
	WorkspaceTab           *ManifestWorkspaceTabPolicy `json:"workspaceTab,omitempty"`
	DeliveryState          DeliveryState               `json:"deliveryState"`
	Default                bool                        `json:"default"`
	UnauthenticatedDefault bool                        `json:"unauthenticatedDefault"`
	Access                 Access                      `json:"access"`
	Availability           AvailabilityState           `json:"availability"`
	AvailableCapabilities  []string                    `json:"availableCapabilities,omitempty"`
}

// ManifestMenu 是剥离构建期字段后的菜单节点。
type ManifestMenu struct {
	ModuleID       string `json:"moduleId"`
	ID             string `json:"id"`
	ParentID       string `json:"parentId,omitempty"`
	RouteID        string `json:"routeId"`
	TitleMessageID string `json:"titleMessageId"`
	IconID         string `json:"iconId"`
	Order          int    `json:"order"`
}

// BuildCatalog 校验并复制模块声明，按稳定顺序计算 SHA-256 revision。
func BuildCatalog(bindings ...Binding) (Catalog, error) {
	return BuildCatalogWithHosts(nil, bindings...)
}

// BuildCatalogWithHosts 与 BuildCatalog 相同，额外接受宿主导航声明（070）。
func BuildCatalogWithHosts(hosts []HostNavigation, bindings ...Binding) (Catalog, error) {
	copyBindings := cloneBindings(bindings)
	if err := validateBindings(copyBindings, hosts, false); err != nil {
		return Catalog{}, err
	}
	sort.Slice(copyBindings, func(i, j int) bool { return copyBindings[i].ModuleID < copyBindings[j].ModuleID })
	canonicalHosts := append([]HostNavigation(nil), hosts...)
	sort.Slice(canonicalHosts, func(i, j int) bool { return canonicalHosts[i].ID < canonicalHosts[j].ID })
	canonical, err := json.Marshal(struct {
		Bindings []Binding
		Hosts    []HostNavigation
	}{Bindings: copyBindings, Hosts: canonicalHosts})
	if err != nil {
		return Catalog{}, fmt.Errorf("marshal webui catalog: %w", err)
	}
	digest := sha256.Sum256(canonical)
	return Catalog{Bindings: copyBindings, HostNavigation: canonicalHosts, Revision: hex.EncodeToString(digest[:])}, nil
}

// BuildApplicationCatalog 根据显式 registration 生成可部署 Catalog。
// disabled 模块和 not-implemented route 在投影阶段被完全移除，不会进入生成器或 runtime manifest。
func BuildApplicationCatalog(registrations []ModuleRegistration, inventory SDKInventory, hosts ...HostNavigation) (Catalog, error) {
	bindings := make([]Binding, 0, len(registrations))
	for index, registration := range registrations {
		if err := validateBindings([]Binding{registration.Binding}, hosts, true); err != nil {
			return Catalog{}, fmt.Errorf("validate webui module registration %d: %w", index, err)
		}
		switch registration.Activation {
		case ActivationEnabled:
		case ActivationDisabled:
			continue
		default:
			return Catalog{}, fmt.Errorf("webui module registration %d has invalid activation %q", index, registration.Activation)
		}
		if err := validateSDKRequirements(registration.Binding, inventory); err != nil {
			return Catalog{}, err
		}
		projected, err := projectImplementedRoutes(registration.Binding)
		if err != nil {
			return Catalog{}, err
		}
		if len(projected.Routes) == 0 {
			continue
		}
		bindings = append(bindings, projected)
	}
	return BuildCatalogWithHosts(hosts, bindings...)
}

// ManifestFor 返回当前主体的安全 manifest；accessLookup 只接收 operation ID。
func (c Catalog) ManifestFor(accessLookup func(string) Access) Manifest {
	return c.ManifestForWithAvailability(accessLookup, func(string) Availability {
		return Availability{State: AvailabilityAvailable}
	})
}

// ManifestForWithAvailability 返回 access 和 availability 门禁后的安全 manifest。
// unavailable route 仍可作为宿主状态呈现，但不会出现在可加载菜单中。
func (c Catalog) ManifestForWithAvailability(accessLookup func(string) Access, availabilityLookup func(string) Availability) Manifest {
	policy, err := BuildNavigationPolicySnapshot(c)
	if err != nil {
		return Manifest{CatalogRevision: c.Revision, Zones: []ManifestZone{}}
	}
	manifest, err := c.ManifestForWithNavigation(policy, accessLookup, availabilityLookup)
	if err != nil {
		return Manifest{CatalogRevision: c.Revision, Zones: []ManifestZone{}}
	}
	return manifest
}

// ManifestForWithNavigation 在策略、访问和可用性三类门禁后生成安全 manifest。
func (c Catalog) ManifestForWithNavigation(policy NavigationPolicySnapshot, accessLookup func(string) Access, availabilityLookup func(string) Availability) (Manifest, error) {
	if policy.catalogRevision != c.Revision || policy.Revision == "" {
		return Manifest{}, fmt.Errorf("webui navigation policy snapshot does not match catalog revision")
	}
	if accessLookup == nil {
		accessLookup = func(string) Access { return AccessAuthenticationRequired }
	}
	if availabilityLookup == nil {
		availabilityLookup = func(string) Availability { return Availability{State: AvailabilityUnavailable} }
	}
	manifest := Manifest{CatalogRevision: c.Revision, NavigationRevision: policy.Revision, Zones: []ManifestZone{}}
	loadableRoutes := map[string]bool{}
	actionAccess := map[string]Access{}
	recordAction := func(operationID string, access Access) {
		access = normalizeAccess(access)
		current, exists := actionAccess[operationID]
		if !exists || accessRank(access) > accessRank(current) {
			actionAccess[operationID] = access
		}
	}
	for _, binding := range c.Bindings {
		for _, route := range binding.Routes {
			if route.DeliveryState != DeliveryImplemented {
				continue
			}
			access := AccessAllowed
			if route.ViewOperationID != "" {
				access = accessLookup(route.ViewOperationID)
			}
			if access != AccessAllowed && access != AccessAuthenticationRequired && access != AccessDenied {
				access = AccessDenied
			}
			availability := normalizeAvailability(route, availabilityLookup(route.ID))
			if access == AccessAllowed && (availability.State == AvailabilityAvailable || availability.State == AvailabilityDegraded) {
				loadableRoutes[route.ID] = true
			}
			manifest.Routes = append(manifest.Routes, ManifestRoute{
				ModuleID: binding.ModuleID, ID: route.ID, Path: route.Path, EntryID: route.EntryID,
				TitleMessageID: route.TitleMessageID, ViewOperationID: route.ViewOperationID,
				Layout: route.Layout, GroupLayoutID: route.GroupLayoutID, DeliveryState: route.DeliveryState, Default: route.Default,
				UnauthenticatedDefault: route.UnauthenticatedDefault, Access: access,
				Availability: availability.State, AvailableCapabilities: availability.Capabilities,
				WorkspaceTab: manifestWorkspaceTabPolicy(route.WorkspaceTab),
			})
		}
		for _, item := range binding.Navigation {
			effective, exists := policy.policies[item.ID]
			if !exists || !effective.Enabled || !loadableRoutes[item.RouteID] {
				continue
			}
			manifest.Menu = append(manifest.Menu, ManifestMenu{
				ModuleID: binding.ModuleID, ID: item.ID, ParentID: effective.ParentID, RouteID: item.RouteID,
				TitleMessageID: item.TitleMessageID, IconID: item.IconID, Order: effective.Order,
			})
		}
		for _, contribution := range bindingZoneContributions(binding) {
			// zone 与 route 不同：denied 不投影；无 OperationID 的贡献只受 availability 门禁。
			if contribution.OperationID == "" {
				if availabilityLookup(contribution.ID).State != AvailabilityAvailable {
					continue
				}
				manifest.Zones = append(manifest.Zones, contribution.toManifest(binding.ModuleID, AccessAllowed))
				continue
			}
			access := normalizeAccess(accessLookup(contribution.OperationID))
			recordAction(contribution.OperationID, access)
			if access == AccessDenied || availabilityLookup(contribution.ID).State != AvailabilityAvailable {
				continue
			}
			manifest.Zones = append(manifest.Zones, contribution.toManifest(binding.ModuleID, access))
		}
		for _, permission := range binding.ActionPermissions {
			recordAction(permission.OperationID, normalizeAccess(accessLookup(permission.OperationID)))
		}
	}
	for _, operationID := range sortedActionOperations(actionAccess) {
		manifest.ActionPermissions = append(manifest.ActionPermissions, ManifestActionPermission{OperationID: operationID, Access: actionAccess[operationID]})
	}
	// 070：宿主导航声明投影（owner=host；落地页可加载才投影，Retain 门禁统一生效）。
	for _, host := range c.HostNavigation {
		if !loadableRoutes[host.RouteID] {
			continue
		}
		manifest.Menu = append(manifest.Menu, ManifestMenu{
			ModuleID: "host", ID: host.ID, ParentID: host.ParentID, RouteID: host.RouteID,
			TitleMessageID: host.TitleMessageID, IconID: host.IconID, Order: host.Order,
		})
	}
	manifest.Menu = retainMenuWithVisibleParents(manifest.Menu)
	sort.Slice(manifest.Routes, func(i, j int) bool { return manifest.Routes[i].ID < manifest.Routes[j].ID })
	sort.Slice(manifest.Menu, func(i, j int) bool {
		if manifest.Menu[i].Order != manifest.Menu[j].Order {
			return manifest.Menu[i].Order < manifest.Menu[j].Order
		}
		return manifest.Menu[i].ID < manifest.Menu[j].ID
	})
	sort.Slice(manifest.Zones, func(i, j int) bool {
		leftRank, rightRank := zoneSortRank(manifest.Zones[i].Zone), zoneSortRank(manifest.Zones[j].Zone)
		if leftRank != rightRank {
			return leftRank < rightRank
		}
		if manifest.Zones[i].Order != manifest.Zones[j].Order {
			return manifest.Zones[i].Order < manifest.Zones[j].Order
		}
		return manifest.Zones[i].ID < manifest.Zones[j].ID
	})
	return manifest, nil
}

// zoneSortRank 按骨架布局顺序（顶栏→侧边栏→页头→底部）稳定排序，
// 避免 zone 标识的字母序与用户视觉顺序不一致。
func zoneSortRank(zone ZoneID) int {
	switch zone {
	case ZoneHeaderActions:
		return 0
	case ZoneSidebarPanels:
		return 1
	case ZonePageHeader:
		return 2
	case ZoneFooterStatus:
		return 3
	}
	return 99
}

// normalizeAccess 把未知 access 收敛为 deny（fail closed），保持判定语义单一。
func normalizeAccess(access Access) Access {
	if access != AccessAllowed && access != AccessAuthenticationRequired && access != AccessDenied {
		return AccessDenied
	}
	return access
}

// manifestWorkspaceTabPolicy 投影非 disabled 的 workspace 资格到运行时视图；
// disabled/零值返回 nil（omitempty 省略，前端仍按 disabled 处理）。
func manifestWorkspaceTabPolicy(policy WorkspaceTabPolicy) *ManifestWorkspaceTabPolicy {
	mode := NormalizedWorkspaceTabMode(policy.Mode)
	if mode == WorkspaceTabDisabled {
		return nil
	}
	return &ManifestWorkspaceTabPolicy{Mode: mode, Restorable: policy.Restorable}
}

// accessRank 定义动作权限的从严排序：denied > authentication-required > allowed。
func accessRank(access Access) int {
	switch normalizeAccess(access) {
	case AccessDenied:
		return 2
	case AccessAuthenticationRequired:
		return 1
	default:
		return 0
	}
}

// sortedActionOperations 返回排序后的动作 operation ID 列表（Manifest 输出稳定）。
func sortedActionOperations(values map[string]Access) []string {
	result := make([]string, 0, len(values))
	for operationID := range values {
		result = append(result, operationID)
	}
	sort.Strings(result)
	return result
}

// zoneContributionRef 是 flatten 后的分区注入点引用，供校验与 Manifest 投影共用。
type zoneContributionRef struct {
	Zone           ZoneID
	ID             string
	EntryID        string
	TitleMessageID string
	IconID         string
	Kind           string
	OperationID    string
	Order          int
}

func (ref zoneContributionRef) toManifest(moduleID string, access Access) ManifestZone {
	return ManifestZone{
		ModuleID: moduleID, Zone: ref.Zone, ID: ref.ID, EntryID: ref.EntryID,
		TitleMessageID: ref.TitleMessageID, IconID: ref.IconID, Kind: ref.Kind,
		Order: ref.Order, Access: access,
	}
}

// ZoneContribution 是分区注入点的统一扁平视图（Go 生成器与 Manifest 投影共用），
// 不暴露模块内部字段；字段与 zoneContributionRef 同步。
type ZoneContribution struct {
	Zone           ZoneID
	ID             string
	EntryID        string
	TitleMessageID string
	IconID         string
	Kind           string
	OperationID    string
	Order          int
}

// ZoneContributions 展开 Bindings 的分区注入点为统一视图；纯声明投影，不做门禁。
func (b Binding) ZoneContributions() []ZoneContribution {
	refs := bindingZoneContributions(b)
	contributions := make([]ZoneContribution, len(refs))
	for index, ref := range refs {
		contributions[index] = ZoneContribution(ref)
	}
	return contributions
}

// bindingZoneContributions 把 Binding 的分区注入点展开为统一引用列表。
// 纯声明投影，不在此处做门禁；门禁在 ManifestForWithNavigation 内按 access/availability 判定。
func bindingZoneContributions(binding Binding) []zoneContributionRef {
	refs := make([]zoneContributionRef, 0,
		len(binding.HeaderActions)+len(binding.SidebarPanels)+len(binding.PageHeaderItems)+len(binding.FooterStatusItems))
	for _, item := range binding.HeaderActions {
		refs = append(refs, zoneContributionRef{Zone: ZoneHeaderActions, ID: item.ID, EntryID: item.EntryID, TitleMessageID: item.TitleMessageID, IconID: item.IconID, OperationID: item.OperationID, Order: item.Order})
	}
	for _, item := range binding.SidebarPanels {
		refs = append(refs, zoneContributionRef{Zone: ZoneSidebarPanels, ID: item.ID, EntryID: item.EntryID, TitleMessageID: item.TitleMessageID, IconID: item.IconID, OperationID: item.OperationID, Order: item.Order})
	}
	for _, item := range binding.PageHeaderItems {
		refs = append(refs, zoneContributionRef{Zone: ZonePageHeader, ID: item.ID, EntryID: item.EntryID, TitleMessageID: item.TitleMessageID, Kind: string(item.Kind), OperationID: item.OperationID, Order: item.Order})
	}
	for _, item := range binding.FooterStatusItems {
		refs = append(refs, zoneContributionRef{Zone: ZoneFooterStatus, ID: item.ID, EntryID: item.EntryID, TitleMessageID: item.TitleMessageID, Kind: string(item.Kind), OperationID: item.OperationID, Order: item.Order})
	}
	return refs
}

const (
	minimumNavigationOrder = -1_000_000
	maximumNavigationOrder = 1_000_000
)

// BuildNavigationPolicySnapshot 把稀疏 override 投影为完整有效快照并计算独立 revision。
func BuildNavigationPolicySnapshot(catalog Catalog, overrides ...NavigationPolicy) (NavigationPolicySnapshot, error) {
	policies := make(map[string]effectiveNavigationPolicy)
	for _, binding := range catalog.Bindings {
		for _, item := range binding.Navigation {
			policies[item.ID] = effectiveNavigationPolicy{NavigationID: item.ID, Enabled: true, ParentID: item.ParentID, Order: item.Order}
		}
	}
	// 070：宿主导航项并入完整策略快照（固定 enabled），供跨 owner 父子引用与菜单投影。
	for _, host := range catalog.HostNavigation {
		policies[host.ID] = effectiveNavigationPolicy{NavigationID: host.ID, Enabled: true, ParentID: host.ParentID, Order: host.Order}
	}
	seen := make(map[string]struct{}, len(overrides))
	for index, override := range overrides {
		if _, exists := seen[override.NavigationID]; exists {
			return NavigationPolicySnapshot{}, fmt.Errorf("webui navigation policy %q is duplicated", override.NavigationID)
		}
		seen[override.NavigationID] = struct{}{}
		effective, exists := policies[override.NavigationID]
		if !exists {
			return NavigationPolicySnapshot{}, fmt.Errorf("webui navigation policy %d references unknown navigation %q", index, override.NavigationID)
		}
		effective.Enabled = override.Enabled
		if override.ParentOverride != nil {
			effective.ParentID = *override.ParentOverride
		}
		if override.OrderOverride != nil {
			effective.Order = *override.OrderOverride
		}
		policies[override.NavigationID] = effective
	}
	canonical := make([]effectiveNavigationPolicy, 0, len(policies))
	for _, policy := range policies {
		if policy.Order < minimumNavigationOrder || policy.Order > maximumNavigationOrder {
			return NavigationPolicySnapshot{}, fmt.Errorf("webui navigation policy %q order %d is outside supported range", policy.NavigationID, policy.Order)
		}
		if policy.ParentID != "" {
			if _, exists := policies[policy.ParentID]; !exists {
				return NavigationPolicySnapshot{}, fmt.Errorf("webui navigation policy %q references unknown parent %q", policy.NavigationID, policy.ParentID)
			}
		}
		canonical = append(canonical, policy)
	}
	sort.Slice(canonical, func(left, right int) bool { return canonical[left].NavigationID < canonical[right].NavigationID })
	if err := validateEffectiveNavigationCycles(canonical); err != nil {
		return NavigationPolicySnapshot{}, err
	}
	payload, err := json.Marshal(canonical)
	if err != nil {
		return NavigationPolicySnapshot{}, fmt.Errorf("marshal webui navigation policy: %w", err)
	}
	digest := sha256.Sum256(payload)
	return NavigationPolicySnapshot{Revision: hex.EncodeToString(digest[:]), catalogRevision: catalog.Revision, policies: policies}, nil
}

func validateEffectiveNavigationCycles(policies []effectiveNavigationPolicy) error {
	parents := make(map[string]string, len(policies))
	for _, policy := range policies {
		parents[policy.NavigationID] = policy.ParentID
	}
	for node := range parents {
		seen := map[string]struct{}{}
		for current := node; current != ""; current = parents[current] {
			if _, exists := seen[current]; exists {
				return fmt.Errorf("webui navigation policy contains a parent cycle at %q", node)
			}
			seen[current] = struct{}{}
		}
	}
	return nil
}

func retainMenuWithVisibleParents(items []ManifestMenu) []ManifestMenu {
	byID := make(map[string]ManifestMenu, len(items))
	for _, item := range items {
		byID[item.ID] = item
	}
	result := make([]ManifestMenu, 0, len(items))
	for _, item := range items {
		visible := true
		for parentID := item.ParentID; parentID != ""; {
			parent, exists := byID[parentID]
			if !exists {
				visible = false
				break
			}
			parentID = parent.ParentID
		}
		if !visible {
			continue
		}
		result = append(result, item)
	}
	return result
}

func validateSDKRequirements(binding Binding, inventory SDKInventory) error {
	seen := map[string]struct{}{}
	for _, requirement := range binding.Requires {
		if strings.TrimSpace(requirement.ID) == "" || requirement.MajorVersion == 0 {
			return fmt.Errorf("webui module %q has incomplete SDK requirement", binding.ModuleID)
		}
		if _, exists := seen[requirement.ID]; exists {
			return fmt.Errorf("webui module %q SDK requirement %q is duplicated", binding.ModuleID, requirement.ID)
		}
		seen[requirement.ID] = struct{}{}
		provided, exists := inventory[requirement.ID]
		if !exists {
			return fmt.Errorf("webui module %q requires unknown SDK capability %q", binding.ModuleID, requirement.ID)
		}
		if provided != requirement.MajorVersion {
			return fmt.Errorf("webui module %q requires SDK capability %q major %d, provided %d", binding.ModuleID, requirement.ID, requirement.MajorVersion, provided)
		}
	}
	return nil
}

func projectImplementedRoutes(binding Binding) (Binding, error) {
	projected := cloneBindings([]Binding{binding})[0]
	implementedEntries := map[string]struct{}{}
	implementedRoutes := map[string]struct{}{}
	projected.Routes = nil
	projected.Navigation = nil
	for _, route := range binding.Routes {
		if route.DeliveryState == DeliveryNotImplemented {
			if route.Default || route.UnauthenticatedDefault {
				return Binding{}, fmt.Errorf("webui route %q marked not-implemented cannot be a default route", route.ID)
			}
			continue
		}
		projected.Routes = append(projected.Routes, route)
		implementedRoutes[route.ID] = struct{}{}
		implementedEntries[route.EntryID] = struct{}{}
	}
	// zone 引用的 entry 是与路由页面同轨的可加载组件：只要绑定未被
	// BuildApplicationCatalog 整体丢弃（无任何 implemented route），这些 entry 必须保留。
	for _, contribution := range bindingZoneContributions(binding) {
		implementedEntries[contribution.EntryID] = struct{}{}
	}
	// 073：分组布局 entry（Route.GroupLayoutID）同 zone entry：批次保留。
	for _, route := range projected.Routes {
		if route.GroupLayoutID != "" {
			implementedEntries[route.GroupLayoutID] = struct{}{}
		}
	}
	projected.Entries = nil
	for _, entry := range binding.Entries {
		if _, ok := implementedEntries[entry.ID]; ok {
			projected.Entries = append(projected.Entries, entry)
		}
	}
	for _, item := range binding.Navigation {
		if _, ok := implementedRoutes[item.RouteID]; ok {
			projected.Navigation = append(projected.Navigation, item)
		}
	}
	projected.HeaderActions = retainZonesByEntry(projected.HeaderActions, implementedEntries, func(item HeaderAction) string { return item.EntryID })
	projected.SidebarPanels = retainZonesByEntry(projected.SidebarPanels, implementedEntries, func(item SidebarPanel) string { return item.EntryID })
	projected.PageHeaderItems = retainZonesByEntry(projected.PageHeaderItems, implementedEntries, func(item PageHeaderItem) string { return item.EntryID })
	projected.FooterStatusItems = retainZonesByEntry(projected.FooterStatusItems, implementedEntries, func(item FooterStatusItem) string { return item.EntryID })
	return projected, nil
}

// retainZonesByEntry 只保留引用已实现 entry 的分区注入点，与 route/navigation 的
// implemented 投影保持同轨；items 无元素时返回 nil，不产生空 slice 噪声。
func retainZonesByEntry[T any](items []T, implementedEntries map[string]struct{}, entryID func(T) string) []T {
	if len(items) == 0 {
		return nil
	}
	kept := items[:0]
	for _, item := range items {
		if _, ok := implementedEntries[entryID(item)]; ok {
			kept = append(kept, item)
		}
	}
	return kept
}

func normalizeAvailability(route Route, availability Availability) Availability {
	capabilities := uniqueStrings(availability.Capabilities)
	switch availability.State {
	case AvailabilityAvailable:
		return Availability{State: AvailabilityAvailable, Capabilities: capabilities}
	case AvailabilityDegraded:
		allowed := intersectStrings(route.DegradedCapabilities, capabilities)
		if len(allowed) == 0 {
			return Availability{State: AvailabilityUnavailable}
		}
		return Availability{State: AvailabilityDegraded, Capabilities: allowed}
	default:
		return Availability{State: AvailabilityUnavailable}
	}
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func intersectStrings(left, right []string) []string {
	rightSet := map[string]struct{}{}
	for _, value := range right {
		rightSet[value] = struct{}{}
	}
	result := make([]string, 0)
	for _, value := range uniqueStrings(left) {
		if _, ok := rightSet[value]; ok {
			result = append(result, value)
		}
	}
	return result
}

// ValidateSourcePathOwnership 校验构建期 SourcePath 属于声明模块的 WebUI 目录，且没有经过符号链接逃逸。
func (c Catalog) ValidateSourcePathOwnership(layout projectlayout.Layout, repositoryRoot string) error {
	root, err := filepath.Abs(repositoryRoot)
	if err != nil {
		return fmt.Errorf("resolve webui repository root: %w", err)
	}
	for _, binding := range c.Bindings {
		ownerRoot, err := layout.ModuleWebRoot(root, binding.ModuleID)
		if err != nil {
			return fmt.Errorf("resolve webui module %q owner: %w", binding.ModuleID, err)
		}
		for _, sourcePath := range bindingSourcePaths(binding) {
			if err := validateOwnedSourcePath(ownerRoot, sourcePath); err != nil {
				return fmt.Errorf("webui module %q source path %q: %w", binding.ModuleID, sourcePath, err)
			}
		}
	}
	return nil
}

func bindingSourcePaths(binding Binding) []string {
	paths := make([]string, 0, len(binding.Entries)+len(binding.Locales)+1)
	for _, entry := range binding.Entries {
		paths = append(paths, entry.SourcePath)
	}
	for _, locale := range binding.Locales {
		paths = append(paths, locale.SourcePath)
	}
	if strings.TrimSpace(binding.MockSource) != "" {
		paths = append(paths, binding.MockSource)
	}
	return paths
}

func validateOwnedSourcePath(ownerRoot, sourcePath string) error {
	if strings.TrimSpace(sourcePath) == "" || filepath.IsAbs(sourcePath) || strings.Contains(sourcePath, "\\") {
		return fmt.Errorf("path must be module-WebUI-relative and use forward slashes")
	}
	absolute := filepath.Clean(filepath.Join(ownerRoot, filepath.FromSlash(sourcePath)))
	relative, err := filepath.Rel(ownerRoot, absolute)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) || filepath.IsAbs(relative) {
		return fmt.Errorf("path escapes module WebUI owner directory")
	}
	resolvedRoot, err := filepath.EvalSymlinks(ownerRoot)
	if err != nil {
		return fmt.Errorf("resolve module WebUI owner directory: %w", err)
	}
	resolvedPath, err := filepath.EvalSymlinks(absolute)
	if err != nil {
		return fmt.Errorf("resolve source path: %w", err)
	}
	resolvedRelative, err := filepath.Rel(resolvedRoot, resolvedPath)
	if err != nil || resolvedRelative == ".." || strings.HasPrefix(resolvedRelative, ".."+string(filepath.Separator)) || filepath.IsAbs(resolvedRelative) {
		return fmt.Errorf("path resolves outside module WebUI owner directory")
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return fmt.Errorf("stat source path: %w", err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("source path is not a regular file")
	}
	return nil
}

func validateBindings(bindings []Binding, hosts []HostNavigation, deferParentCheck bool) error {
	modules := map[string]struct{}{}
	entries := map[string]string{}
	routes := map[string]RouteOwner{}
	paths := map[string]string{}
	navigation := map[string]string{}
	zones := map[string]string{}
	locales := map[string]string{}
	defaultRouteID := ""
	unauthenticatedDefaultRouteID := ""
	for _, binding := range bindings {
		if strings.TrimSpace(binding.ModuleID) == "" {
			return fmt.Errorf("webui module id is required")
		}
		for _, character := range binding.ModuleID {
			if (character < 'a' || character > 'z') && (character < '0' || character > '9') && character != '-' && character != '_' {
				return fmt.Errorf("webui module id %q contains unsupported character", binding.ModuleID)
			}
		}
		if _, exists := modules[binding.ModuleID]; exists {
			return fmt.Errorf("webui module %q is duplicated", binding.ModuleID)
		}
		modules[binding.ModuleID] = struct{}{}
		if len(binding.Entries) > 0 && len(binding.Locales) == 0 {
			return fmt.Errorf("webui module %q must declare locale binding for its entries", binding.ModuleID)
		}
		if len(binding.Entries) > 0 && strings.TrimSpace(binding.MockSource) == "" {
			return fmt.Errorf("webui module %q must declare mock source for its entries", binding.ModuleID)
		}
		if binding.MockSource != "" && !validSourcePath(binding.MockSource, ".ts") {
			return fmt.Errorf("webui module %q mock source has invalid path", binding.ModuleID)
		}
		for _, entry := range binding.Entries {
			if entry.ID == "" || strings.TrimSpace(entry.SourcePath) == "" {
				return fmt.Errorf("webui module %q entry is incomplete", binding.ModuleID)
			}
			if !validSourcePath(entry.SourcePath, ".tsx", ".ts") {
				return fmt.Errorf("webui entry %q has invalid source path", entry.ID)
			}
			if _, exists := entries[entry.ID]; exists {
				return fmt.Errorf("webui entry %q is duplicated", entry.ID)
			}
			entries[entry.ID] = binding.ModuleID
		}
		for _, route := range binding.Routes {
			if route.ID == "" || route.EntryID == "" || route.TitleMessageID == "" {
				return fmt.Errorf("webui module %q route is incomplete", binding.ModuleID)
			}
			if !validPath(route.Path) {
				return fmt.Errorf("webui route %q has invalid path", route.ID)
			}
			if _, exists := routes[route.ID]; exists {
				return fmt.Errorf("webui route %q is duplicated", route.ID)
			}
			if owner, exists := paths[route.Path]; exists {
				return fmt.Errorf("webui route path %q is shared by %s and %s", route.Path, owner, binding.ModuleID)
			}
			if owner, exists := entries[route.EntryID]; !exists || owner != binding.ModuleID {
				return fmt.Errorf("webui route %q references unknown entry %q", route.ID, route.EntryID)
			}
			if route.GroupLayoutID != "" {
				if owner, exists := entries[route.GroupLayoutID]; !exists || owner != binding.ModuleID {
					return fmt.Errorf("webui route %q references unknown group layout entry %q", route.ID, route.GroupLayoutID)
				}
			}
			if route.Layout != RouteLayoutApp && route.Layout != RouteLayoutBlank {
				return fmt.Errorf("webui route %q has unsupported layout %q", route.ID, route.Layout)
			}
			if route.DeliveryState != DeliveryImplemented && route.DeliveryState != DeliveryNotImplemented {
				return fmt.Errorf("webui route %q has unsupported delivery state %q", route.ID, route.DeliveryState)
			}
			if err := validateRouteWorkspaceTabPolicy(route); err != nil {
				return err
			}
			if route.DeliveryState == DeliveryNotImplemented && (route.Default || route.UnauthenticatedDefault) {
				return fmt.Errorf("webui route %q marked not-implemented cannot be a default route", route.ID)
			}
			if route.Default {
				if defaultRouteID != "" {
					return fmt.Errorf("webui routes %q and %q are both default", defaultRouteID, route.ID)
				}
				defaultRouteID = route.ID
			}
			if route.UnauthenticatedDefault {
				if route.Layout != RouteLayoutBlank {
					return fmt.Errorf("webui unauthenticated default route %q must use blank layout", route.ID)
				}
				if route.ViewOperationID != "" {
					return fmt.Errorf("webui unauthenticated default route %q must be public", route.ID)
				}
				if unauthenticatedDefaultRouteID != "" {
					return fmt.Errorf("webui routes %q and %q are both unauthenticated defaults", unauthenticatedDefaultRouteID, route.ID)
				}
				unauthenticatedDefaultRouteID = route.ID
			}
			routes[route.ID] = RouteOwner{ModuleID: binding.ModuleID, Default: route.Default}
			paths[route.Path] = binding.ModuleID
		}
		for _, item := range binding.Navigation {
			if item.ID == "" || item.RouteID == "" || item.TitleMessageID == "" || item.IconID == "" || !ValidIconID(item.IconID) {
				return fmt.Errorf("webui module %q navigation is incomplete or uses an icon outside the catalog", binding.ModuleID)
			}
			if _, exists := navigation[item.ID]; exists {
				return fmt.Errorf("webui navigation %q is duplicated", item.ID)
			}
			owner, exists := routes[item.RouteID]
			if !exists || owner.ModuleID != binding.ModuleID {
				return fmt.Errorf("webui navigation %q references unknown route %q", item.ID, item.RouteID)
			}
			navigation[item.ID] = binding.ModuleID
		}
		for _, contribution := range bindingZoneContributions(binding) {
			if err := validateZoneContribution(binding, contribution, entries, zones); err != nil {
				return err
			}
		}
		if refs := bindingZoneContributions(binding); len(refs) > maximumZoneContributionsPerModule {
			return fmt.Errorf("webui module %q declares %d zone contributions, exceeding the limit %d", binding.ModuleID, len(refs), maximumZoneContributionsPerModule)
		}
		seenActions := map[string]struct{}{}
		for _, permission := range binding.ActionPermissions {
			if strings.TrimSpace(permission.OperationID) == "" {
				return fmt.Errorf("webui module %q declares an empty action permission", binding.ModuleID)
			}
			if _, exists := seenActions[permission.OperationID]; exists {
				return fmt.Errorf("webui module %q action permission %q is duplicated", binding.ModuleID, permission.OperationID)
			}
			seenActions[permission.OperationID] = struct{}{}
		}
		for _, locale := range binding.Locales {
			if locale.Namespace == "" || strings.TrimSpace(locale.SourcePath) == "" {
				return fmt.Errorf("webui module %q locale is incomplete", binding.ModuleID)
			}
			if _, err := language.Parse(locale.Language); err != nil {
				return fmt.Errorf("webui locale %q is invalid: %w", locale.Language, err)
			}
			if !validSourcePath(locale.SourcePath, ".json") {
				return fmt.Errorf("webui locale %q/%q has invalid source path", locale.Language, locale.Namespace)
			}
			localeKey := locale.Language + "\x00" + locale.Namespace
			if owner, exists := locales[localeKey]; exists {
				return fmt.Errorf("webui locale %q/%q is declared by both %s and %s", locale.Language, locale.Namespace, owner, binding.ModuleID)
			}
			locales[localeKey] = binding.ModuleID
		}
		seenRequirements := map[string]struct{}{}
		for _, requirement := range binding.Requires {
			if strings.TrimSpace(requirement.ID) == "" || requirement.MajorVersion == 0 {
				return fmt.Errorf("webui module %q has incomplete SDK requirement", binding.ModuleID)
			}
			if _, exists := seenRequirements[requirement.ID]; exists {
				return fmt.Errorf("webui module %q SDK requirement %q is duplicated", binding.ModuleID, requirement.ID)
			}
			seenRequirements[requirement.ID] = struct{}{}
		}
	}
	// 070：宿主声明的导航项并入导航集合（owner=host）；RouteID 可引用任意已存在 route。
	// 该校验只在全量阶段执行（BuildApplicationCatalog 的逐模块预检不携带 hosts）。
	if !deferParentCheck {
		for _, host := range hosts {
			if host.ID == "" || host.RouteID == "" || host.TitleMessageID == "" || host.IconID == "" || !ValidIconID(host.IconID) {
				return fmt.Errorf("webui host navigation %q is incomplete or uses an icon outside the catalog", host.ID)
			}
			if _, exists := navigation[host.ID]; exists {
				return fmt.Errorf("webui host navigation %q is duplicated", host.ID)
			}
			if _, exists := routes[host.RouteID]; !exists {
				return fmt.Errorf("webui host navigation %q references unknown route %q", host.ID, host.RouteID)
			}
			navigation[host.ID] = "host"
		}
	}
	// 070：ParentID 可引用任意已声明的 navigation（跨 owner，双向归属）；存在性在全部
	// 模块声明收集完成后统一校验，避免声明顺序影响；环由 validateNavigationCycles 拒绝。
	// deferParentCheck 用于 BuildApplicationCatalog 的逐模块预检（跨模块父引用由最终
	// BuildCatalogWithHosts 全量校验覆盖）。
	if !deferParentCheck {
		for _, binding := range bindings {
			for _, item := range binding.Navigation {
				if item.ParentID != "" {
					if _, exists := navigation[item.ParentID]; !exists {
						return fmt.Errorf("webui navigation %q references unknown parent %q", item.ID, item.ParentID)
					}
				}
			}
		}
		for _, host := range hosts {
			if host.ParentID != "" {
				if _, exists := navigation[host.ParentID]; !exists {
					return fmt.Errorf("webui host navigation %q references unknown parent %q", host.ID, host.ParentID)
				}
			}
		}
	}
	return validateNavigationCycles(bindings, hosts)
}

// ValidateOperationReferences rejects operation IDs outside the application inventory.
func (c Catalog) ValidateOperationReferences(operations map[string]struct{}) error {
	for _, binding := range c.Bindings {
		for _, route := range binding.Routes {
			if route.ViewOperationID != "" {
				if _, ok := operations[route.ViewOperationID]; !ok {
					return fmt.Errorf("webui route %q references unknown operation %q", route.ID, route.ViewOperationID)
				}
			}
		}
		for _, contribution := range bindingZoneContributions(binding) {
			if contribution.OperationID != "" {
				if _, ok := operations[contribution.OperationID]; !ok {
					return fmt.Errorf("webui zone %q references unknown operation %q", contribution.ID, contribution.OperationID)
				}
			}
		}
		for _, permission := range binding.ActionPermissions {
			if _, ok := operations[permission.OperationID]; !ok {
				return fmt.Errorf("webui action permission references unknown operation %q", permission.OperationID)
			}
		}
	}
	return nil
}

// maximumZoneContributionsPerModule 限制单模块分区注入点总数，防止声明集合失控。
const maximumZoneContributionsPerModule = 48

// validateZoneContribution 校验单个分区注入点引用：ID 唯一、Entry 属于本模块、
// 图标属于受控目录（有图标字段的 zone）、Kind 合法、Order 与数量在界内。
func validateZoneContribution(binding Binding, contribution zoneContributionRef, entries map[string]string, zones map[string]string) error {
	if strings.TrimSpace(contribution.ID) == "" || strings.TrimSpace(contribution.TitleMessageID) == "" {
		return fmt.Errorf("webui module %q zone contribution is incomplete", binding.ModuleID)
	}
	if _, exists := zones[contribution.ID]; exists {
		return fmt.Errorf("webui zone %q is duplicated", contribution.ID)
	}
	if owner, exists := entries[contribution.EntryID]; !exists || owner != binding.ModuleID {
		return fmt.Errorf("webui zone %q references unknown entry %q", contribution.ID, contribution.EntryID)
	}
	if contribution.Order < minimumNavigationOrder || contribution.Order > maximumNavigationOrder {
		return fmt.Errorf("webui zone %q order %d is outside supported range", contribution.ID, contribution.Order)
	}
	if contribution.IconID != "" && !ValidIconID(contribution.IconID) {
		return fmt.Errorf("webui zone %q uses icon %q outside the catalog", contribution.ID, contribution.IconID)
	}
	switch contribution.Zone {
	case ZonePageHeader:
		if contribution.Kind != string(PageHeaderItemKindAction) && contribution.Kind != string(PageHeaderItemKindStatus) {
			return fmt.Errorf("webui zone %q has unsupported page header kind %q", contribution.ID, contribution.Kind)
		}
	case ZoneFooterStatus:
		if contribution.Kind != string(FooterStatusKindStatus) && contribution.Kind != string(FooterStatusKindMeta) {
			return fmt.Errorf("webui zone %q has unsupported footer status kind %q", contribution.ID, contribution.Kind)
		}
	case ZoneHeaderActions, ZoneSidebarPanels:
		// 有图标字段的 zone 必须声明图标（页面呈现需要一致的图标语义）。
		if contribution.IconID == "" {
			return fmt.Errorf("webui zone %q must declare an icon for zone %s", contribution.ID, contribution.Zone)
		}
	default:
		return fmt.Errorf("webui zone %q has unsupported zone id %q", contribution.ID, contribution.Zone)
	}
	zones[contribution.ID] = binding.ModuleID
	return nil
}

type RouteOwner struct {
	ModuleID string
	Default  bool
}

func validateNavigationCycles(bindings []Binding, hosts []HostNavigation) error {
	parents := map[string]string{}
	for _, binding := range bindings {
		for _, item := range binding.Navigation {
			if item.ParentID != "" {
				parents[item.ID] = item.ParentID
			}
		}
	}
	for _, host := range hosts {
		if host.ParentID != "" {
			parents[host.ID] = host.ParentID
		}
	}
	for node := range parents {
		seen := map[string]struct{}{}
		current := node
		for current != "" {
			if _, ok := seen[current]; ok {
				return fmt.Errorf("webui navigation contains a parent cycle at %q", node)
			}
			seen[current] = struct{}{}
			current = parents[current]
		}
	}
	return nil
}

func validPath(path string) bool {
	parsed, err := url.Parse(path)
	return err == nil && strings.HasPrefix(path, "/") && parsed.Host == "" && parsed.RawQuery == "" && parsed.Fragment == "" && path != "/"
}

// validateRouteWorkspaceTabPolicy 校验 route 的 workspace 资格声明：未知 mode 直接
// 拒绝（fail fast）；blank 布局、default/unauthenticated default 路由不得 opt-in
// （workspace 是 app 布局内的独立工作上下文，非入口/认证页语义）。零值 mode 允许，
// 按 disabled 处理，不在校验阶段强制要求显式声明。
func validateRouteWorkspaceTabPolicy(route Route) error {
	mode := NormalizedWorkspaceTabMode(route.WorkspaceTab.Mode)
	if route.WorkspaceTab.Mode != "" && route.WorkspaceTab.Mode != WorkspaceTabDisabled && mode == WorkspaceTabDisabled {
		return fmt.Errorf("webui route %q has unsupported workspace tab mode %q", route.ID, route.WorkspaceTab.Mode)
	}
	if mode == WorkspaceTabDisabled {
		return nil
	}
	if route.Layout != RouteLayoutApp {
		return fmt.Errorf("webui route %q workspace tab requires app layout", route.ID)
	}
	if route.Default || route.UnauthenticatedDefault {
		return fmt.Errorf("webui route %q cannot opt into workspace tab as a default or unauthenticated default route", route.ID)
	}
	return nil
}

func validSourcePath(sourcePath string, extensions ...string) bool {
	cleaned := filepath.Clean(sourcePath)
	if filepath.IsAbs(cleaned) || cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return false
	}
	extension := strings.ToLower(filepath.Ext(cleaned))
	for _, allowed := range extensions {
		if extension == allowed {
			return true
		}
	}
	return false
}

func cloneBindings(values []Binding) []Binding {
	result := make([]Binding, len(values))
	copy(result, values)
	for i := range result {
		result[i].Entries = append([]Entry(nil), values[i].Entries...)
		result[i].Routes = append([]Route(nil), values[i].Routes...)
		result[i].Navigation = append([]Navigation(nil), values[i].Navigation...)
		result[i].HeaderActions = append([]HeaderAction(nil), values[i].HeaderActions...)
		result[i].SidebarPanels = append([]SidebarPanel(nil), values[i].SidebarPanels...)
		result[i].PageHeaderItems = append([]PageHeaderItem(nil), values[i].PageHeaderItems...)
		result[i].FooterStatusItems = append([]FooterStatusItem(nil), values[i].FooterStatusItems...)
		result[i].ActionPermissions = append([]ActionPermission(nil), values[i].ActionPermissions...)
		result[i].Locales = append([]Locale(nil), values[i].Locales...)
		result[i].Requires = append([]SDKRequirement(nil), values[i].Requires...)
		for routeIndex := range result[i].Routes {
			result[i].Routes[routeIndex].DegradedCapabilities = append([]string(nil), values[i].Routes[routeIndex].DegradedCapabilities...)
		}
	}
	return result
}
