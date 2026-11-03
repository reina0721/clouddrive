/**
 * Product Surface —— 偏好领域模型（单一事实源）。
 *
 * 归属：Product Surface 公共 subpath `@clouddrive/surface/preferences-model`。
 * 服务对象：Host Shell（运行时读写/迁移）、`settings` 插件（八分类设置页）、以及未来
 * 其它消费页面——各方读同一份 typed 模型、默认值与边界校验，禁止各插件自建第二套。
 *
 * 边界：
 * - 本文件是纯 TS 模型：无 React、无 zustand、无浏览器 API、不依赖 packages/schemas；
 * - 持久化 key 与 store 机制（state-foundation）不属于本文件（Host 装配层负责）；
 * - 八分类的“分类页面文案/搜索目录/同义词”属 settings 插件（i18n/目录在插件内），
 *   本文件只提供字段语义与默认值；
 * - 校验是“有限联合 + 边界”守卫，不建通用动态 Schema/表单引擎（目标已确认）。
 *
 * 版本语义：`PREFERENCES_VERSION = 1` 对应 `clouddrive.shell` persist version。
 * 旧用户 v0 记录（theme/locale/sidebarCollapsed）经 `migrateShellV0Preferences`
 * 保真映射进本模型（显式值不套新默认）；无记录（首次）用 `defaultPreferences`。
 */

/* ------------------------------------------------------------------ */
/* 版本与分类                                                           */
/* ------------------------------------------------------------------ */

/**
 * 当前偏好模型版本（clouddrive.shell persist version）。
 *
 * v1 → v2：新增 `security` 分类（水印/空闲锁屏）、`appearance.colorWeak|grayscale`、
 * `navigation.layoutMode`。v1 记录由 `validatePreferences` 按字段默认值补全后直接可用，
 * 因此不需要破坏性迁移；版本号用于记录语义变化与跨窗口快照判定。
 */
export const PREFERENCES_VERSION = 2;

/** 九分类（与设置页信息架构一一对应；key 顺序即分类导航顺序）。 */
export const PREFERENCE_CATEGORIES = [
  'appearance',
  'navigation',
  'dataDisplay',
  'actionPreferences',
  'localeRegion',
  'notifications',
  'accessibility',
  'security',
  'shortcuts',
] as const;
export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number];

/* ------------------------------------------------------------------ */
/* 外观 appearance                                                      */
/* ------------------------------------------------------------------ */

export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** 受控强调色（与 packages/design-system schema accents.order 对齐）。 */
export const ACCENT_PRESETS = ['purple', 'blue', 'green', 'orange'] as const;
export type AccentPreset = (typeof ACCENT_PRESETS)[number];

export const DENSITY_LEVELS = ['compact', 'standard', 'comfortable'] as const;
export type DensityLevel = (typeof DENSITY_LEVELS)[number];

export const FONT_SCALES = ['small', 'standard', 'large'] as const;
export type FontScale = (typeof FONT_SCALES)[number];

export const CONTENT_WIDTHS = ['auto', 'standard', 'wide'] as const;
export type ContentWidth = (typeof CONTENT_WIDTHS)[number];

/**
 * 页面切换动画（Vben 对标，117）。
 *
 * - `default`：保留项目现行页面切换（方向进入，仅标题轻量过渡）；
 * - `fade` / `fade-slide` / `fade-up` / `fade-down`：Vben 运行期支持的页面切换名；
 * - `none`：关闭页面切换动画（等价 Vben 的「页面切换动画」开关关闭），不影响其它动效。
 *
 * 与 `motion` 的关系：`motion=reduced` 会关闭所有动画；`none` 只关闭页面切换。
 */
export const PAGE_TRANSITIONS = [
  'default',
  'fade',
  'fade-slide',
  'fade-up',
  'fade-down',
  'none',
] as const;
export type PageTransition = (typeof PAGE_TRANSITIONS)[number];

/** 动效偏好：system = 跟随 prefers-reduced-motion；reduced = 明确减少。 */
export const MOTION_PREFERENCES = ['system', 'standard', 'reduced'] as const;
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];

/** 对比度偏好：standard = 常规；high = 高对比。 */
export const CONTRAST_PREFERENCES = ['system', 'standard', 'high'] as const;
export type ContrastPreference = (typeof CONTRAST_PREFERENCES)[number];

/** 外观分类模型。侧栏折叠/记忆的字段语义归属 navigation.sidebarBehavior（见下）。 */
export type AppearancePreferences = Readonly<{
  themeMode: ThemeMode;
  accent: AccentPreset;
  density: DensityLevel;
  fontScale: FontScale;
  contentWidth: ContentWidth;
  motion: MotionPreference;
  contrast: ContrastPreference;
  /** 色弱辅助：降低色相对比、保留明度与结构（纯视觉辅助，不改变数据）。 */
  colorWeak: boolean;
  /** 灰阶辅助：整体去色，配合增强对比用于长时间阅读或低刺激场景。 */
  grayscale: boolean;
  /** 页面切换动画；`default` = 项目现行方向进入（旧记录缺省即此值）。 */
  pageTransition: PageTransition;
}>;

export const defaultAppearance: AppearancePreferences = {
  themeMode: 'system',
  accent: 'purple',
  density: 'standard',
  fontScale: 'standard',
  contentWidth: 'auto',
  motion: 'system',
  contrast: 'system',
  colorWeak: false,
  grayscale: false,
  pageTransition: 'default',
};

/* ------------------------------------------------------------------ */
/* 导航 navigation                                                      */
/* ------------------------------------------------------------------ */

/** 首页目标：稳定 routeId 或 '/'；默认当前首页（根）。 */
export type HomeTarget = string;

export const TAB_CLOSE_BEHAVIORS = ['recent', 'right', 'left'] as const;
export type TabCloseBehavior = (typeof TAB_CLOSE_BEHAVIORS)[number];

export const NEW_PAGE_OPEN_MODES = ['current', 'browser-tab', 'page-tab'] as const;
export type NewPageOpenMode = (typeof NEW_PAGE_OPEN_MODES)[number];

/** 侧栏折叠状态偏好：expanded/collapsed = 固定；remember = 记住上次使用状态。 */
export const SIDEBAR_BEHAVIORS = ['expanded', 'collapsed', 'remember'] as const;
export type SidebarBehavior = (typeof SIDEBAR_BEHAVIORS)[number];

/**
 * Shell 布局模式：
 * - vertical：左侧导航 + 顶部工具栏（默认）；
 * - horizontal：顶部一级导航，无侧栏；
 * - mixed：顶部一级分组，侧栏显示当前分组的下级菜单。
 * 三种模式共用同一导航模型与页面栈，不改变路由与权限语义。
 */
export const LAYOUT_MODES = ['vertical', 'horizontal', 'mixed'] as const;
export type LayoutMode = (typeof LAYOUT_MODES)[number];

export type NavigationPreferences = Readonly<{
  /** 登录后默认首页（稳定 routeId；'/' 为当前首页）。 */
  homeTarget: HomeTarget;
  /** Shell 布局模式（vertical/horizontal/mixed）。 */
  layoutMode: LayoutMode;
  /** 页面跳转后自动滚动到顶部。 */
  scrollToTopOnNavigate: boolean;
  /** 面包屑显示。 */
  breadcrumbs: boolean;
  /** 顶部页面标签开/关。 */
  pageTabsEnabled: boolean;
  /** 标签与 Header 一起固定；缺失的旧记录默认补全为 true。 */
  pageTabsPinned: boolean;
  /** 恢复上次打开的标签（跨启动）。 */
  restoreLastTabs: boolean;
  /** 关闭当前标签后跳转策略。 */
  tabCloseBehavior: TabCloseBehavior;
  /** 新页面打开方式（只作用于声明允许的入口）。 */
  newPageOpenMode: NewPageOpenMode;
  /** 侧栏折叠状态：展开/紧凑/记住上次使用状态。 */
  sidebarBehavior: SidebarBehavior;
  /** 跨导航记忆侧栏展开的菜单（active 祖先恒可见 + 展开数量约束不受影响）。 */
  menuMemory: boolean;
  /** 记录最近访问页面。 */
  rememberRecents: boolean;
  /** 首页显示最近访问。 */
  showRecents: boolean;
  /** 进入根入口时自动恢复未完成工作。 */
  /** Legacy persisted value retained for compatibility; automatic draft navigation is retired. */
  autoRestoreWorkspace: boolean;
}>;

export const defaultNavigation: NavigationPreferences = {
  homeTarget: '/',
  layoutMode: 'vertical',
  scrollToTopOnNavigate: true,
  breadcrumbs: true,
  pageTabsEnabled: false,
  pageTabsPinned: true,
  restoreLastTabs: false,
  tabCloseBehavior: 'recent',
  newPageOpenMode: 'current',
  sidebarBehavior: 'remember',
  menuMemory: false,
  rememberRecents: true,
  showRecents: true,
  autoRestoreWorkspace: false,
};

/* ------------------------------------------------------------------ */
/* 数据展示 dataDisplay                                                 */
/* ------------------------------------------------------------------ */

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const LONG_TEXT_MODES = ['truncate', 'wrap'] as const;
export type LongTextMode = (typeof LONG_TEXT_MODES)[number];

export type DataDisplayPreferences = Readonly<{
  /** 全局默认每页数量。 */
  pageSize: PageSize;
  /** 表格密度（与外观整体密度独立；DataTable 消费）。 */
  tableDensity: DensityLevel;
  /** 行分隔/边界显示。 */
  rowSeparators: boolean;
  /** 固定表头。 */
  stickyHeader: boolean;
  /** 记住列布局（宽/显隐/序）。 */
  rememberColumnLayout: boolean;
  /** 记住排序条件。 */
  rememberSort: boolean;
  /** 记住筛选条件。 */
  rememberFilters: boolean;
  /** 记住分页位置。 */
  rememberPagination: boolean;
  /** 空数据时显示辅助说明。 */
  emptyStateHint: boolean;
  /** 长文本默认处理。 */
  longText: LongTextMode;
}>;

export const defaultDataDisplay: DataDisplayPreferences = {
  pageSize: 20,
  tableDensity: 'standard',
  rowSeparators: true,
  stickyHeader: true,
  rememberColumnLayout: true,
  rememberSort: false,
  rememberFilters: false,
  rememberPagination: false,
  emptyStateHint: true,
  longText: 'truncate',
};

/* ------------------------------------------------------------------ */
/* 操作偏好 actionPreferences                                          */
/* ------------------------------------------------------------------ */

export const EDIT_SUCCESS_DESTINATIONS = ['stay', 'list', 'detail'] as const;
export type EditSuccessDestination = (typeof EDIT_SUCCESS_DESTINATIONS)[number];

export const CREATE_SUCCESS_DESTINATIONS = ['list', 'continue', 'detail'] as const;
export type CreateSuccessDestination = (typeof CREATE_SUCCESS_DESTINATIONS)[number];

export const REFRESH_MODES = ['off', 'on-enter', 'periodic'] as const;
export type RefreshMode = (typeof REFRESH_MODES)[number];

export const SEARCH_TRIGGERS = ['auto', 'enter'] as const;
export type SearchTrigger = (typeof SEARCH_TRIGGERS)[number];

export const DETAIL_MODES = ['compact', 'full'] as const;
export type DetailMode = (typeof DETAIL_MODES)[number];

export type ActionPreferences = Readonly<{
  /** 编辑成功后去向（仅在真实成功回调后执行；无详情目标页说明不适用）。 */
  editSuccessDestination: EditSuccessDestination;
  /** 创建成功后去向。 */
  createSuccessDestination: CreateSuccessDestination;
  /** 本地草稿自动保存（只写页面显式允许字段；不等于业务提交成功）。 */
  autosaveDrafts: boolean;
  /** 离开未保存表单时提醒（与导航分类共享状态）。 */
  confirmLeave: boolean;
  /** 表单重置前确认。 */
  confirmReset: boolean;
  /** 删除前二次确认。 */
  confirmDelete: boolean;
  /** 批量操作前确认。 */
  confirmBulk: boolean;
  /** 自动聚焦第一个可编辑字段。 */
  focusFirstField: boolean;
  /** 校验错误后定位首个错误字段。 */
  focusFirstError: boolean;
  /** 复制内容后显示反馈。 */
  copyFeedback: boolean;
  /** 自动刷新数据：关闭 / 仅重新进入 / 定期（统一 60s 预设）。 */
  refreshMode: RefreshMode;
  /** 自动展开详情附加信息。 */
  expandDetailInfo: boolean;
  /** 默认详情展示模式（仅项目已有模式）。 */
  detailMode: DetailMode;
  /** 搜索时机：输入后自动 / Enter 后。 */
  searchTrigger: SearchTrigger;
  /** 保留最近搜索（记录）。 */
  rememberSearchHistory: boolean;
  /** 显示搜索历史。 */
  showSearchHistory: boolean;
  /** 显示搜索建议。 */
  showSearchSuggestions: boolean;
  /** 保留各页面最近一次搜索条件。 */
  keepLastSearchPerPage: boolean;
}>;

export const defaultActionPreferences: ActionPreferences = {
  editSuccessDestination: 'stay',
  createSuccessDestination: 'list',
  autosaveDrafts: false,
  confirmLeave: true,
  confirmReset: true,
  confirmDelete: true,
  confirmBulk: true,
  focusFirstField: false,
  focusFirstError: true,
  copyFeedback: true,
  refreshMode: 'off',
  expandDetailInfo: false,
  detailMode: 'compact',
  searchTrigger: 'enter',
  rememberSearchHistory: false,
  showSearchHistory: false,
  showSearchSuggestions: true,
  keepLastSearchPerPage: false,
};

/* ------------------------------------------------------------------ */
/* 语言与地区 localeRegion                                              */
/* ------------------------------------------------------------------ */

export const LANGUAGES = ['zh-CN', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DATE_FORMATS = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const HOUR_CYCLES = ['h24', 'h12'] as const;
export type HourCycle = (typeof HOUR_CYCLES)[number];

export const RELATIVE_TIME_MODES = ['relative', 'exact'] as const;
export type RelativeTimeMode = (typeof RELATIVE_TIME_MODES)[number];

export const WEEK_STARTS = ['monday', 'sunday'] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];

export type LocaleRegionPreferences = Readonly<{
  language: Language;
  /** 'auto' = 系统时区；其它 = IANA 时区名（SelectField 有限集合）。 */
  timeZone: string;
  dateFormat: DateFormat;
  hourCycle: HourCycle;
  /** 是否显示秒。 */
  showSeconds: boolean;
  /** relative = “5 分钟前”；exact = 精确时间。 */
  relativeTime: RelativeTimeMode;
  /** 数字格式跟随地区（产品固定，不开放自定义）。 */
  numbersFollowLocale: true;
  weekStart: WeekStart;
}>;

export const defaultLocaleRegion: LocaleRegionPreferences = {
  language: 'zh-CN',
  timeZone: 'auto',
  dateFormat: 'YYYY-MM-DD',
  hourCycle: 'h24',
  showSeconds: false,
  relativeTime: 'exact',
  numbersFollowLocale: true,
  weekStart: 'monday',
};

/* ------------------------------------------------------------------ */
/* 通知 notifications                                                   */
/* ------------------------------------------------------------------ */

/** 非关键成功提示时长档位（内部集中 3/5/8 秒，不向用户暴露毫秒）。 */
export const TOAST_DURATIONS = ['short', 'standard', 'long'] as const;
export type ToastDuration = (typeof TOAST_DURATIONS)[number];

export const TOAST_DURATION_MS = { short: 3_000, standard: 5_000, long: 8_000 } as const;

export type NotificationsPreferences = Readonly<{
  /** 应用内通知开/关（关键/错误/安全提示不可被此开关关闭——产品强制）。 */
  inAppNotifications: boolean;
  /** 未读提醒。 */
  unreadReminder: boolean;
  /** 显示通知角标。 */
  showBadge: boolean;
  /** 播放提示音。 */
  sound: boolean;
  /** 允许浏览器桌面通知（默认关；仅用户点击触发权限请求）。 */
  desktopNotifications: boolean;
  /** 非关键成功提示时长。 */
  toastDuration: ToastDuration;
  /** 是否把非关键通知收纳到通知中心。 */
  collectNonCriticalToCenter: boolean;
}>;

export const defaultNotifications: NotificationsPreferences = {
  inAppNotifications: true,
  unreadReminder: true,
  showBadge: true,
  sound: false,
  desktopNotifications: false,
  toastDuration: 'standard',
  collectNonCriticalToCenter: true,
};

/* ------------------------------------------------------------------ */
/* 可访问性 accessibility                                               */
/* ------------------------------------------------------------------ */

export type AccessibilityPreferences = Readonly<{
  /** 增强焦点轮廓（默认关；产品焦点/键盘底线始终保留）。 */
  enhanceFocus: boolean;
  /** 增强交互区域尺寸（默认关；大文字/增强点击区优先于紧凑密度）。 */
  enhanceTargetSize: boolean;
  /** 显示键盘操作提示。 */
  showKeyboardHints: boolean;
  /** 跟随操作系统辅助功能设置（系统强制颜色模式保留浏览器控制权）。 */
  followSystemAssistive: boolean;
}>;

export const defaultAccessibility: AccessibilityPreferences = {
  enhanceFocus: false,
  enhanceTargetSize: false,
  showKeyboardHints: true,
  followSystemAssistive: true,
};

/* ------------------------------------------------------------------ */
/* 安全与隐私 security                                                   */
/* ------------------------------------------------------------------ */

/** 空闲锁屏分钟数（0 = 关闭）。与手动锁屏共用同一解锁流程。 */
export const IDLE_LOCK_MINUTES = [0, 1, 5, 15, 30] as const;
export type IdleLockMinutes = (typeof IDLE_LOCK_MINUTES)[number];

export type SecurityPreferences = Readonly<{
  /**
   * 显示水印：以当前账号标识覆盖内容区，降低截图外传风险。
   * 属视觉提示，不是防篡改或访问控制；客户端清理存储即可绕过。
   */
  watermark: boolean;
  /** 水印附加文字（可选，最多 40 字符；空 = 只显示账号标识）。 */
  watermarkText: string;
  /** 空闲自动锁屏分钟数（0 = 关闭）。空闲判定基于真实用户输入事件。 */
  idleLockMinutes: IdleLockMinutes;
  /** 页面进入后台时立即锁定（切换标签页/最小化）。 */
  lockOnHidden: boolean;
}>;

export const defaultSecurity: SecurityPreferences = {
  watermark: false,
  watermarkText: '',
  idleLockMinutes: 0,
  lockOnHidden: false,
};

/* ------------------------------------------------------------------ */
/* 快捷键 shortcuts                                                     */
/* ------------------------------------------------------------------ */

export type ShortcutsPreferences = Readonly<{
  /** 启用快捷键（默认开；关闭后全局监听停止，注册保留）。 */
  enabled: boolean;
  /** 显示快捷键提示（与可访问性同义字段共享状态）。 */
  showHints: boolean;
}>;

export const defaultShortcuts: ShortcutsPreferences = {
  enabled: true,
  showHints: true,
};

/* ------------------------------------------------------------------ */
/* 聚合模型 / 默认值 / 分类顺序                                          */
/* ------------------------------------------------------------------ */

export type Preferences = Readonly<{
  appearance: AppearancePreferences;
  navigation: NavigationPreferences;
  dataDisplay: DataDisplayPreferences;
  actionPreferences: ActionPreferences;
  localeRegion: LocaleRegionPreferences;
  notifications: NotificationsPreferences;
  accessibility: AccessibilityPreferences;
  security: SecurityPreferences;
  shortcuts: ShortcutsPreferences;
}>;

/** 新用户默认值（无存储记录时使用；旧用户显式值经 migrate 保留，不套此默认）。 */
export const defaultPreferences: Preferences = {
  appearance: defaultAppearance,
  navigation: defaultNavigation,
  dataDisplay: defaultDataDisplay,
  actionPreferences: defaultActionPreferences,
  localeRegion: defaultLocaleRegion,
  notifications: defaultNotifications,
  accessibility: defaultAccessibility,
  security: defaultSecurity,
  shortcuts: defaultShortcuts,
};

export const defaultCategoryOf = (category: PreferenceCategory): Preferences[PreferenceCategory] =>
  defaultPreferences[category];

/* ------------------------------------------------------------------ */
/* 旧版 v0 迁移（clouddrive.shell version 0 → 1）                     */
/* ------------------------------------------------------------------ */

/** 历史 v0 持久化形状（partialize 白名单 theme/locale/sidebarCollapsed）。 */
export type ShellV0Preferences = Readonly<{
  theme?: 'light' | 'dark';
  locale?: 'zh-CN' | 'en';
  sidebarCollapsed?: boolean;
}>;

/**
 * 把 v0 记录保真映射为 v1 分类模型的覆盖（只含旧用户显式设置过的字段）。
 * - 显式 light/dark → themeMode 显式值（不套新默认 system）；
 * - locale 原样 → language；
 * - sidebarCollapsed true/false → 'collapsed'/'expanded'（不套新默认 remember）；
 * 返回的 Partial 由 Host migrate 浅合并到 defaultPreferences 之上。
 * 输入非法（非对象/值域外）时返回 null —— 由 Host 走失败语义，不静默覆盖。
 */
export function migrateShellV0Preferences(legacy: unknown): Partial<Preferences> | null {
  if (legacy === null || typeof legacy !== 'object' || Array.isArray(legacy)) return null;
  const raw = legacy as Record<string, unknown>;
  const patch: MutablePartial<Preferences> = {};

  const theme = raw.theme;
  if (theme === 'light' || theme === 'dark') {
    patch.appearance = { ...defaultAppearance, themeMode: theme };
  }

  const locale = raw.locale;
  if (locale === 'zh-CN' || locale === 'en') {
    patch.localeRegion = { ...defaultLocaleRegion, language: locale };
  }

  const collapsed = raw.sidebarCollapsed;
  if (typeof collapsed === 'boolean') {
    patch.navigation = {
      ...defaultNavigation,
      sidebarBehavior: collapsed ? 'collapsed' : 'expanded',
    };
  }

  return patch;
}

/* ------------------------------------------------------------------ */
/* 边界校验（有限联合守卫；输入为不可信持久化值）                        */
/* ------------------------------------------------------------------ */

export type PreferenceIssue = { path: string; message: string };

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 校验用可变草稿（导出类型为 Readonly；构建期局部可变，返回前冻结语义由类型保证）。 */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
/** 可变可选补丁：Partial<Readonly<T>> 会保留 readonly 修饰，赋值需显式去除。 */
type MutablePartial<T> = { -readonly [K in keyof T]?: T[K] };

/** 校验单个分类对象；缺失字段用默认值补全，非法值返回明确问题。 */
export function validateCategory(
  category: PreferenceCategory,
  input: unknown,
): { ok: true; value: Preferences[PreferenceCategory] } | { ok: false; issues: PreferenceIssue[] } {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: [{ path: category, message: '分类记录必须是对象' }],
    };
  }
  const issues: PreferenceIssue[] = [];

  switch (category) {
    case 'appearance': {
      const base = defaultAppearance;
      const value: Mutable<AppearancePreferences> = { ...base };
      const raw = input;
      if (raw.themeMode !== undefined && !isOneOf(raw.themeMode, THEME_MODES))
        issues.push({ path: `${category}.themeMode`, message: '非法 themeMode' });
      else if (raw.themeMode !== undefined) value.themeMode = raw.themeMode;
      if (raw.accent !== undefined && !isOneOf(raw.accent, ACCENT_PRESETS))
        issues.push({ path: `${category}.accent`, message: '非法 accent' });
      else if (raw.accent !== undefined) value.accent = raw.accent;
      if (raw.density !== undefined && !isOneOf(raw.density, DENSITY_LEVELS))
        issues.push({ path: `${category}.density`, message: '非法 density' });
      else if (raw.density !== undefined) value.density = raw.density;
      if (raw.fontScale !== undefined && !isOneOf(raw.fontScale, FONT_SCALES))
        issues.push({ path: `${category}.fontScale`, message: '非法 fontScale' });
      else if (raw.fontScale !== undefined) value.fontScale = raw.fontScale;
      if (raw.contentWidth !== undefined && !isOneOf(raw.contentWidth, CONTENT_WIDTHS))
        issues.push({ path: `${category}.contentWidth`, message: '非法 contentWidth' });
      else if (raw.contentWidth !== undefined) value.contentWidth = raw.contentWidth;
      if (raw.motion !== undefined && !isOneOf(raw.motion, MOTION_PREFERENCES))
        issues.push({ path: `${category}.motion`, message: '非法 motion' });
      else if (raw.motion !== undefined) value.motion = raw.motion;
      if (raw.contrast !== undefined && !isOneOf(raw.contrast, CONTRAST_PREFERENCES))
        issues.push({ path: `${category}.contrast`, message: '非法 contrast' });
      else if (raw.contrast !== undefined) value.contrast = raw.contrast;
      for (const key of ['colorWeak', 'grayscale'] as const) {
        if (raw[key] !== undefined && !isBoolean(raw[key]))
          issues.push({ path: `${category}.${key}`, message: `${key} 必须是布尔` });
        else if (raw[key] !== undefined) value[key] = raw[key];
      }
      if (raw.pageTransition !== undefined && !isOneOf(raw.pageTransition, PAGE_TRANSITIONS))
        issues.push({ path: `${category}.pageTransition`, message: '非法 pageTransition' });
      else if (raw.pageTransition !== undefined) value.pageTransition = raw.pageTransition;
      return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
    }
    case 'navigation': {
      const base = defaultNavigation;
      const value: Mutable<NavigationPreferences> = { ...base };
      const raw = input;
      if (raw.homeTarget !== undefined && typeof raw.homeTarget !== 'string')
        issues.push({ path: `${category}.homeTarget`, message: 'homeTarget 必须是字符串' });
      else if (raw.homeTarget !== undefined) value.homeTarget = raw.homeTarget;
      for (const key of [
        'scrollToTopOnNavigate',
        'breadcrumbs',
        'pageTabsEnabled',
        'pageTabsPinned',
        'restoreLastTabs',
        'menuMemory',
        'rememberRecents',
        'showRecents',
        'autoRestoreWorkspace',
      ] as const) {
        if (raw[key] !== undefined && !isBoolean(raw[key]))
          issues.push({ path: `${category}.${key}`, message: `${key} 必须是布尔` });
        else if (raw[key] !== undefined) value[key] = raw[key];
      }
      if (raw.tabCloseBehavior !== undefined && !isOneOf(raw.tabCloseBehavior, TAB_CLOSE_BEHAVIORS))
        issues.push({ path: `${category}.tabCloseBehavior`, message: '非法 tabCloseBehavior' });
      else if (raw.tabCloseBehavior !== undefined) value.tabCloseBehavior = raw.tabCloseBehavior;
      if (raw.newPageOpenMode !== undefined && !isOneOf(raw.newPageOpenMode, NEW_PAGE_OPEN_MODES))
        issues.push({ path: `${category}.newPageOpenMode`, message: '非法 newPageOpenMode' });
      else if (raw.newPageOpenMode !== undefined) value.newPageOpenMode = raw.newPageOpenMode;
      if (raw.sidebarBehavior !== undefined && !isOneOf(raw.sidebarBehavior, SIDEBAR_BEHAVIORS))
        issues.push({ path: `${category}.sidebarBehavior`, message: '非法 sidebarBehavior' });
      else if (raw.sidebarBehavior !== undefined) value.sidebarBehavior = raw.sidebarBehavior;
      if (raw.layoutMode !== undefined && !isOneOf(raw.layoutMode, LAYOUT_MODES))
        issues.push({ path: `${category}.layoutMode`, message: '非法 layoutMode' });
      else if (raw.layoutMode !== undefined) value.layoutMode = raw.layoutMode;
      return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
    }
    case 'dataDisplay': {
      const base = defaultDataDisplay;
      const value: Mutable<DataDisplayPreferences> = { ...base };
      const raw = input;
      const pageSizeRaw = raw.pageSize;
      if (pageSizeRaw !== undefined && !PAGE_SIZES.includes(pageSizeRaw as PageSize))
        issues.push({ path: `${category}.pageSize`, message: '非法 pageSize' });
      else if (pageSizeRaw !== undefined) value.pageSize = pageSizeRaw as PageSize;
      if (raw.tableDensity !== undefined && !isOneOf(raw.tableDensity, DENSITY_LEVELS))
        issues.push({ path: `${category}.tableDensity`, message: '非法 tableDensity' });
      else if (raw.tableDensity !== undefined) value.tableDensity = raw.tableDensity;
      for (const key of [
        'rowSeparators',
        'stickyHeader',
        'rememberColumnLayout',
        'rememberSort',
        'rememberFilters',
        'rememberPagination',
        'emptyStateHint',
      ] as const) {
        if (raw[key] !== undefined && !isBoolean(raw[key]))
          issues.push({ path: `${category}.${key}`, message: `${key} 必须是布尔` });
        else if (raw[key] !== undefined) value[key] = raw[key];
      }
      if (raw.longText !== undefined && !isOneOf(raw.longText, LONG_TEXT_MODES))
        issues.push({ path: `${category}.longText`, message: '非法 longText' });
      else if (raw.longText !== undefined) value.longText = raw.longText;
      return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
    }
    case 'actionPreferences': {
      const base = defaultActionPreferences;
      const value: Mutable<ActionPreferences> = { ...base };
      const raw = input;
      if (
        raw.editSuccessDestination !== undefined &&
        !isOneOf(raw.editSuccessDestination, EDIT_SUCCESS_DESTINATIONS)
      )
        issues.push({ path: `${category}.editSuccessDestination`, message: '非法去向' });
      else if (raw.editSuccessDestination !== undefined)
        value.editSuccessDestination = raw.editSuccessDestination;
      if (
        raw.createSuccessDestination !== undefined &&
        !isOneOf(raw.createSuccessDestination, CREATE_SUCCESS_DESTINATIONS)
      )
        issues.push({ path: `${category}.createSuccessDestination`, message: '非法去向' });
      else if (raw.createSuccessDestination !== undefined)
        value.createSuccessDestination = raw.createSuccessDestination;
      if (raw.refreshMode !== undefined && !isOneOf(raw.refreshMode, REFRESH_MODES))
        issues.push({ path: `${category}.refreshMode`, message: '非法 refreshMode' });
      else if (raw.refreshMode !== undefined) value.refreshMode = raw.refreshMode;
      if (raw.searchTrigger !== undefined && !isOneOf(raw.searchTrigger, SEARCH_TRIGGERS))
        issues.push({ path: `${category}.searchTrigger`, message: '非法 searchTrigger' });
      else if (raw.searchTrigger !== undefined) value.searchTrigger = raw.searchTrigger;
      if (raw.detailMode !== undefined && !isOneOf(raw.detailMode, DETAIL_MODES))
        issues.push({ path: `${category}.detailMode`, message: '非法 detailMode' });
      else if (raw.detailMode !== undefined) value.detailMode = raw.detailMode;
      for (const key of [
        'autosaveDrafts',
        'confirmLeave',
        'confirmReset',
        'confirmDelete',
        'confirmBulk',
        'focusFirstField',
        'focusFirstError',
        'copyFeedback',
        'expandDetailInfo',
        'rememberSearchHistory',
        'showSearchHistory',
        'showSearchSuggestions',
        'keepLastSearchPerPage',
      ] as const) {
        if (raw[key] !== undefined && !isBoolean(raw[key]))
          issues.push({ path: `${category}.${key}`, message: `${key} 必须是布尔` });
        else if (raw[key] !== undefined) value[key] = raw[key];
      }
      return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
    }
    case 'localeRegion': {
      const base = defaultLocaleRegion;
      const value: Mutable<LocaleRegionPreferences> = { ...base };
      const raw = input;
      if (raw.language !== undefined && !isOneOf(raw.language, LANGUAGES))
        issues.push({ path: `${category}.language`, message: '非法 language' });
      else if (raw.language !== undefined) value.language = raw.language;
      if (raw.timeZone !== undefined && typeof raw.timeZone !== 'string')
        issues.push({ path: `${category}.timeZone`, message: 'timeZone 必须是字符串' });
      else if (raw.timeZone !== undefined && raw.timeZone !== '') value.timeZone = raw.timeZone;
      if (raw.dateFormat !== undefined && !isOneOf(raw.dateFormat, DATE_FORMATS))
        issues.push({ path: `${category}.dateFormat`, message: '非法 dateFormat' });
      else if (raw.dateFormat !== undefined) value.dateFormat = raw.dateFormat;
      if (raw.hourCycle !== undefined && !isOneOf(raw.hourCycle, HOUR_CYCLES))
        issues.push({ path: `${category}.hourCycle`, message: '非法 hourCycle' });
      else if (raw.hourCycle !== undefined) value.hourCycle = raw.hourCycle;
      if (raw.showSeconds !== undefined && !isBoolean(raw.showSeconds))
        issues.push({ path: `${category}.showSeconds`, message: 'showSeconds 必须是布尔' });
      else if (raw.showSeconds !== undefined) value.showSeconds = raw.showSeconds;
      if (raw.relativeTime !== undefined && !isOneOf(raw.relativeTime, RELATIVE_TIME_MODES))
        issues.push({ path: `${category}.relativeTime`, message: '非法 relativeTime' });
      else if (raw.relativeTime !== undefined) value.relativeTime = raw.relativeTime;
      if (raw.numbersFollowLocale !== undefined && raw.numbersFollowLocale !== true)
        issues.push({ path: `${category}.numbersFollowLocale`, message: '跟随地区不可关闭' });
      if (raw.weekStart !== undefined && !isOneOf(raw.weekStart, WEEK_STARTS))
        issues.push({ path: `${category}.weekStart`, message: '非法 weekStart' });
      else if (raw.weekStart !== undefined) value.weekStart = raw.weekStart;
      return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
    }
    case 'notifications': {
      const base = defaultNotifications;
      const value: Mutable<NotificationsPreferences> = { ...base };
      const raw = input;
      if (raw.toastDuration !== undefined && !isOneOf(raw.toastDuration, TOAST_DURATIONS))
        issues.push({ path: `${category}.toastDuration`, message: '非法 toastDuration' });
      else if (raw.toastDuration !== undefined) value.toastDuration = raw.toastDuration;
      for (const key of [
        'inAppNotifications',
        'unreadReminder',
        'showBadge',
        'sound',
        'desktopNotifications',
        'collectNonCriticalToCenter',
      ] as const) {
        if (raw[key] !== undefined && !isBoolean(raw[key]))
          issues.push({ path: `${category}.${key}`, message: `${key} 必须是布尔` });
        else if (raw[key] !== undefined) value[key] = raw[key];
      }
      return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
    }
    case 'accessibility': {
      const base = defaultAccessibility;
      const value: Mutable<AccessibilityPreferences> = { ...base };
      const raw = input;
      for (const key of [
        'enhanceFocus',
        'enhanceTargetSize',
        'showKeyboardHints',
        'followSystemAssistive',
      ] as const) {
        if (raw[key] !== undefined && !isBoolean(raw[key]))
          issues.push({ path: `${category}.${key}`, message: `${key} 必须是布尔` });
        else if (raw[key] !== undefined) value[key] = raw[key];
      }
      return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
    }
    case 'security': {
      const base = defaultSecurity;
      const value: Mutable<SecurityPreferences> = { ...base };
      const raw = input;
      for (const key of ['watermark', 'lockOnHidden'] as const) {
        if (raw[key] !== undefined && !isBoolean(raw[key]))
          issues.push({ path: `${category}.${key}`, message: `${key} 必须是布尔` });
        else if (raw[key] !== undefined) value[key] = raw[key];
      }
      if (raw.watermarkText !== undefined && typeof raw.watermarkText !== 'string')
        issues.push({ path: `${category}.watermarkText`, message: 'watermarkText 必须是字符串' });
      else if (raw.watermarkText !== undefined)
        value.watermarkText = raw.watermarkText.slice(0, 40);
      if (raw.idleLockMinutes !== undefined) {
        const minutes = raw.idleLockMinutes;
        if (
          typeof minutes !== 'number' ||
          !(IDLE_LOCK_MINUTES as readonly number[]).includes(minutes)
        )
          issues.push({ path: `${category}.idleLockMinutes`, message: '非法 idleLockMinutes' });
        else value.idleLockMinutes = minutes as IdleLockMinutes;
      }
      return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
    }
    case 'shortcuts': {
      const base = defaultShortcuts;
      const value: Mutable<ShortcutsPreferences> = { ...base };
      const raw = input;
      for (const key of ['enabled', 'showHints'] as const) {
        if (raw[key] !== undefined && !isBoolean(raw[key]))
          issues.push({ path: `${category}.${key}`, message: `${key} 必须是布尔` });
        else if (raw[key] !== undefined) value[key] = raw[key];
      }
      return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
    }
  }
}

/**
 * 校验完整偏好对象（不可信持久化输入 → typed Preferences）。
 * 顶层缺失分类用默认值补全；单分类非法只报该分类问题并整体失败
 * （由调用方决定失败呈现/恢复动作，不静默覆盖）。
 */
export function validatePreferences(
  input: unknown,
): { ok: true; value: Preferences } | { ok: false; issues: PreferenceIssue[] } {
  if (!isPlainObject(input)) {
    return { ok: false, issues: [{ path: '', message: '偏好记录必须是对象' }] };
  }
  const issues: PreferenceIssue[] = [];
  const value = { ...defaultPreferences };
  for (const category of PREFERENCE_CATEGORIES) {
    const raw = input[category];
    if (raw === undefined) continue; // 缺失分类 → 用默认值
    const result = validateCategory(category, raw);
    if (!result.ok) {
      issues.push(...result.issues);
    } else {
      (value as Record<string, unknown>)[category] = result.value;
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

/* ------------------------------------------------------------------ */
/* 语言与地区 → Intl 展示映射（单一 authority：偏好枚举 → 日期/时间选项） */
/* ------------------------------------------------------------------ */

/** 时刻显示选项：hourCycle + showSeconds（日期纯排版见 formatDateOnly）。 */
export function timeToIntlOptions(prefs: {
  hourCycle: HourCycle;
  showSeconds: boolean;
}): Intl.DateTimeFormatOptions {
  return {
    hour: '2-digit',
    minute: '2-digit',
    ...(prefs.showSeconds ? { second: '2-digit' as const } : {}),
    ...(prefs.hourCycle === 'h24' ? { hourCycle: 'h23' as const } : { hour12: true }),
  };
}

/**
 * 纯日期：dateFormat 的顺序差异经 Intl locale 表达不可靠（zh-CN 无 MM/DD/YYYY 语义），
 * 因此直接按 dateFormat 排版（UTC 字段读取，纯日期不因时区偏移）。
 */
export function formatDateOnly(dateFormat: DateFormat, value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  switch (dateFormat) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
  }
}

/** IANA 时区候选（SelectField 有限集合；'auto' = 系统时区）。 */
export const TIME_ZONE_OPTIONS = [
  'auto',
  'Asia/Shanghai',
  'Europe/London',
  'America/New_York',
] as const;
