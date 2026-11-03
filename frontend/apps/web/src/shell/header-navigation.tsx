'use client';

import { flattenNavigationLeaves } from '@clouddrive/core';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type { NavigationGroup, NavigationNode } from '@clouddrive/types';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { proceedAfterLeaveConfirm } from '../host/leave-confirm';
import { markForwardRouteIntent, pageTransitionTypes } from '../host/route-transition-constants';
import { resolveScrollOption } from '../host/scroll-preference';

/**
 * 顶部导航（horizontal / mixed）。
 *
 * - 只重组既有导航模型（同一 NavigationGroup / routeId / 权限过滤结果），不建立
 *   第二套导航真相；叶子仍走 Next Router + 离开确认 + 方向过渡。
 * - horizontal：每个分组是一个可展开菜单（单叶分组直接跳转）；
 * - mixed：分组是切换按钮，侧栏显示当前分组的下级菜单。
 * - 键盘与焦点由 HeroUI MenuButton / 原生 button 承担，不自行实现 Overlay。
 */
export function HeaderNavigation({
  groups,
  mode,
  activeGroupId,
  onGroupSelect,
}: Readonly<{
  groups: readonly NavigationGroup[];
  mode: 'horizontal' | 'mixed';
  activeGroupId: string | null;
  onGroupSelect?: (groupId: string) => void;
}>) {
  const { t } = useFrontendTranslation();
  const router = useRouter();
  const leavesByGroup = useMemo(
    () =>
      groups.map((group) => ({
        group,
        leaves: flattenNavigationLeaves(group.items as readonly NavigationNode[]).map(
          ({ leaf }) => ({
            href: leaf.href,
            label: t(leaf.labelKey),
          }),
        ),
      })),
    [groups, t],
  );

  const navigate = (href: string) => {
    void proceedAfterLeaveConfirm(href, t('shell.primaryNav')).then((proceed) => {
      if (!proceed) return;
      markForwardRouteIntent();
      void router.push(href, {
        transitionTypes: [pageTransitionTypes.forward],
        ...resolveScrollOption(),
      });
    });
  };

  return (
    <nav aria-label={t('shell.layout.groups')} className="flex min-w-0 items-center gap-1">
      {leavesByGroup.map(({ group, leaves }) => {
        if (mode === 'mixed') {
          const active = group.id === activeGroupId;
          return (
            <button
              aria-current={active ? 'true' : undefined}
              className={`inline-flex h-control items-center rounded-control px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring ${
                active
                  ? 'bg-brand/10 text-brand'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`}
              key={group.id}
              type="button"
              onClick={() => onGroupSelect?.(group.id)}
            >
              {t(group.labelKey)}
            </button>
          );
        }
        if (leaves.length === 0) return null;
        if (leaves.length === 1) {
          const only = leaves[0]!;
          return (
            <button
              className="inline-flex h-control items-center rounded-control px-3 text-sm font-semibold text-ink-muted outline-none transition-colors hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-focus-ring"
              key={group.id}
              type="button"
              onClick={() => navigate(only.href)}
            >
              {t(group.labelKey)}
            </button>
          );
        }
        return (
          <MenuButton
            ariaLabel={t(group.labelKey)}
            items={leaves.map((leaf) => ({ id: leaf.href, label: leaf.label }))}
            key={group.id}
            label={t(group.labelKey)}
            onAction={navigate}
          />
        );
      })}
    </nav>
  );
}
