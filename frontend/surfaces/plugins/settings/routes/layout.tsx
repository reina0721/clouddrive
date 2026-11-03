'use client';

/**
 * settings —— 内页 Shell（SET-011 持久布局壳 + SET-012 复用主 Shell 路由内容动效）。
 *
 * Next App Router layout：跨 /settings 子路由 client 导航**不重挂载**——壳
 * （PageHeader、SettingsSidebar 顶部搜索 + 分组分类导航、失败横幅、偏好订阅）
 * 只在壳层装配一次；分类切换仅替换右侧 {children}。
 *
 * 内容动效（SET-012）：壳/内容显式分层——右侧内容容器标 `data-route-content`，
 * surface-foundation route-enter 编排对它（与主 Shell `.surface-page-stack` 并列）
 * 施加同一进入动效（fade+rise + 区段错峰 + forward 方向 + reduced/motion 降级），
 * 由 Host RouteTransition 同一门控触发；壳不在 `data-route-content` 内 → 不命中、
 * 静止持久。settings 不自建路由状态机或第二套 Motion。
 *
 * 结构：壳容器(section-gap 间距) > PageHeader(当前分类) + SettingsLayout
 * (左 SettingsSidebar + 右 SettingsContentFrame[banner 壳 + data-route-content{children}])。
 */
import { usePathname } from 'next/navigation';
import { Page } from '@clouddrive/surface-foundation/layout';
import { SettingsLayout } from '@clouddrive/surface-foundation/detail-settings';
import type { ReactNode } from 'react';

import {
  SettingsCategoryHeader,
  SettingsContentFrame,
  SettingsShellProvider,
  SettingsResponsiveNavigation,
  SettingsRestoreActions,
} from '../src/settings-layout-shell';
import {
  appearanceMeta,
  SETTINGS_CATEGORIES,
  type SettingsCategoryMeta,
} from '../src/settings-categories';
import { useSettingsPersistReport, useSettingsPreferences } from '../src/settings-hooks';

/** 由当前 pathname 解析活动分类（/settings → appearance；/settings/<shortId> → 对应）。 */
function resolveActiveMeta(pathname: string): SettingsCategoryMeta {
  const segment = pathname.replace(/^\/settings\/?/, '');
  if (segment === '') return appearanceMeta;
  const match = SETTINGS_CATEGORIES.find((meta) => meta.shortId === segment);
  return match ?? appearanceMeta;
}

export default function SettingsShellLayout({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const activeMeta = resolveActiveMeta(pathname);
  const preferences = useSettingsPreferences();
  const { banner, setLastResult, ctxFor } = useSettingsPersistReport();
  const ctx = ctxFor(preferences);

  return (
    <Page>
      {/* 壳：PageHeader 与 SettingsLayout 均不在 data-route-content 内 → route-enter 不命中、静止。 */}
      <SettingsCategoryHeader meta={activeMeta} />
      <SettingsLayout
        persistentNavigation
        navigation={<SettingsResponsiveNavigation meta={activeMeta} />}
      >
        <SettingsContentFrame banner={banner}>
          {/* 路由内容容器（SET-012）：随分类路由替换的内容区，走主 Shell 同源进入编排。 */}
          <div data-route-content>
            <Page>
              <SettingsShellProvider ctx={ctx}>{children}</SettingsShellProvider>
            </Page>
          </div>
          <SettingsRestoreActions meta={activeMeta} onResult={setLastResult} />
        </SettingsContentFrame>
      </SettingsLayout>
    </Page>
  );
}
