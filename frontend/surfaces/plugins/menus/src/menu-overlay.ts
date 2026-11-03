/**
 * menus —— 业务菜单覆盖模型（纯模块，无 React / 无 storage / 无副作用）。
 *
 * 部署期注册表（Plugin Route Registry + Navigation Contribution）决定菜单与路由的
 * 真实身份；本模块只表达"展示/业务元数据覆盖"：标题、排序、可见性、权限标识。
 * Host Sidebar 后续可直接复用 `readMenuOverrides` + `applyMenuOverlay`，保证页面与
 * Shell 使用同一套 overlay 逻辑，而不是各自实现一份。
 */

/** 菜单节点类型：分组 / 菜单 / 子菜单（固定三级，与部署注册表一致）。 */
export type MenuNodeKind = 'group' | 'menu' | 'submenu';

/** 覆盖解析的输入：来自部署期路由目录（catalog）的展示项。 */
export type MenuOverlayEntry = Readonly<{
  /** 稳定节点 id（分组用 `group:<groupId>`，路由节点用 navigationId）。 */
  id: string;
  kind: MenuNodeKind;
  parentId?: string;
  /** 部署注册表路由 id；无 routeId 的纯展开父级或分组没有该字段。 */
  routeId?: string;
  /** 部署注册表 navigationId（Host Shell 覆盖的稳定键；优先于 routeId）。 */
  navigationId?: string;
  /** 注册表标题（i18n 解析后）。 */
  label: string;
  /** 注册表顺序。 */
  order: number;
  /** 注册表声明的权限标识（当前路由目录不提供，保留扩展位）。 */
  permission?: string | null;
  /** 注册表声明的隐藏状态（当前目录不提供，保留扩展位）。 */
  hidden?: boolean;
}>;

/** 单个路由的业务覆盖记录。每次写入 `version` 自增（乐观并发）。 */
export type MenuOverride = Readonly<{
  hidden?: boolean;
  label?: string;
  order?: number;
  permission?: string | null;
  version: number;
}>;

/** routeId → 覆盖记录。 */
export type MenuOverrides = Readonly<Record<string, MenuOverride>>;

/** 覆盖后的展示项（保留输入条目上的额外展示元数据）。 */
export type ResolvedMenuEntry<Entry extends MenuOverlayEntry = MenuOverlayEntry> = Entry &
  Readonly<{
    label: string;
    baseLabel: string;
    order: number;
    baseOrder: number;
    permission: string | null;
    hidden: boolean;
    /** 是否存在业务覆盖字段（仅 version 的记录不算"已修改"）。 */
    overridden: boolean;
    version: number;
    depth: number;
  }>;

/** 可参与搜索的展示项（路由地址等附加展示元数据）。 */
export type MenuSearchableEntry = ResolvedMenuEntry &
  Readonly<{ pattern?: string | null; navigationId?: string }>;

export const MENU_LABEL_MIN = 1;
export const MENU_LABEL_MAX = 40;
export const MENU_ORDER_MIN = 0;
export const MENU_ORDER_MAX = 999;
export const MENU_PERMISSION_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;

export type MenuOverridePatch = Readonly<{
  hidden?: boolean;
  /** 空字符串表示清除标题覆盖。 */
  label?: string;
  /** null 表示清除权限覆盖。 */
  permission?: string | null;
  /** null 表示清除排序覆盖。 */
  order?: number | null;
}>;

export type MenuOverrideField = 'label' | 'permission' | 'order';

export type MenuOverrideIssues = Readonly<{
  label?: 'label-length';
  permission?: 'permission-format';
  order?: 'order-range';
}>;

export type MenuOverrideReason = 'label-length' | 'permission-format' | 'order-range';

/** 编辑对话框的原始输入（全部为字符串，便于受控字段）。 */
export type MenuOverrideDraft = Readonly<{
  label: string;
  permission: string;
  order: string;
  hidden: boolean;
}>;

export type MenuOverrideValues = Readonly<{
  hidden: boolean;
  label: string;
  permission: string | null;
  order: number | null;
}>;

export type MenuOverrideValidation =
  | Readonly<{ ok: true; values: MenuOverrideValues }>
  | Readonly<{ ok: false; issues: MenuOverrideIssues }>;

/** 校验对话框输入；空标题/权限/排序表示清除对应覆盖。 */
export function validateMenuOverrideDraft(draft: MenuOverrideDraft): MenuOverrideValidation {
  const issues: {
    label?: 'label-length';
    permission?: 'permission-format';
    order?: 'order-range';
  } = {};
  const label = draft.label.trim();
  const permission = draft.permission.trim();
  const orderText = draft.order.trim();

  if (label.length > MENU_LABEL_MAX) issues.label = 'label-length';

  if (permission.length > 0 && !MENU_PERMISSION_PATTERN.test(permission)) {
    issues.permission = 'permission-format';
  }

  let order: number | null = null;
  if (orderText.length > 0) {
    const parsed = Number(orderText);
    if (
      !/^\d+$/.test(orderText) ||
      !Number.isInteger(parsed) ||
      parsed < MENU_ORDER_MIN ||
      parsed > MENU_ORDER_MAX
    ) {
      issues.order = 'order-range';
    } else {
      order = parsed;
    }
  }

  if (issues.label !== undefined || issues.permission !== undefined || issues.order !== undefined) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    values: {
      hidden: draft.hidden,
      label,
      permission: permission.length === 0 ? null : permission,
      order,
    },
  };
}

/** 应用一次覆盖写入；返回新的覆盖记录（version 自增）或校验失败原因。 */
export function applyMenuOverridePatch(
  current: MenuOverride | undefined,
  patch: MenuOverridePatch,
):
  Readonly<{ ok: true; next: MenuOverride }> | Readonly<{ ok: false; reason: MenuOverrideReason }> {
  let label = current?.label;
  let permission: string | null | undefined = current?.permission;
  let order = current?.order;
  let hidden = current?.hidden;

  if (patch.label !== undefined) {
    const trimmed = patch.label.trim();
    if (trimmed.length > MENU_LABEL_MAX) return { ok: false, reason: 'label-length' };
    label = trimmed.length === 0 ? undefined : trimmed;
  }

  if (patch.permission !== undefined) {
    const trimmed = patch.permission === null ? '' : patch.permission.trim();
    if (trimmed.length > 0 && !MENU_PERMISSION_PATTERN.test(trimmed)) {
      return { ok: false, reason: 'permission-format' };
    }
    permission = trimmed.length === 0 ? undefined : trimmed;
  }

  if (patch.order !== undefined) {
    if (patch.order === null) {
      order = undefined;
    } else {
      if (
        !Number.isInteger(patch.order) ||
        patch.order < MENU_ORDER_MIN ||
        patch.order > MENU_ORDER_MAX
      ) {
        return { ok: false, reason: 'order-range' };
      }
      order = patch.order;
    }
  }

  if (patch.hidden !== undefined) hidden = patch.hidden;

  return {
    ok: true,
    next: {
      version: (current?.version ?? 0) + 1,
      ...(hidden !== undefined ? { hidden } : {}),
      ...(label !== undefined ? { label } : {}),
      ...(order !== undefined ? { order } : {}),
      ...(permission !== undefined ? { permission } : {}),
    },
  };
}

/** 恢复注册表默认展示：清除标题/排序/权限，但保留显式可见性。 */
export function resetMenuOverridePreset(current: MenuOverride | undefined): MenuOverride {
  return {
    version: (current?.version ?? 0) + 1,
    ...(current?.hidden !== undefined ? { hidden: current.hidden } : {}),
  };
}

/** 覆盖记录是否包含业务字段（仅 version 不算覆盖）。 */
export function hasMenuOverrideFields(override: MenuOverride | undefined): boolean {
  return (
    override !== undefined &&
    (override.hidden !== undefined ||
      override.label !== undefined ||
      override.order !== undefined ||
      override.permission !== undefined)
  );
}

/** 持久化读模型（partialize 白名单）。 */
export type MenuOverlayPersisted = Readonly<{
  overrides: MenuOverrides;
  updatedAt: number | null;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 校验持久化记录；损坏时抛错（由 hydration lifecycle 上报），绝不静默回退默认值。
 */
export function parseMenuOverlayPersisted(value: unknown): MenuOverlayPersisted {
  if (!isRecord(value) || !isRecord(value.overrides)) {
    throw new Error('menus: 菜单覆盖记录损坏');
  }
  const overrides: Record<string, MenuOverride> = {};
  for (const [routeId, raw] of Object.entries(value.overrides)) {
    if (routeId.trim().length === 0 || !isRecord(raw)) {
      throw new Error('menus: 菜单覆盖记录损坏');
    }
    const version = raw['version'];
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      throw new Error('menus: 菜单覆盖记录版本损坏');
    }
    const entry: {
      version: number;
      hidden?: boolean;
      label?: string;
      order?: number;
      permission?: string | null;
    } = { version };
    if ('hidden' in raw) {
      if (typeof raw['hidden'] !== 'boolean') throw new Error('menus: 菜单可见性记录损坏');
      entry.hidden = raw['hidden'];
    }
    if ('label' in raw) {
      const label = raw['label'];
      if (
        typeof label !== 'string' ||
        label.trim().length < MENU_LABEL_MIN ||
        label.trim().length > MENU_LABEL_MAX
      ) {
        throw new Error('menus: 菜单标题记录损坏');
      }
      entry.label = label;
    }
    if ('order' in raw) {
      const order = raw['order'];
      if (
        typeof order !== 'number' ||
        !Number.isInteger(order) ||
        order < MENU_ORDER_MIN ||
        order > MENU_ORDER_MAX
      ) {
        throw new Error('menus: 菜单排序记录损坏');
      }
      entry.order = order;
    }
    if ('permission' in raw) {
      const permission = raw['permission'];
      if (permission !== null) {
        if (typeof permission !== 'string' || !MENU_PERMISSION_PATTERN.test(permission)) {
          throw new Error('menus: 菜单权限标识记录损坏');
        }
      }
      entry.permission = permission;
    }
    overrides[routeId] = entry;
  }
  const updatedAt = value['updatedAt'];
  if (
    updatedAt !== undefined &&
    updatedAt !== null &&
    (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt))
  ) {
    throw new Error('menus: 菜单覆盖时间记录损坏');
  }
  return { overrides, updatedAt: updatedAt ?? null };
}

/** store 读函数（Host 可 `useMenuOverlayStore(readMenuOverrides)` 复用）。 */
export type MenuOverlayStoreReadable = Readonly<{ overrides: MenuOverrides }>;

export function readMenuOverrides(state: MenuOverlayStoreReadable): MenuOverrides {
  return state.overrides;
}

/**
 * 把覆盖应用到路由目录条目，并按注册表顺序做深度优先排序。
 *
 * - 覆盖只按 routeId 命中；分组/无路由父级永远使用注册表值；
 * - 同层排序：覆盖 order 优先，其次原顺序（稳定排序）；
 * - hidden 沿祖先链继承（父级隐藏 → 子树整体隐藏），供 Host Sidebar 直接过滤。
 */
export function applyMenuOverlay<Entry extends MenuOverlayEntry>(
  entries: readonly Entry[],
  overrides: MenuOverrides,
): readonly ResolvedMenuEntry<Entry>[] {
  type Pending = Readonly<{
    entry: Entry;
    index: number;
    label: string;
    order: number;
    permission: string | null;
    hidden: boolean;
    overridden: boolean;
    version: number;
  }>;

  const pending: Pending[] = entries.map((entry, index) => {
    // 覆盖键与 Host Shell 一致：navigationId 优先（Host 导航节点只有 navigationId）。
    const overrideKey = entry.navigationId ?? entry.routeId;
    const override = overrideKey === undefined ? undefined : overrides[overrideKey];
    let permission = entry.permission ?? null;
    if (override !== undefined && override.permission !== undefined)
      permission = override.permission;
    return {
      entry,
      index,
      label: override?.label ?? entry.label,
      order: override?.order ?? entry.order,
      permission,
      hidden: override?.hidden ?? entry.hidden ?? false,
      overridden: hasMenuOverrideFields(override),
      version: override?.version ?? 0,
    };
  });

  const byId = new Map(pending.map((item) => [item.entry.id, item]));
  const children = new Map<string, Pending[]>();
  const roots: Pending[] = [];
  for (const item of pending) {
    const parentId = item.entry.parentId;
    if (parentId !== undefined && byId.has(parentId)) {
      const siblings = children.get(parentId) ?? [];
      siblings.push(item);
      children.set(parentId, siblings);
    } else {
      roots.push(item);
    }
  }
  const byOrder = (left: Pending, right: Pending) =>
    left.order - right.order || left.index - right.index;
  roots.sort(byOrder);
  for (const siblings of children.values()) siblings.sort(byOrder);

  const resolved: ResolvedMenuEntry<Entry>[] = [];
  const visited = new Set<string>();
  const visit = (item: Pending, depth: number, inheritedHidden: boolean) => {
    if (visited.has(item.entry.id)) return;
    visited.add(item.entry.id);
    const hidden = inheritedHidden || item.hidden;
    resolved.push({
      ...item.entry,
      label: item.label,
      baseLabel: item.entry.label,
      order: item.order,
      baseOrder: item.entry.order,
      permission: item.permission,
      hidden,
      overridden: item.overridden,
      version: item.version,
      depth,
    });
    for (const child of children.get(item.entry.id) ?? []) visit(child, depth + 1, hidden);
  };
  for (const root of roots) visit(root, 0, false);
  return resolved;
}

export type MenuVisibilityOptions = Readonly<{
  query: string;
  onlyModified: boolean;
  collapsedIds: ReadonlySet<string>;
}>;

/**
 * 计算表格可见行。
 *
 * - 搜索/仅显示已修改时过滤，但保留命中项的全部祖先（层级上下文）；
 * - 有筛选时忽略折叠状态（保证命中的深层项可见），无筛选时按折叠祖先隐藏；
 * - 过滤与折叠都不改变 hidden 覆盖（隐藏项仍显示，便于恢复）。
 */
export function selectVisibleMenuEntries<Entry extends MenuSearchableEntry>(
  entries: readonly Entry[],
  options: MenuVisibilityOptions,
): readonly Entry[] {
  const query = options.query.trim().toLocaleLowerCase();
  const filtering = query.length > 0 || options.onlyModified;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  if (filtering) {
    const matches = (entry: Entry) => {
      if (options.onlyModified && !entry.overridden) return false;
      if (query.length === 0) return true;
      const haystack = [
        entry.label,
        entry.routeId ?? '',
        entry.permission ?? '',
        entry.pattern ?? '',
      ];
      return haystack.some((value) => value.toLocaleLowerCase().includes(query));
    };
    const included = new Set<string>();
    for (const entry of entries) {
      if (!matches(entry)) continue;
      let cursor: Entry | undefined = entry;
      while (cursor !== undefined && !included.has(cursor.id)) {
        included.add(cursor.id);
        cursor = cursor.parentId === undefined ? undefined : byId.get(cursor.parentId);
      }
    }
    return entries.filter((entry) => included.has(entry.id));
  }

  const hiddenByCollapse = new Map<string, boolean>();
  const isCollapsedBelow = (entry: Entry): boolean => {
    const cached = hiddenByCollapse.get(entry.id);
    if (cached !== undefined) return cached;
    let cursor = entry.parentId === undefined ? undefined : byId.get(entry.parentId);
    let collapsed = false;
    while (cursor !== undefined) {
      if (options.collapsedIds.has(cursor.id)) {
        collapsed = true;
        break;
      }
      cursor = cursor.parentId === undefined ? undefined : byId.get(cursor.parentId);
    }
    hiddenByCollapse.set(entry.id, collapsed);
    return collapsed;
  };
  return entries.filter((entry) => !isCollapsedBelow(entry));
}
