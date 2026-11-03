'use client';

import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { StatusPill, type StatusTone } from '@clouddrive/ui-adapter/status-pill';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { useCommandsPort } from '@clouddrive/plugin-framework/commands';
import { route, RouteLink, usePluginNavigation } from '@clouddrive/plugin-framework/plugin';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useEffect } from 'react';

import type { ReferenceResource } from '../data';
import { useReferenceResources } from '../src/use-reference-resources';

const statusTone: Record<ReferenceResource['status'], StatusTone> = {
  active: 'success',
  draft: 'warning',
};

export default function ReferenceResourcesListPage() {
  const { t } = useFrontendTranslation();
  const { navigate } = usePluginNavigation();
  const commandsPort = useCommandsPort();
  const resources = useReferenceResources();

  // 命令注册（SET-006-006）：新建参考资源——命令菜单入口与页面按钮（PageHeader
  // action RouteLink）引用同一目标；页面级作用域，卸载注销。只依赖稳定 port；
  // t/navigate 在注册闭包内捕获（命令执行在用户触发时，非渲染期）。
  useEffect(() => {
    return commandsPort.registerCommand({
      id: 'reference-resources.new',
      label: t('referenceResources.list.create'),
      description: t('referenceResources.list.createCommandDescription'),
      scope: 'page',
      isAvailable: () => ({ available: true }),
      run: () => {
        void navigate(route('reference-resources.create'));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandsPort]);

  return (
    <Page>
      <PageHeader
        eyebrow={t('referenceResources.common.localDemo')}
        title={t('referenceResources.list.title')}
        description={t('referenceResources.list.description')}
        actions={
          <RouteLink target={route('reference-resources.create')}>
            {t('referenceResources.list.create')}
          </RouteLink>
        }
      />
      {resources.length === 0 ? (
        <Panel className="p-6 text-sm text-ink-muted">{t('referenceResources.list.empty')}</Panel>
      ) : (
        <ul className="grid gap-4">
          {resources.map((resource) => (
            <li className="rounded-panel border border-border bg-surface p-5" key={resource.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand">
                    {resource.id}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-ink">{resource.name}</h2>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">{resource.description}</p>
                </div>
                <StatusPill tone={statusTone[resource.status]}>
                  {t(`referenceResources.common.status.${resource.status}`)}
                </StatusPill>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <RouteLink
                  target={route('reference-resources.detail', {}, { query: { id: resource.id } })}
                >
                  {t('referenceResources.list.detail')}
                </RouteLink>
                <RouteLink
                  target={route('reference-resources.edit', {}, { query: { id: resource.id } })}
                >
                  {t('referenceResources.list.edit')}
                </RouteLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
