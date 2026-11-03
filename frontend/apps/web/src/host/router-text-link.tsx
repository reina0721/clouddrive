'use client';

import { TextLink, type TextLinkProps } from '@clouddrive/ui-adapter/navigation';
import { useRouter } from 'next/navigation';

import { useShellStore } from '../state/use-shell-store';
import { proceedAfterLeaveConfirm } from './leave-confirm';
import { markForwardRouteIntent, pageTransitionTypes } from './route-transition-constants';
import { resolveScrollOption } from './scroll-preference';

type RouterTextLinkProps = Omit<TextLinkProps, 'onNavigate'>;

export function RouterTextLink({ href, ...props }: RouterTextLinkProps) {
  const router = useRouter();
  // 新页面打开方式（导航偏好 newPageOpenMode，默认 current）：browser-tab →
  // 该入口在浏览器新标签打开（声明允许的 Host 链接；原生锚点语义保留
  // Ctrl/Cmd 点击/下载/外链）；current/page-tab → 应用内导航（page-tab 经顶部
  // 标签条记录）。
  const newPageOpenMode = useShellStore((state) => state.preferences.navigation.newPageOpenMode);
  if (newPageOpenMode === 'browser-tab') {
    return <TextLink {...props} external href={href} />;
  }
  return (
    <TextLink
      {...props}
      href={href}
      onNavigate={() => {
        // no-op 短路 + 离开确认前置：确认后才导航。
        void proceedAfterLeaveConfirm(href).then((proceed) => {
          if (!proceed) return;
          markForwardRouteIntent();
          void router.push(href, {
            transitionTypes: [pageTransitionTypes.forward],
            ...resolveScrollOption(),
          });
        });
      }}
    />
  );
}
