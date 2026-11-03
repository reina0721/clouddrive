'use client';

import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { StatusPill, type StatusTone } from '@clouddrive/ui-adapter/status-pill';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { useNotificationsPort } from '@clouddrive/plugin-framework/notifications';
import { useWorkbenchPort } from '@clouddrive/plugin-framework/workbench';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { Star } from 'lucide-react';
import { useSyncExternalStore, useState } from 'react';

import { useReferenceResources } from '../../src/use-reference-resources';
import { copyResourceId } from '../../src/browser-clipboard';
import { useSearchParams } from 'next/navigation';
import type { ReferenceResource } from '../../data';

const statusTone: Record<ReferenceResource['status'], StatusTone> = {
  active: 'success',
  draft: 'warning',
};

export default function ReferenceResourcesDetailPage() {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const preferencesPort = usePreferencesPort<Preferences>();
  const notifications = useNotificationsPort();
  const id = useSearchParams().get('id');
  const resource = useReferenceResources().find((item) => item.id === id);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // 面包屑（导航偏好 breadcrumbs，默认开）：canonical hierarchy 列表 → 详情。
  const breadcrumbsOn = preferencesPort.getSnapshot().navigation.breadcrumbs;
  // 详情展示模式（操作偏好 detailMode/expandDetailInfo，默认 compact/关）：
  // full → 附加信息始终展示；compact + expandDetailInfo → 展开附加信息；
  // compact + 关 → 仅关键信息（简洁模式）。
  const detailMode = preferencesPort.getSnapshot().actionPreferences.detailMode;
  const expandDetailInfo = preferencesPort.getSnapshot().actionPreferences.expandDetailInfo;
  const showDetailInfo = detailMode === 'full' || expandDetailInfo;
  // 收藏（工作台 Port）：首页"收藏"区段的真实数据来源。
  const workbenchPort = useWorkbenchPort();
  const favoritePath = `/reference-resources/detail?id=${encodeURIComponent(id ?? '')}`;
  const isFavorite = useSyncExternalStore(
    (onChange) => workbenchPort.subscribe(onChange),
    () => workbenchPort.isFavorite(favoritePath),
    () => workbenchPort.isFavorite(favoritePath),
  );
  const toggleFavorite = () => {
    workbenchPort.toggleFavorite({
      pathname: favoritePath,
      title: resource?.name ?? t('referenceResources.detail.title'),
    });
  };

  const copyId = async () => {
    if (!resource) return;
    setCopyFailed(false);
    try {
      await copyResourceId(resource.id);
    } catch {
      setCopyFailed(true);
      return;
    }
    // 复制后反馈（操作偏好 copyFeedback，默认开）：真实复制成功 → 提示。
    if (preferencesPort.getSnapshot().actionPreferences.copyFeedback) {
      notify({ title: t('referenceResources.detail.copyFeedbackTitle'), tone: 'success' });
      // 收纳非关键通知（通知偏好 collectNonCriticalToCenter，默认开）：非关键
      // 成功反馈同时进通知中心；关 → 仅 toast。
      if (preferencesPort.getSnapshot().notifications.collectNonCriticalToCenter) {
        notifications.publish({
          category: 'success',
          severity: 'info',
          title: t('referenceResources.detail.copyFeedbackTitle'),
          description: t('referenceResources.detail.copyFeedbackDescription'),
        });
      }
    }
    setCopied(true);
  };

  return (
    <Page>
      {copyFailed ? (
        <p role="alert" className="text-danger">
          {t('referenceResources.detail.copyFailed')}
        </p>
      ) : null}
      <PageHeader
        {...(breadcrumbsOn
          ? {
              breadcrumbLabel: t('referenceResources.common.breadcrumbLabel'),
              breadcrumbs: [
                {
                  label: t('referenceResources.nav.root'),
                  content: (
                    <RouteLink target={route('reference-resources')}>
                      {t('referenceResources.nav.root')}
                    </RouteLink>
                  ),
                },
                { label: t('referenceResources.detail.title'), current: true },
              ],
            }
          : {})}
        eyebrow={t('referenceResources.common.localDemo')}
        title={t('referenceResources.detail.title')}
        description={t('referenceResources.detail.description')}
        actions={
          <>
            {resource ? (
              <IconAction
                label={t(
                  isFavorite
                    ? 'referenceResources.detail.removeFavorite'
                    : 'referenceResources.detail.addFavorite',
                )}
                onPress={toggleFavorite}
              >
                <Star
                  aria-hidden="true"
                  className={isFavorite ? 'size-4 fill-brand text-brand' : 'size-4'}
                />
              </IconAction>
            ) : null}
            {resource ? (
              <Action disabled={copied} onPress={() => void copyId()} variant="secondary">
                {copied
                  ? t('referenceResources.detail.copied')
                  : t('referenceResources.detail.copyId')}
              </Action>
            ) : null}
            <RouteLink target={route('reference-resources')}>
              {t('referenceResources.detail.back')}
            </RouteLink>
          </>
        }
      />
      {resource ? (
        <Panel className="overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-brand">{resource.id}</p>
              <h2 className="mt-1 text-lg font-bold text-ink">{resource.name}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{resource.description}</p>
            </div>
            <StatusPill tone={statusTone[resource.status]}>
              {t(`referenceResources.common.status.${resource.status}`)}
            </StatusPill>
          </div>
          <div className="p-5">
            <DescriptionList
              label={t('referenceResources.detail.title')}
              items={[
                {
                  id: 'kind',
                  term: t('referenceResources.common.kind'),
                  description: t(`referenceResources.common.${resource.kind}`),
                },
                {
                  id: 'status',
                  term: t('referenceResources.common.statusLabel'),
                  description: t(`referenceResources.common.status.${resource.status}`),
                },
              ]}
            />
            {showDetailInfo ? (
              <div className="mt-5 border-t border-border pt-5">
                <DescriptionList
                  label={t('referenceResources.detail.additionalLabel')}
                  items={[
                    {
                      id: 'resourceId',
                      term: t('referenceResources.detail.resourceId'),
                      description: resource.id,
                    },
                    {
                      id: 'fullDescription',
                      term: t('referenceResources.detail.fullDescription'),
                      description: resource.description,
                    },
                  ]}
                />
              </div>
            ) : null}
          </div>
          <div className="flex justify-end border-t border-border p-4">
            <RouteLink
              target={route('reference-resources.edit', {}, { query: { id: resource.id } })}
            >
              {t('referenceResources.detail.edit')}
            </RouteLink>
          </div>
        </Panel>
      ) : (
        <Panel className="p-6 text-sm text-ink-muted">
          {t('referenceResources.common.notFound')}. {t('referenceResources.common.invalidId')}
        </Panel>
      )}
    </Page>
  );
}
