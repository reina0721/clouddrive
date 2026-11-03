'use client';

import { BusyIndicator } from '@clouddrive/ui-adapter/busy-indicator';
import { LiveRegion, SkipLink } from '@clouddrive/ui-adapter/accessibility';
import { TabsView } from '@clouddrive/ui-adapter/data-display';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  RefreshCw,
  ShieldAlert,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import { ComponentPreview } from './component-preview';
import { UiElementsFamilyPage } from './family-page';

const uiElementsProgressValue = 64;
export function StatusAsyncPage() {
  const { t } = useFrontendTranslation();
  const [, setLastAction] = useState<string>();
  return (
    <UiElementsFamilyPage
      familyId="status-async"
      title={t('uiElements.statusTitle')}
      description={t('uiElements.statusDescription')}
    >
      {() => (
        <>
          <Section
            id="status-async"
            title={t('uiElements.statusTitle')}
            description={t('uiElements.statusDescription')}
          >
            <div data-reveal-items className="grid gap-4 p-5 lg:grid-cols-2">
              <ComponentPreview
                name="StatusPill"
                description={t('uiElements.catalog.statusDescription')}
                states={['Neutral', 'Success', 'Warning', 'Danger', 'Info']}
              >
                <div
                  aria-label={t('uiElements.statusTonesLabel')}
                  className="mt-4 flex flex-wrap gap-2"
                >
                  <StatusPill>{t('uiElements.defaultStatus')}</StatusPill>
                  <StatusPill tone="success">{t('uiElements.successStatus')}</StatusPill>
                  <StatusPill tone="warning">{t('uiElements.warningStatus')}</StatusPill>
                  <StatusPill tone="danger">{t('uiElements.dangerStatus')}</StatusPill>
                  <StatusPill tone="info">{t('uiElements.infoStatus')}</StatusPill>
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="ProgressMeter"
                description={t('uiElements.progressDescription')}
                states={['0%', '64%', '100%', 'Clamped', 'Accessible output']}
              >
                <div className="grid gap-4">
                  <ProgressMeter value={0} label={t('uiElements.catalog.progressQueued')} />
                  <ProgressMeter
                    value={uiElementsProgressValue}
                    label={t('uiElements.progressLabel')}
                  />
                  <ProgressMeter value={100} label={t('uiElements.catalog.progressComplete')} />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="BusyIndicator"
                description={t('uiElements.catalog.busyDescription')}
                states={['sm / md / lg', 'Icon only', 'Visible label', 'Reduced motion']}
              >
                <div className="flex flex-wrap items-center gap-6">
                  <BusyIndicator label={t('uiElements.busyLabel')} size="sm" />
                  <BusyIndicator label={t('uiElements.busyLabel')} showLabel />
                  <BusyIndicator label={t('uiElements.busyLabel')} showLabel size="lg" />
                </div>
              </ComponentPreview>
              <ComponentPreview
                name="Skeleton"
                description={t('uiElements.catalog.skeletonDescription')}
                states={['Text', 'Avatar', 'Card', 'aria-hidden', 'Busy composition']}
              >
                <div
                  aria-busy="true"
                  aria-label={t('uiElements.catalog.loadingPreview')}
                  className="flex items-center gap-3"
                  role="status"
                >
                  <Skeleton className="size-12 shrink-0 rounded-full" />
                  <div className="grid min-w-0 flex-1 gap-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </div>
              </ComponentPreview>
              <ComponentPreview
                fullWidth
                name="StateSurface"
                description={t('uiElements.catalog.stateSurfaceDescription')}
                states={[
                  'Loading',
                  'Empty',
                  'Error',
                  'Success',
                  'Warning',
                  'Disabled',
                  'Pending',
                  'Offline',
                  'Permission',
                ]}
              >
                <TabsView
                  label={t('uiElements.catalog.stateTabs')}
                  items={(
                    [
                      ['loading', <RefreshCw className="size-5" />],
                      ['empty', <Inbox className="size-5" />],
                      ['error', <XCircle className="size-5" />],
                      ['success', <CheckCircle2 className="size-5" />],
                      ['warning', <AlertTriangle className="size-5" />],
                      ['disabled', <ShieldAlert className="size-5" />],
                      ['pending', <RefreshCw className="size-5" />],
                      ['offline', <WifiOff className="size-5" />],
                      ['permission-denied', <ShieldAlert className="size-5" />],
                    ] as const
                  ).map(([state, icon]) => ({
                    id: state,
                    label: t(`productStates.${state}.title`),
                    content: (
                      <StateSurface
                        compact
                        state={state}
                        icon={icon}
                        title={t(`productStates.${state}.title`)}
                        description={t(`productStates.${state}.description`)}
                        {...(state === 'error'
                          ? {
                              actionLabel: t('productStates.retry'),
                              onAction: () => setLastAction(t('productStates.retry')),
                            }
                          : {})}
                      />
                    ),
                  }))}
                />
              </ComponentPreview>
              <ComponentPreview
                name="LiveRegion"
                description={t('uiElements.additional.liveRegion')}
                states={['Polite', 'Assertive', 'Atomic', 'Visible / sr-only']}
              >
                <LiveRegion visuallyHidden={false}>
                  {t('uiElements.additional.statusUpdated')}
                </LiveRegion>
              </ComponentPreview>
              <ComponentPreview
                name="SkipLink"
                description={t('uiElements.additional.skip')}
                states={['Keyboard focus', 'Semantic target', 'Reduced motion']}
              >
                <p className="text-sm text-ink-muted">
                  {t('uiElements.additional.skipHint')}
                  <SkipLink href="#status-async" label={t('uiElements.additional.skipLabel')} />
                </p>
              </ComponentPreview>
            </div>
          </Section>
        </>
      )}
    </UiElementsFamilyPage>
  );
}
