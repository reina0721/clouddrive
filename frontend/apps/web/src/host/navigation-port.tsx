'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PluginNavigationProvider,
  type PluginPortLinkProps,
} from '@clouddrive/plugin-framework/plugin';

import { proceedAfterLeaveConfirm } from './leave-confirm';
import { markForwardRouteIntent, pageTransitionTypes } from './route-transition-constants';
import { focusRouteAnchor } from './anchor-focus';
import { resolveScrollOption } from './scroll-preference';

/**
 * Host Navigation Port —— 唯一的 Router 接入点。
 *
 * 由 Composition Root 一次性安装；Plugin 通过 usePluginNavigation/RouteLink
 * 间接导航，绝不直接使用 Next Link/Router 或全局 location。
 * resolveHref 使用真实 Registry（由 AppShell 以 targetResolver 注入）——本模块
 * 只接收已解析的 href 委托 Next router。所有导航入口统一过
 * proceedAfterLeaveConfirm（no-op 短路 + 离开确认前置）。
 */

export type HostNavigationPortProps = Readonly<{
  /** 把 routeId 解析为 href；抛错保持失败语义。 */
  resolveHref: (
    target: Readonly<{ routeId: string; params: Readonly<Record<string, string>> }>,
  ) => string;
  children: ReactNode;
}>;

export function HostNavigationPortProvider({ resolveHref, children }: HostNavigationPortProps) {
  const router = useRouter();

  const renderLink = (props: PluginPortLinkProps) => {
    let classes = props.className;
    if (props.presentation === 'action') {
      const variant = props.variant ?? 'primary';
      const size = props.size ?? 'md';
      const sizeClasses =
        size === 'lg'
          ? 'h-control-lg gap-2.5 px-5 text-base'
          : size === 'sm'
            ? 'h-control-sm gap-1.5 px-3 text-sm'
            : 'h-control gap-2 px-4 text-sm';
      const variantClasses =
        variant === 'secondary'
          ? 'border border-border bg-surface text-ink shadow-sm hover:bg-surface-muted'
          : variant === 'quiet'
            ? 'bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink'
            : variant === 'danger'
              ? 'bg-danger text-on-danger shadow-sm hover:brightness-95'
              : 'bg-brand text-on-brand shadow-sm hover:bg-brand-strong';
      classes = [
        'inline-flex items-center justify-center rounded-control font-semibold outline-none transition-colors select-none',
        sizeClasses,
        variantClasses,
        props.className,
      ]
        .filter(Boolean)
        .join(' ');
    }

    const content =
      props.presentation === 'action' && (props.leadingIcon || props.trailingIcon) ? (
        <>
          {props.leadingIcon ? (
            <span
              aria-hidden="true"
              className="grid size-icon-sm shrink-0 place-items-center text-current [&>svg]:m-0"
            >
              {props.leadingIcon}
            </span>
          ) : null}
          <span>{props.children}</span>
          {props.trailingIcon ? (
            <span
              aria-hidden="true"
              className="grid size-icon-sm shrink-0 place-items-center text-current [&>svg]:m-0"
            >
              {props.trailingIcon}
            </span>
          ) : null}
        </>
      ) : (
        props.children
      );

    return (
      <Link
        className={classes}
        href={props.href}
        transitionTypes={[pageTransitionTypes.forward]}
        {...(props.ariaLabel ? { 'aria-label': props.ariaLabel } : {})}
        {...(props.title ? { title: props.title } : {})}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();

          void proceedAfterLeaveConfirm(props.href, 'plugin navigation').then((proceed) => {
            if (!proceed) {
              if (props.href === location.pathname + location.search + location.hash) {
                props.onNavigate?.();
                focusRouteAnchor(props.href);
              }
              return;
            }
            props.onNavigate?.();
            focusRouteAnchor(props.href, resolveScrollOption() === undefined);
            markForwardRouteIntent();
            void router.push(props.href, {
              transitionTypes: [pageTransitionTypes.forward],
              ...resolveScrollOption(),
              ...(props.target.fragment ? { scroll: false } : {}),
            });
          });
        }}
      >
        {content}
      </Link>
    );
  };

  return (
    <PluginNavigationProvider
      port={{
        resolveHref: (target) => resolveHref(target),
        navigate: (href) => {
          void proceedAfterLeaveConfirm(href, 'plugin navigation').then((proceed) => {
            if (!proceed) return;
            focusRouteAnchor(href, resolveScrollOption() === undefined);
            markForwardRouteIntent();
            void router.push(href, {
              transitionTypes: [pageTransitionTypes.forward],
              ...resolveScrollOption(),
              ...(href.includes('#') ? { scroll: false } : {}),
            });
          });
        },
        replace: (href) => {
          void proceedAfterLeaveConfirm(href, 'plugin navigation').then((proceed) => {
            if (!proceed) return;
            focusRouteAnchor(href, resolveScrollOption() === undefined);
            markForwardRouteIntent();
            void router.replace(href, {
              transitionTypes: [pageTransitionTypes.forward],
              ...resolveScrollOption(),
              ...(href.includes('#') ? { scroll: false } : {}),
            });
          });
        },
        renderLink,
      }}
    >
      {children}
    </PluginNavigationProvider>
  );
}
