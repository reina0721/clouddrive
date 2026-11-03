'use client';

import {
  ShellNavigation,
  type NavigationPresenter,
  type RouterPort,
} from '@clouddrive/surface-foundation/shell-navigation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type { NavigationGroup } from '@clouddrive/types';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createElement } from 'react';

import { proceedAfterLeaveConfirm } from '../host/leave-confirm';
import { resolveScrollOption } from '../host/scroll-preference';
import { markForwardRouteIntent, pageTransitionTypes } from '../host/route-transition-constants';
import { useShellStore } from '../state/use-shell-store';
import { resolveNavigationIcon } from './navigation-icon-resolver';

export function NavigationTree({
  groups,
  compact = false,
  onNavigate,
  labelOverrides,
}: Readonly<{
  groups: readonly NavigationGroup[];
  compact?: boolean;
  onNavigate?: (() => void) | undefined;
  labelOverrides?: Readonly<Record<string, string>>;
}>) {
  const { t } = useFrontendTranslation();
  const currentPath = usePathname();
  const nextRouter = useRouter();
  // 导航 → 记住展开的侧栏菜单（menuMemory）：跨导航保留手动展开的菜单（默认关）。
  const menuMemory = useShellStore((state) => state.preferences.navigation.menuMemory);
  const router: RouterPort = {
    currentPath,
    renderLink: ({
      href,
      className,
      children,
      ariaLabel,
      title,
      current,
      onNavigate: onLinkNavigate,
    }) => (
      <Link
        className={className}
        href={href}
        aria-current={current ? 'page' : undefined}
        data-active={current || undefined}
        transitionTypes={[pageTransitionTypes.forward]}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        {...(title ? { title } : {})}
        onClick={(event) => {
          // 统一导航入口：先做 no-op 短路与离开确认（dirty 时弹窗），确认后才导航。
          // 取消 → preventDefault（路由/标签/进度不变）。确认后才执行关闭等副作用。
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();

          void proceedAfterLeaveConfirm(href, t('shell.primaryNav')).then((proceed) => {
            if (!proceed) {
              if (href === location.pathname + location.search + location.hash) onLinkNavigate?.();
              return;
            }
            onLinkNavigate?.();
            markForwardRouteIntent();
            void nextRouter.push(href, {
              transitionTypes: [pageTransitionTypes.forward],
              ...resolveScrollOption(),
            });
          });
        }}
      >
        {children}
      </Link>
    ),
  };
  const presenter: NavigationPresenter = {
    translate: (key, values) => labelOverrides?.[key] ?? (values ? t(key, values) : t(key)),
    icon: (iconId, active) =>
      createElement(resolveNavigationIcon(iconId), {
        className: 'size-full shrink-0',
        'aria-hidden': true,
        strokeWidth: active ? 2.3 : 1.9,
      }),
  };

  return (
    <ShellNavigation
      compact={compact}
      groups={groups}
      menuMemory={menuMemory}
      presenter={presenter}
      router={router}
      {...(onNavigate ? { onNavigate } : {})}
    />
  );
}
