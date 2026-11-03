'use client';

import { BusyIndicator } from '@clouddrive/ui-adapter/busy-indicator';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import type { ProductState } from '@clouddrive/types';
import {
  Ban,
  CheckCircle2,
  Clock3,
  CloudOff,
  Inbox,
  LockKeyhole,
  OctagonAlert,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';

import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';

const stateDefinitions = [
  { id: 'empty', icon: Inbox },
  { id: 'error', icon: OctagonAlert },
  { id: 'success', icon: CheckCircle2 },
  { id: 'warning', icon: TriangleAlert },
  { id: 'disabled', icon: Ban },
  { id: 'pending', icon: Clock3 },
  { id: 'offline', icon: CloudOff },
  { id: 'permission-denied', icon: LockKeyhole },
] as const satisfies readonly { id: ProductState; icon: typeof Inbox }[];

export default function StatesPage() {
  const { t } = useFrontendTranslation();
  const [errorRecovered, setErrorRecovered] = useState(false);

  return (
    <Page>
      <PageHeader
        eyebrow={t('productStates.eyebrow')}
        title={t('productStates.title')}
        description={t('productStates.description')}
      />
      <div data-reveal-items className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel aria-busy="true" aria-label={t('productStates.loading.title')} className="p-5">
          <div className="flex items-center gap-3 text-info">
            <BusyIndicator label={t('productStates.loading.title')} showLabel />
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            {t('productStates.loading.description')}
          </p>
          <div className="mt-5 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Panel>
        {stateDefinitions.map(({ id, icon: Icon }) => {
          const recovered = id === 'error' && errorRecovered;
          const DisplayIcon = recovered ? CheckCircle2 : Icon;
          const displayedState = recovered ? 'success' : id;
          const translationKey = recovered ? 'recovered' : id;

          return (
            <Panel key={id}>
              <StateSurface
                compact
                state={displayedState}
                icon={<DisplayIcon className="size-5" />}
                title={t(`productStates.${translationKey}.title`)}
                description={t(`productStates.${translationKey}.description`)}
                announcement={recovered ? 'polite' : 'none'}
                {...(id === 'error' && !recovered
                  ? {
                      actionLabel: t('productStates.retry'),
                      onAction: () => setErrorRecovered(true),
                    }
                  : {})}
              />
            </Panel>
          );
        })}
      </div>
    </Page>
  );
}
