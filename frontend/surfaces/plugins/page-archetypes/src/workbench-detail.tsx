import { formatDate, useFrontendTranslation } from '@clouddrive/i18n';
import { usePluginLocale } from '@clouddrive/plugin-framework/plugin';
import { SectionBody } from '@clouddrive/surface-foundation/layout';
import { TabsView } from '@clouddrive/ui-adapter/data-display';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { UserIdentity } from '@clouddrive/ui-adapter/identity';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { StatusPill, type StatusTone } from '@clouddrive/ui-adapter/status-pill';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ReferenceRecord, ReferenceStatus } from './reference-scenarios';
const statusTone: Record<ReferenceStatus, StatusTone> = {
  healthy: 'success',
  attention: 'warning',
  paused: 'neutral',
};
export function WorkbenchDetail({
  selectedRecord,
  embedded = false,
}: Readonly<{ selectedRecord: ReferenceRecord | undefined; embedded?: boolean }>) {
  const { t } = useFrontendTranslation();
  const locale = usePluginLocale().locale;
  return (
    <Panel appearance={embedded ? 'embedded' : 'outlined'} className="overflow-hidden">
      {selectedRecord ? (
        <>
          <div data-reveal-item className="border-b border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">
                  {selectedRecord.id}
                </p>
                <h2 className="mt-2 text-lg font-bold text-ink">{selectedRecord.name}</h2>
              </div>
              <div className="shrink-0">
                <StatusPill tone={statusTone[selectedRecord.status]}>
                  {t(`reference.status.${selectedRecord.status}`)}
                </StatusPill>
              </div>
            </div>
          </div>
          <SectionBody>
            <TabsView
              label={t('reference.detailTabsLabel')}
              variant="section"
              items={[
                {
                  id: 'summary',
                  label: t('reference.tabs.summary'),
                  content: (
                    <div className="space-y-5 text-sm leading-6 text-ink-muted">
                      <p>{t('reference.recordDescription')}</p>
                      <DescriptionList
                        label={t('reference.detailTabsLabel')}
                        items={[
                          {
                            id: 'owner',
                            term: t('reference.columns.owner'),
                            description: (
                              <UserIdentity
                                description={t(`reference.region.${selectedRecord.region}`)}
                                name={selectedRecord.owner}
                              />
                            ),
                          },
                          {
                            id: 'updated',
                            term: t('reference.columns.updated'),
                            description: formatDate(locale, selectedRecord.updatedAt, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  id: 'activity',
                  label: t('reference.tabs.activity'),
                  content: (
                    <ol data-reveal-items className="space-y-3">
                      {[0, 1, 2].map((item) => (
                        <li className="flex gap-3 text-sm" key={item}>
                          <RefreshCw className="mt-0.5 size-4 shrink-0 text-info" />
                          <span className="leading-6 text-ink-muted">
                            {t('reference.activityItem', { number: item + 1 })}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ),
                },
                {
                  id: 'risk',
                  label: t('reference.tabs.risk'),
                  content: (
                    <div className="flex gap-3 rounded-control bg-warning-soft p-3 text-warning">
                      <AlertTriangle className="size-4 shrink-0" />
                      <p className="text-sm leading-6">{t('reference.riskDescription')}</p>
                    </div>
                  ),
                },
              ]}
            />
          </SectionBody>
        </>
      ) : null}
    </Panel>
  );
}
