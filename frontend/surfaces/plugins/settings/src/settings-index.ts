/**
 * settings —— 设置项搜索目录（插件拥有；纯函数，可独立测试）。
 *
 * 每条设置项描述：
 * - category / fieldId：定位与恢复用；
 * - 名称/说明/分类的搜索词：zh/en 标签 + 说明 + 中英文同义词。
 *
 * 统一规则：
 * - 匹配 name/description/category 与同义词（如 zh "动画" 命中 appearance.motion
 *   "动效"；en 同理）；
 * - 设置搜索自身不落入业务搜索历史、不受业务搜索时机偏好影响（调用方保证）。
 */

export type SettingsEntry = Readonly<{
  category: string;
  fieldId: string;
  /** 展示名（i18n key 或直出文案；页面翻译）。 */
  nameKey: string;
  descriptionKey?: string;
  categoryLabelKey: string;
  /** 搜索同义词（中英文、概念词），不含 name 本身（name 已参与匹配）。 */
  synonyms: readonly string[];
}>;

export const SETTINGS_INDEX: readonly SettingsEntry[] = [
  // 外观
  {
    category: 'appearance',
    fieldId: 'themeMode',
    nameKey: 'settings.appearance.themeMode',
    descriptionKey: 'settings.appearance.themeModeDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: ['theme', '主题', '深色', '浅色', 'dark', 'light', 'system'],
  },
  {
    category: 'appearance',
    fieldId: 'accent',
    nameKey: 'settings.appearance.accent',
    descriptionKey: 'settings.appearance.accentDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: [
      '强调色',
      '颜色',
      'color',
      'purple',
      'blue',
      'green',
      'orange',
      '紫',
      '蓝',
      '绿',
      '橙',
    ],
  },
  {
    category: 'appearance',
    fieldId: 'density',
    nameKey: 'settings.appearance.density',
    descriptionKey: 'settings.appearance.densityDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: ['密度', '紧凑', '宽松', 'spacing', 'compact', 'comfortable'],
  },
  {
    category: 'appearance',
    fieldId: 'fontScale',
    nameKey: 'settings.appearance.fontScale',
    descriptionKey: 'settings.appearance.fontScaleDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: ['字号', '字体', '文字', 'font', '文字大小'],
  },
  {
    category: 'appearance',
    fieldId: 'contentWidth',
    nameKey: 'settings.appearance.contentWidth',
    descriptionKey: 'settings.appearance.contentWidthDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: ['宽度', '宽屏', '布局', 'width', 'wide', 'layout'],
  },
  {
    category: 'appearance',
    fieldId: 'motion',
    nameKey: 'settings.appearance.motion',
    descriptionKey: 'settings.appearance.motionDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: ['动效', '动画', 'animation', 'reduce', '减弱', '动态效果', 'motion'],
  },
  {
    category: 'appearance',
    fieldId: 'contrast',
    nameKey: 'settings.appearance.contrast',
    descriptionKey: 'settings.appearance.contrastDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: ['对比', '对比度', 'contrast', '高对比'],
  },
  {
    category: 'appearance',
    fieldId: 'colorWeak',
    nameKey: 'settings.appearance.colorWeak',
    descriptionKey: 'settings.appearance.colorWeakDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: ['色弱', '色盲', '色觉', 'color weak', 'colorblind', '红色', '绿色'],
  },
  {
    category: 'appearance',
    fieldId: 'grayscale',
    nameKey: 'settings.appearance.grayscale',
    descriptionKey: 'settings.appearance.grayscaleDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: ['灰阶', '灰度', '去色', '黑白', 'grayscale', 'monochrome'],
  },
  {
    category: 'appearance',
    fieldId: 'pageTransition',
    nameKey: 'settings.appearance.pageTransition',
    descriptionKey: 'settings.appearance.pageTransitionDescription',
    categoryLabelKey: 'settings.categories.appearance',
    synonyms: ['页面切换动画', '页面切换', '转场', '过渡', '动画', 'transition', 'fade', 'slide'],
  },
  // 导航
  {
    category: 'navigation',
    fieldId: 'layoutMode',
    nameKey: 'settings.navigation.layoutMode',
    descriptionKey: 'settings.navigation.layoutModeHint',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: [
      '布局',
      '布局模式',
      '侧边导航',
      '顶部导航',
      '混合导航',
      'layout',
      'sidebar',
      'horizontal',
      'vertical',
      'mixed',
    ],
  },
  {
    category: 'navigation',
    fieldId: 'sidebarBehavior',
    nameKey: 'settings.navigation.sidebarBehavior',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: ['侧边栏', '侧栏', 'sidebar', 'collapse', '折叠'],
  },
  {
    category: 'navigation',
    fieldId: 'scrollToTopOnNavigate',
    nameKey: 'settings.navigation.scrollToTopOnNavigate',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: ['滚动', '顶部', 'scroll', 'jump'],
  },
  {
    category: 'navigation',
    fieldId: 'breadcrumbs',
    nameKey: 'settings.navigation.breadcrumbs',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: ['面包屑', 'breadcrumb', '导航路径'],
  },
  {
    category: 'navigation',
    fieldId: 'pageTabsEnabled',
    nameKey: 'settings.navigation.pageTabsEnabled',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: ['标签', '页签', 'tabs', '页面标签'],
  },
  {
    category: 'navigation',
    fieldId: 'pageTabsPinned',
    nameKey: 'settings.navigation.pageTabsPinned',
    categoryLabelKey: 'settings.categories.navigation',
    descriptionKey: 'settings.navigation.pageTabsPinnedDescription',
    synonyms: ['固定', 'pin', 'sticky'],
  },
  {
    category: 'navigation',
    fieldId: 'menuMemory',
    nameKey: 'settings.navigation.menuMemory',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: ['菜单记忆', '记住展开', '侧栏展开', 'menu', 'expand'],
  },
  // 数据展示
  {
    category: 'dataDisplay',
    fieldId: 'pageSize',
    nameKey: 'settings.dataDisplay.pageSize',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: ['每页', '分页', 'page size', 'pagination', '条数'],
  },
  {
    category: 'dataDisplay',
    fieldId: 'tableDensity',
    nameKey: 'settings.dataDisplay.tableDensity',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: ['表格', '密度', 'table', 'density', '行高'],
  },
  {
    category: 'dataDisplay',
    fieldId: 'rememberSort',
    nameKey: 'settings.dataDisplay.rememberSort',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: ['排序', '记忆', 'sort', '排序条件'],
  },
  {
    category: 'dataDisplay',
    fieldId: 'rememberFilters',
    nameKey: 'settings.dataDisplay.rememberFilters',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: ['筛选', '过滤', 'filter', '条件'],
  },
  {
    category: 'dataDisplay',
    fieldId: 'longText',
    nameKey: 'settings.dataDisplay.longText',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: ['长文本', '截断', '换行', 'truncate', 'wrap'],
  },
  // 操作偏好
  {
    category: 'actionPreferences',
    fieldId: 'confirmDelete',
    nameKey: 'settings.actionPreferences.confirmDelete',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: ['删除', '确认', '二次确认', 'delete', 'danger'],
  },
  {
    category: 'actionPreferences',
    fieldId: 'autosaveDrafts',
    nameKey: 'settings.actionPreferences.autosaveDrafts',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: ['草稿', '自动保存', 'draft', 'autosave'],
  },
  {
    category: 'actionPreferences',
    fieldId: 'confirmLeave',
    nameKey: 'settings.actionPreferences.confirmLeave',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: ['离开', '未保存', '提醒', 'leave', 'unsaved'],
  },
  // 语言与地区
  {
    category: 'localeRegion',
    fieldId: 'language',
    nameKey: 'settings.localeRegion.language',
    categoryLabelKey: 'settings.categories.localeRegion',
    synonyms: ['语言', '中文', '英文', 'language', 'locale', '简体'],
  },
  {
    category: 'localeRegion',
    fieldId: 'dateFormat',
    nameKey: 'settings.localeRegion.dateFormat',
    categoryLabelKey: 'settings.categories.localeRegion',
    synonyms: ['日期', 'date', '格式'],
  },
  {
    category: 'localeRegion',
    fieldId: 'weekStart',
    nameKey: 'settings.localeRegion.weekStart',
    categoryLabelKey: 'settings.categories.localeRegion',
    synonyms: ['周', '星期', 'week', '周一', '周日'],
  },
  // 通知
  {
    category: 'notifications',
    fieldId: 'desktopNotifications',
    nameKey: 'settings.notifications.desktopNotifications',
    categoryLabelKey: 'settings.categories.notifications',
    synonyms: ['桌面', '通知', 'desktop', '浏览器'],
  },
  {
    category: 'notifications',
    fieldId: 'sound',
    nameKey: 'settings.notifications.sound',
    categoryLabelKey: 'settings.categories.notifications',
    synonyms: ['声音', '提示音', 'sound', '音效'],
  },
  // 可访问性 / 快捷键
  {
    category: 'accessibility',
    fieldId: 'enhanceFocus',
    nameKey: 'settings.accessibility.enhanceFocus',
    categoryLabelKey: 'settings.categories.accessibility',
    synonyms: ['焦点', 'focus', '无障碍', '可见'],
  },
  {
    category: 'shortcuts',
    fieldId: 'enabled',
    nameKey: 'settings.shortcuts.enabled',
    categoryLabelKey: 'settings.categories.shortcuts',
    synonyms: ['快捷键', '键盘', 'shortcut', 'keyboard', '命令'],
  },
  // Remaining visible fields share the same search/anchor contract.
  {
    category: 'navigation',
    fieldId: 'newPageOpenMode',
    nameKey: 'settings.navigation.newPageOpenMode',
    descriptionKey: 'settings.navigation.newPageOpenModeHint',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: [],
  },
  {
    category: 'navigation',
    fieldId: 'restoreLastTabs',
    nameKey: 'settings.navigation.restoreLastTabs',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: ['恢复标签', 'restore tabs'],
  },
  {
    category: 'navigation',
    fieldId: 'tabCloseBehavior',
    nameKey: 'settings.navigation.tabCloseBehavior',
    descriptionKey: 'settings.navigation.tabCloseBehaviorHint',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: ['关闭标签', 'close tab'],
  },
  {
    category: 'navigation',
    fieldId: 'rememberRecents',
    nameKey: 'settings.navigation.rememberRecents',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: [],
  },
  {
    category: 'navigation',
    fieldId: 'showRecents',
    nameKey: 'settings.navigation.showRecents',
    categoryLabelKey: 'settings.categories.navigation',
    synonyms: [],
  },

  {
    category: 'dataDisplay',
    fieldId: 'rowSeparators',
    nameKey: 'settings.dataDisplay.rowSeparators',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: [],
  },
  {
    category: 'dataDisplay',
    fieldId: 'stickyHeader',
    nameKey: 'settings.dataDisplay.stickyHeader',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: [],
  },
  {
    category: 'dataDisplay',
    fieldId: 'rememberColumnLayout',
    nameKey: 'settings.dataDisplay.rememberColumnLayout',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: ['列布局', 'columns'],
  },
  {
    category: 'dataDisplay',
    fieldId: 'rememberPagination',
    nameKey: 'settings.dataDisplay.rememberPagination',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: ['分页记忆', 'pagination'],
  },
  {
    category: 'dataDisplay',
    fieldId: 'emptyStateHint',
    nameKey: 'settings.dataDisplay.emptyStateHint',
    categoryLabelKey: 'settings.categories.dataDisplay',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'editSuccessDestination',
    nameKey: 'settings.actionPreferences.editSuccessDestination',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: ['保存去向', 'after save'],
  },
  {
    category: 'actionPreferences',
    fieldId: 'createSuccessDestination',
    nameKey: 'settings.actionPreferences.createSuccessDestination',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: ['创建去向', 'after create'],
  },
  {
    category: 'actionPreferences',
    fieldId: 'confirmReset',
    nameKey: 'settings.actionPreferences.confirmReset',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'confirmBulk',
    nameKey: 'settings.actionPreferences.confirmBulk',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'focusFirstField',
    nameKey: 'settings.actionPreferences.focusFirstField',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'focusFirstError',
    nameKey: 'settings.actionPreferences.focusFirstError',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'copyFeedback',
    nameKey: 'settings.actionPreferences.copyFeedback',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'expandDetailInfo',
    nameKey: 'settings.actionPreferences.expandDetailInfo',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'detailMode',
    nameKey: 'settings.actionPreferences.detailMode',
    descriptionKey: 'settings.actionPreferences.detailModeHint',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'refreshMode',
    nameKey: 'settings.actionPreferences.refreshMode',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: ['自动刷新', 'refresh'],
  },
  {
    category: 'actionPreferences',
    fieldId: 'searchTrigger',
    nameKey: 'settings.actionPreferences.searchTrigger',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'rememberSearchHistory',
    nameKey: 'settings.actionPreferences.rememberSearchHistory',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'showSearchHistory',
    nameKey: 'settings.actionPreferences.showSearchHistory',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'showSearchSuggestions',
    nameKey: 'settings.actionPreferences.showSearchSuggestions',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'actionPreferences',
    fieldId: 'keepLastSearchPerPage',
    nameKey: 'settings.actionPreferences.keepLastSearchPerPage',
    categoryLabelKey: 'settings.categories.actionPreferences',
    synonyms: [],
  },
  {
    category: 'localeRegion',
    fieldId: 'timeZone',
    nameKey: 'settings.localeRegion.timeZone',
    descriptionKey: 'settings.localeRegion.timeZoneHint',
    categoryLabelKey: 'settings.categories.localeRegion',
    synonyms: ['时区', 'timezone'],
  },
  {
    category: 'localeRegion',
    fieldId: 'hourCycle',
    nameKey: 'settings.localeRegion.hourCycle',
    categoryLabelKey: 'settings.categories.localeRegion',
    synonyms: ['小时制', '12h', '24h'],
  },
  {
    category: 'localeRegion',
    fieldId: 'showSeconds',
    nameKey: 'settings.localeRegion.showSeconds',
    categoryLabelKey: 'settings.categories.localeRegion',
    synonyms: [],
  },
  {
    category: 'localeRegion',
    fieldId: 'relativeTime',
    nameKey: 'settings.localeRegion.relativeTime',
    categoryLabelKey: 'settings.categories.localeRegion',
    synonyms: [],
  },
  {
    category: 'notifications',
    fieldId: 'inAppNotifications',
    nameKey: 'settings.notifications.inAppNotifications',
    categoryLabelKey: 'settings.categories.notifications',
    synonyms: [],
  },
  {
    category: 'notifications',
    fieldId: 'unreadReminder',
    nameKey: 'settings.notifications.unreadReminder',
    categoryLabelKey: 'settings.categories.notifications',
    synonyms: [],
  },
  {
    category: 'notifications',
    fieldId: 'showBadge',
    nameKey: 'settings.notifications.showBadge',
    categoryLabelKey: 'settings.categories.notifications',
    synonyms: [],
  },
  {
    category: 'notifications',
    fieldId: 'collectNonCriticalToCenter',
    nameKey: 'settings.notifications.collectNonCriticalToCenter',
    categoryLabelKey: 'settings.categories.notifications',
    synonyms: [],
  },
  {
    category: 'notifications',
    fieldId: 'toastDuration',
    nameKey: 'settings.notifications.toastDuration',
    categoryLabelKey: 'settings.categories.notifications',
    synonyms: ['提示时长', 'toast'],
  },
  {
    category: 'accessibility',
    fieldId: 'enhanceTargetSize',
    nameKey: 'settings.accessibility.enhanceTargetSize',
    categoryLabelKey: 'settings.categories.accessibility',
    synonyms: [],
  },
  {
    category: 'accessibility',
    fieldId: 'showKeyboardHints',
    nameKey: 'settings.accessibility.showKeyboardHints',
    categoryLabelKey: 'settings.categories.accessibility',
    synonyms: [],
  },
  {
    category: 'accessibility',
    fieldId: 'followSystemAssistive',
    nameKey: 'settings.accessibility.followSystemAssistive',
    categoryLabelKey: 'settings.categories.accessibility',
    synonyms: ['辅助功能', 'assistive'],
  },
  // 安全与隐私
  {
    category: 'security',
    fieldId: 'watermark',
    nameKey: 'settings.security.watermark',
    descriptionKey: 'settings.security.watermarkDescription',
    categoryLabelKey: 'settings.categories.security',
    synonyms: ['水印', '账号水印', '防截图', 'watermark', '泄密', '外传'],
  },
  {
    category: 'security',
    fieldId: 'watermarkText',
    nameKey: 'settings.security.watermarkText',
    descriptionKey: 'settings.security.watermarkTextHint',
    categoryLabelKey: 'settings.categories.security',
    synonyms: ['水印文字', '附加文字', '水印内容', 'watermark text', '标识'],
  },
  {
    category: 'security',
    fieldId: 'idleLockMinutes',
    nameKey: 'settings.security.idleLockMinutes',
    descriptionKey: 'settings.security.idleLockMinutesHint',
    categoryLabelKey: 'settings.categories.security',
    synonyms: ['锁屏', '空闲', '自动锁定', 'idle', 'lock', '超时', '分钟'],
  },
  {
    category: 'security',
    fieldId: 'lockOnHidden',
    nameKey: 'settings.security.lockOnHidden',
    descriptionKey: 'settings.security.lockOnHiddenDescription',
    categoryLabelKey: 'settings.categories.security',
    synonyms: ['后台锁定', '切换标签页', '最小化', 'hidden', 'background', 'lock'],
  },
  {
    category: 'shortcuts',
    fieldId: 'showHints',
    nameKey: 'settings.shortcuts.showHints',
    categoryLabelKey: 'settings.categories.shortcuts',
    synonyms: [],
  },
];

/** 归一化搜索词（小写、去空白、去中英文分隔）。 */
export function normalizeSearchTerm(term: string): string {
  return term.trim().toLocaleLowerCase();
}

/**
 * 按查询匹配设置项：命中名称/说明/分类（经 resolveText 取当前语言文案）或同义词。
 * 返回命中的 category 集合与 entry 列表（去重、按目录顺序）。
 */
export function searchSettings(
  query: string,
  resolveText: (key: string) => string,
  entries: readonly SettingsEntry[] = SETTINGS_INDEX,
): { entries: readonly SettingsEntry[]; categories: readonly string[] } {
  const q = normalizeSearchTerm(query);
  if (q === '') return { entries: [], categories: [] };
  const hits = entries.filter((entry) => {
    const texts = [
      resolveText(entry.nameKey),
      entry.descriptionKey ? resolveText(entry.descriptionKey) : '',
      resolveText(entry.categoryLabelKey),
      ...entry.synonyms,
    ];
    return texts.some((text) => normalizeSearchTerm(text).includes(q));
  });
  const categories = [...new Set(hits.map((entry) => entry.category))];
  return { entries: hits, categories };
}
