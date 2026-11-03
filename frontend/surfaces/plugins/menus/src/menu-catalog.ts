/**
 * menus —— 从部署期路由目录（generated catalog）构建菜单树输入。
 *
 * 数据来源是 Plugin Route Registry 的生成物：Group Alias → Navigation Parent →
 * Navigation Child 与 File Route pattern。本模块不读取、不删除、不重写任何路由；
 * 只把注册表翻译成 overlay 的输入条目，交给 `applyMenuOverlay` 合并业务覆盖。
 */
import type { NavigationChild, NavigationParent, RouteCatalog } from '@clouddrive/plugin-framework';

import type { MenuOverlayEntry } from './menu-overlay';

export type MenuCatalogEntry = MenuOverlayEntry &
  Readonly<{
    /** 注册表 navigationId（分组没有）。 */
    navigationId?: string;
    /** 注册表语义 iconId（子菜单可能没有）。 */
    iconId?: string;
    /** 注册表路由地址；分组或纯展开父级为 null。 */
    pattern: string | null;
    /** 声明该菜单的 Plugin。 */
    pluginId?: string;
  }>;

const groupEntryId = (groupId: string) => `group:${groupId}`;
const navigationEntryId = (navigationId: string) => `nav:${navigationId}`;

const sortByOrder = <Item extends Readonly<{ order?: number }>>(items: readonly Item[]) =>
  [...items].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

/**
 * 构建菜单树输入（Group → Parent → Child 三级，顺序与注册表一致）。
 *
 * `translate` 由页面注入 i18n `t`；labelKey 来自注册表 contribution，
 * 因此标题始终是部署期真实注册标题，而不是本插件重复维护的文案。
 */
export function buildMenuCatalogEntries(
  catalog: RouteCatalog,
  translate: (key: string) => string,
): readonly MenuCatalogEntry[] {
  const patterns = new Map(catalog.routes.map((route) => [route.routeId, route.pattern]));
  const parentsByGroup = new Map<
    string,
    readonly { parent: NavigationParent; pluginId: string }[]
  >();
  for (const entry of catalog.contributions) {
    for (const parent of entry.contribution.parents) {
      const list = parentsByGroup.get(parent.groupId) ?? [];
      parentsByGroup.set(parent.groupId, [...list, { parent, pluginId: entry.pluginId }]);
    }
  }

  const entries: MenuCatalogEntry[] = [];
  const knownGroups = new Set<string>();
  const aliases = sortByOrder(catalog.aliases);

  const appendGroup = (groupId: string, label: string, order: number) => {
    const id = groupEntryId(groupId);
    knownGroups.add(groupId);
    entries.push({ id, kind: 'group', label, order, pattern: null });
  };

  for (const alias of aliases) {
    appendGroup(alias.groupId, translate(alias.labelKey), alias.order ?? 0);
  }

  const appendParent = (
    groupId: string,
    parent: NavigationParent,
    pluginId: string,
    children: readonly NavigationChild[],
  ) => {
    const id = navigationEntryId(parent.navigationId);
    const routeId = parent.routeId;
    entries.push({
      id,
      kind: 'menu',
      parentId: groupEntryId(groupId),
      ...(routeId !== undefined ? { routeId } : {}),
      label: translate(parent.labelKey),
      order: parent.order ?? 0,
      ...(parent.iconId !== undefined ? { iconId: parent.iconId } : {}),
      pattern: routeId === undefined ? null : (patterns.get(routeId) ?? null),
      navigationId: parent.navigationId,
      pluginId,
    });
    for (const child of sortByOrder(children)) {
      const childRouteId = child.routeId;
      entries.push({
        id: navigationEntryId(child.navigationId),
        kind: 'submenu',
        parentId: id,
        routeId: childRouteId,
        label: translate(child.labelKey),
        order: child.order ?? 0,
        ...(child.iconId !== undefined ? { iconId: child.iconId } : {}),
        pattern: patterns.get(childRouteId) ?? null,
        navigationId: child.navigationId,
        pluginId,
      });
    }
  };

  for (const alias of aliases) {
    const groupParents = parentsByGroup.get(alias.groupId) ?? [];
    const sortedParents = [...groupParents].sort(
      (left, right) => (left.parent.order ?? 0) - (right.parent.order ?? 0),
    );
    for (const { parent, pluginId } of sortedParents) {
      appendParent(alias.groupId, parent, pluginId, parent.children ?? []);
    }
  }

  // 注册表若有未登记 Alias 的 contribution（codegen gate 会拦截），仍保留条目，
  // 避免静默丢菜单；分组标题退化为 groupId。
  for (const [groupId, groupParents] of parentsByGroup) {
    if (knownGroups.has(groupId)) continue;
    appendGroup(groupId, groupId, Number.MAX_SAFE_INTEGER);
    const sortedParents = [...groupParents].sort(
      (left, right) => (left.parent.order ?? 0) - (right.parent.order ?? 0),
    );
    for (const { parent, pluginId } of sortedParents) {
      appendParent(groupId, parent, pluginId, parent.children ?? []);
    }
  }

  return entries;
}
