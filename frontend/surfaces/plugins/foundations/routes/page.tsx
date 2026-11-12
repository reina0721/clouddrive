'use client';

import { Card, CardContent } from '@clouddrive/ui-adapter/card';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { AppWindow, Braces, Component, ShieldCheck } from 'lucide-react';
import { FrontendMessages, useFrontendTranslation } from '@clouddrive/i18n';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { useWorkbenchPort } from '@clouddrive/plugin-framework/workbench';
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { Preferences } from '@clouddrive/surface/preferences-model';

import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';

import { foundationMessages } from '../src-messages';

function PageMessagesExample() {
  const { t } = useFrontendTranslation();
  return (
    <Panel className="p-5">
      <h2 className="text-sm font-bold text-ink">{t('foundationMessages.title')}</h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{t('foundationMessages.description')}</p>
    </Panel>
  );
}

const layers = [
  { id: 'stable', icon: Braces, tone: 'bg-success-soft text-success' },
  { id: 'application', icon: Component, tone: 'bg-info-soft text-info' },
  { id: 'hosts', icon: AppWindow, tone: 'bg-brand-soft text-brand' },
] as const;

export default function FoundationsPage() {
  const { t } = useFrontendTranslation();
  const preferencesPort = usePreferencesPort<Preferences>();
  const workbenchPort = useWorkbenchPort();
  // 订阅工作台（最近/收藏）：store 数组引用在变更前稳定，适合 useSyncExternalStore。
  const recents = useSyncExternalStore(
    (onChange) => workbenchPort.subscribe(onChange),
    () => workbenchPort.listRecents(),
    () => workbenchPort.listRecents(),
  );
  const favorites = useSyncExternalStore(
    (onChange) => workbenchPort.subscribe(onChange),
    () => workbenchPort.listFavorites(),
    () => workbenchPort.listFavorites(),
  );
  const showRecents = preferencesPort.getSnapshot().navigation.showRecents;
  const showWorkbench = showRecents && recents.length > 0;
  const showFavorites = favorites.length > 0;
  return (
    <Page>
      <PageHeader
        eyebrow={t('foundations.eyebrow')}
        title={t('foundations.title')}
        description={t('foundations.description')}
        actions={<StatusPill tone="success">Executable boundaries</StatusPill>}
      />
      {(showWorkbench || showFavorites) && (
        <div data-reveal-items className="grid gap-4 xl:grid-cols-3">
          {showFavorites ? (
            <Panel className="p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-muted">
                {t('foundations.favoritesTitle')}
              </h2>
              <ul data-reveal-items className="mt-3 flex flex-col gap-1">
                {favorites.map((favorite) => (
                  <li key={favorite.pathname}>
                    <Link
                      className="inline-flex text-sm font-semibold text-brand hover:underline"
                      href={favorite.pathname}
                    >
                      {favorite.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
          {showWorkbench ? (
            <Panel className="p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-muted">
                {t('foundations.recentsTitle')}
              </h2>
              <ul data-reveal-items className="mt-3 flex flex-col gap-1">
                {recents.slice(0, 6).map((recent) => (
                  <li key={recent.pathname}>
                    <Link
                      className="inline-flex text-sm font-semibold text-brand hover:underline"
                      href={recent.pathname}
                    >
                      {recent.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      )}
      <div data-reveal-items className="grid gap-4 lg:grid-cols-2">
        {layers.map(({ id, icon: Icon, tone }, index) => (
          <Card key={id}>
            <CardContent>
              <div className="relative">
                <span className="absolute right-0 top-0 text-5xl font-black text-ink/5">
                  0{index + 1}
                </span>
                <span className={`grid size-11 place-items-center rounded-control ${tone}`}>
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-5 text-lg font-bold text-ink">{t(`foundations.layers.${id}`)}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
                  {t(`foundations.layers.${id}Description`)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <FrontendMessages resources={foundationMessages}>
        <PageMessagesExample />
      </FrontendMessages>
      <div data-reveal-items className="grid gap-6 xl:grid-cols-3">
        <Panel className="p-5 sm:p-6 xl:col-span-2" tone="brand">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-control bg-surface text-brand shadow-sm">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">{t('foundations.directUse')}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                {t('foundations.directUseDescription')}
              </p>
            </div>
          </div>
        </Panel>
        <Panel className="p-5 sm:p-6">
          <h2 className="text-lg font-bold text-ink">{t('foundations.rulesTitle')}</h2>
          <ol data-reveal-items className="mt-4 space-y-3">
            {['first', 'second', 'third', 'fourth'].map((rule, index) => (
              <li key={rule} className="flex gap-3 text-sm leading-6 text-ink-muted">
                <span className="font-bold text-brand">{index + 1}.</span>
                <span>{t(`foundations.rules.${rule}`)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </Page>
  );
}
