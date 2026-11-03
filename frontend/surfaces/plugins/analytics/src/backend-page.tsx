'use client';
import { useCallback } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { DashboardSummary } from '../../../src/administration/dashboard-summary';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
export function BackendAnalyticsPage() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.dashboard(), [port]));
  return (
    <Page>
      <PageHeader
        title={t('administration.analytics')}
        description={t('administration.description')}
      />
      <Action onPress={state.reload}>{t('administration.refresh')}</Action>
      <RemoteRegion {...state}>
        <DashboardSummary value={state.value} daily />
      </RemoteRegion>
    </Page>
  );
}
