'use client';

import { BulkActionBar, Collection } from '@clouddrive/surface-foundation/collection';
import {
  EntitySummary,
  SettingsLayout,
  Timeline,
} from '@clouddrive/surface-foundation/detail-settings';
import { FormActions, FormStatus } from '@clouddrive/surface-foundation/form-actions';
import {
  FilterBar,
  Page,
  PageHeader,
  Section,
  Toolbar,
} from '@clouddrive/surface-foundation/layout';
import { OperationStatus, StateRegion } from '@clouddrive/surface-foundation/states-operations';
import { Action } from '@clouddrive/ui-adapter/action';
import { FormErrorSummary } from '@clouddrive/ui-adapter/form-error-summary';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { StepNavigation } from '@clouddrive/ui-adapter/step-navigation';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { CheckboxField, TextField } from '@clouddrive/ui-adapter/form-field';
import { CheckCircle2 } from 'lucide-react';

export type PagePatternKind =
  | 'layout-navigation'
  | 'collections-data'
  | 'forms-actions'
  | 'states-feedback'
  | 'detail-settings';

export function PagePatternCatalog({ kind }: Readonly<{ kind: PagePatternKind }>) {
  const { t } = useFrontendTranslation();
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [archived, setArchived] = useState<readonly string[]>([]);
  const titleKey = {
    'layout-navigation': 'layoutNavigation',
    'collections-data': 'collectionsData',
    'forms-actions': 'formsActions',
    'states-feedback': 'statesFeedback',
    'detail-settings': 'detailSettings',
  }[kind];
  return (
    <Page>
      <PageHeader
        eyebrow={t('pagePatterns.content.example1')}
        title={t(`pagePatterns.nav.${titleKey}`)}
        description={t('pagePatterns.content.example2')}
      />
      {notice ? (
        <p role="status" className="text-sm text-ink-muted">
          {notice}
        </p>
      ) : null}
      {kind === 'layout-navigation' ? (
        <Section title={t('pagePatterns.content.example3')}>
          <div data-reveal-items className="grid gap-5 p-5">
            <Toolbar
              label={t('pagePatterns.content.example4')}
              primary={
                <Action onPress={() => setNotice(t('pagePatterns.content.primaryDone'))}>
                  {t('pagePatterns.content.example25')}
                </Action>
              }
              secondary={
                <Action variant="quiet" onPress={() => setNotice('')}>
                  {t('pagePatterns.content.secondary')}
                </Action>
              }
            />
            <StepNavigation
              label={t('pagePatterns.content.example5')}
              items={[
                { id: 'one', label: t('pagePatterns.content.example33'), state: 'complete' },
                { id: 'two', label: t('pagePatterns.content.example34'), state: 'current' },
                { id: 'three', label: t('pagePatterns.content.example35') },
              ]}
            />
          </div>
        </Section>
      ) : kind === 'collections-data' ? (
        <div className="space-y-4">
          <Collection
            title={t('pagePatterns.content.example6')}
            filters={
              <FilterBar>
                <span>{t('pagePatterns.content.example26')}</span>
                <span>{t('pagePatterns.content.example27')}</span>
              </FilterBar>
            }
            content={
              <div className="p-5 text-sm text-ink-muted">
                {['one', 'two', 'three']
                  .filter((id) => !archived.includes(id))
                  .map((id) => (
                    <CheckboxField
                      key={id}
                      label={t('pagePatterns.content.record', { id })}
                      checked={selected.includes(id)}
                      onCheckedChange={(checked) =>
                        setSelected((ids) =>
                          checked ? [...ids, id] : ids.filter((value) => value !== id),
                        )
                      }
                    />
                  ))}
              </div>
            }
          />
          <BulkActionBar
            actions={
              <Action
                size="sm"
                disabled={selected.length === 0}
                onPress={() => {
                  setArchived((ids) => [...ids, ...selected]);
                  setSelected([]);
                }}
              >
                {t('pagePatterns.content.archive')}
              </Action>
            }
            clearLabel={t('pagePatterns.content.example7')}
            onClear={() => setSelected([])}
            selectionLabel={t('pagePatterns.content.selected', { count: selected.length })}
          />
        </div>
      ) : kind === 'forms-actions' ? (
        <div data-reveal-items className="space-y-5">
          <div id="pattern-name">
            <TextField
              label={t('pagePatterns.content.name')}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </div>
          <FormErrorSummary
            title={t('pagePatterns.content.fixErrors')}
            errors={
              invalid
                ? [
                    {
                      fieldId: 'pattern-name',
                      label: t('pagePatterns.content.name'),
                      message: t('pagePatterns.content.required'),
                    },
                  ]
                : []
            }
          />
          <FormActions
            primary={
              <Action
                onPress={() => {
                  if (!name.trim()) {
                    setInvalid(true);
                    return;
                  }
                  setInvalid(false);
                  setSavedName(name.trim());
                  setNotice(t('pagePatterns.content.saved'));
                }}
              >
                {t('pagePatterns.content.example28')}
              </Action>
            }
            secondary={
              <Action
                variant="quiet"
                onPress={() => {
                  setName(savedName);
                  setInvalid(false);
                  setNotice('');
                }}
              >
                {t('pagePatterns.content.cancel')}
              </Action>
            }
            summary={
              <FormStatus
                lifecycle={invalid ? 'invalid' : name !== savedName ? 'dirty' : 'pristine'}
                labels={{
                  pristine: t('pagePatterns.content.example37'),
                  dirty: t('pagePatterns.content.example38'),
                  submitting: t('pagePatterns.content.example39'),
                  submitted: t('pagePatterns.content.example37'),
                  invalid: t('pagePatterns.content.example40'),
                }}
              />
            }
          />
        </div>
      ) : kind === 'states-feedback' ? (
        <div className="grid gap-5">
          <StateRegion
            content={
              <Panel className="p-5 text-sm text-ink">{t('pagePatterns.content.example29')}</Panel>
            }
            denied={
              <StateSurface
                compact
                description={t('pagePatterns.content.example8')}
                icon={<CheckCircle2 className="size-5" />}
                state="permission-denied"
                title={t('pagePatterns.content.example9')}
              />
            }
            empty={
              <StateSurface
                compact
                description={t('pagePatterns.content.example10')}
                icon={<CheckCircle2 className="size-5" />}
                state="empty"
                title={t('pagePatterns.content.example11')}
              />
            }
            error={
              <StateSurface
                compact
                description={t('pagePatterns.content.example12')}
                icon={<CheckCircle2 className="size-5" />}
                state="error"
                title={t('pagePatterns.content.example13')}
              />
            }
            refreshing={
              <Panel className="p-3 text-sm text-info">
                Existing content remains while refreshing.
              </Panel>
            }
            label={t('pagePatterns.content.example14')}
            loading={
              <StateSurface
                compact
                description={t('pagePatterns.content.example15')}
                icon={<CheckCircle2 className="size-5" />}
                state="loading"
                title={t('pagePatterns.content.example16')}
              />
            }
            partialNotice={
              <Panel className="p-3 text-sm text-warning">
                {t('pagePatterns.content.example30')}
              </Panel>
            }
            pending={
              <StateSurface
                compact
                description={t('pagePatterns.content.example17')}
                icon={<CheckCircle2 className="size-5" />}
                state="pending"
                title={t('pagePatterns.content.example18')}
              />
            }
            readonlyNotice={
              <Panel className="p-3 text-sm text-info">{t('pagePatterns.content.example31')}</Panel>
            }
            state="partial"
          />
          <OperationStatus
            state="running"
            title={t('pagePatterns.content.example19')}
            description={t('pagePatterns.content.example20')}
            icon={<CheckCircle2 className="size-5" />}
            progress={48}
            progressLabel={t('pagePatterns.content.example21')}
          />
        </div>
      ) : (
        <SettingsLayout
          persistentNavigation
          navigation={
            <Panel className="p-4 text-sm text-ink-muted">
              {t('pagePatterns.content.example32')}
            </Panel>
          }
        >
          <EntitySummary
            title={t('pagePatterns.content.example22')}
            description={t('pagePatterns.content.example23')}
          />
          <Section title={t('pagePatterns.content.example24')}>
            <div className="p-5">
              <Timeline
                label={t('pagePatterns.content.example24')}
                items={[{ id: 'one', title: t('pagePatterns.content.example36'), tone: 'success' }]}
              />
            </div>
          </Section>
        </SettingsLayout>
      )}
    </Page>
  );
}
