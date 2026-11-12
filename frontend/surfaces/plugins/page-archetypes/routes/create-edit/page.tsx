'use client';

import {
  FoundationControlledField,
  FoundationForm,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { Action } from '@clouddrive/ui-adapter/action';
import { TabsView } from '@clouddrive/ui-adapter/data-display';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import {
  CheckboxField,
  ComboField,
  RadioGroupField,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from '@clouddrive/ui-adapter/form-field';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { CheckCircle2, Save, ShieldCheck } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import type { Preferences } from '@clouddrive/surface/preferences-model';

import {
  StickyActions,
  PageHeader,
  Page,
  Section,
  SplitView,
} from '@clouddrive/surface-foundation/layout';
import type { ReferenceFormInput } from '../../src/schemas';
import { useLocalSaveSimulation } from '../../src/browser-local-save';

const DatePickerField = dynamic(
  () => import('@clouddrive/ui-adapter/date-picker-field').then((module) => module.DatePickerField),
  { ssr: false },
);

export default function ReferenceFormPage() {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const preferencesPort = usePreferencesPort<Preferences>();
  const [saved, setSaved] = useState(false);
  const waitForSave = useLocalSaveSimulation();
  // 首错误聚焦（操作偏好 focusFirstError，默认开）：校验失败定位首个错误字段。
  const focusFirstError = preferencesPort.getSnapshot().actionPreferences.focusFirstError;
  const form = useFoundationForm<ReferenceFormInput>({
    schema: async () => (await import('../../src/schemas')).referenceFormSchema,
    defaultValues: {
      name: t('formReference.initialName'),
      owner: 'Lin Chen',
      region: 'apac',
      mode: 'guided',
      description: t('formReference.initialDescription'),
      reviewDate: '2026-09-15',
      notifyReviewers: true,
      allowOfflineDraft: false,
    },
    focusFirstError,
  });

  const submit = async () => {
    setSaved(false);
    if (!(await waitForSave())) return;
    setSaved(true);
    notify({
      title: t('formReference.saved'),
      description: t('formReference.description'),
      tone: 'success',
    });
  };

  const pending = form.isSubmitting;
  const errorProps = (field: keyof ReferenceFormInput): Readonly<{ error?: string }> =>
    form.hasError(field) ? { error: t(`formReference.errors.${field}`) } : {};

  return (
    <FoundationForm form={form} onSubmit={submit}>
      <Page>
        <PageHeader
          breadcrumbLabel={t('layout.breadcrumb')}
          breadcrumbs={[
            { label: t('reference.breadcrumbRoot') },
            { label: t('formReference.breadcrumbCurrent'), current: true },
          ]}
          eyebrow={t('formReference.eyebrow')}
          title={t('formReference.title')}
          description={t('formReference.description')}
          actions={
            saved ? (
              <StatusPill tone="success">{t('formReference.saved')}</StatusPill>
            ) : form.isDirty ? (
              <StatusPill tone="warning">{t('formReference.unsaved')}</StatusPill>
            ) : (
              <StatusPill>{t('formReference.pristine')}</StatusPill>
            )
          }
        />

        <SplitView
          master={
            <Section
              contentInset
              title={t('formReference.sectionTitle')}
              description={t('formReference.sectionDescription')}
            >
              <TabsView
                label={t('formReference.tabsLabel')}
                variant="section"
                items={[
                  {
                    id: 'identity',
                    label: t('formReference.tabs.identity'),
                    content: (
                      <div data-reveal-items className="grid gap-5">
                        <FoundationControlledField form={form} name="name">
                          {(field) => (
                            <TextField
                              label={t('formReference.name')}
                              hint={t('formReference.nameHint')}
                              disabled={pending}
                              value={field.value}
                              onBlur={field.onBlur}
                              {...errorProps('name')}
                              ref={(instance) => {
                                field.ref(instance);
                              }}
                              onChange={(event) => field.onChange(event.currentTarget.value)}
                            />
                          )}
                        </FoundationControlledField>
                        <div data-reveal-items className="grid gap-5 md:grid-cols-2">
                          <FoundationControlledField form={form} name="owner">
                            {(field) => (
                              <ComboField
                                label={t('formReference.owner')}
                                hint={t('formReference.ownerHint')}
                                placeholder={t('formReference.ownerPlaceholder')}
                                disabled={pending}
                                options={[
                                  { value: 'Lin Chen', label: 'Lin Chen' },
                                  { value: 'Avery Morgan', label: 'Avery Morgan' },
                                  { value: 'Mika Sato', label: 'Mika Sato' },
                                  { value: 'Sam Rivera', label: 'Sam Rivera' },
                                ]}
                                value={field.value}
                                onValueChange={field.onChange}
                                {...errorProps('owner')}
                              />
                            )}
                          </FoundationControlledField>
                          <FoundationControlledField form={form} name="region">
                            {(field) => (
                              <SelectField
                                label={t('formReference.region')}
                                hint={t('formReference.regionHint')}
                                disabled={pending}
                                options={[
                                  { value: 'apac', label: t('reference.region.apac') },
                                  { value: 'emea', label: t('reference.region.emea') },
                                  { value: 'americas', label: t('reference.region.americas') },
                                ]}
                                value={field.value}
                                onValueChange={(value) => {
                                  if (
                                    value === 'apac' ||
                                    value === 'emea' ||
                                    value === 'americas'
                                  ) {
                                    field.onChange(value);
                                  }
                                }}
                              />
                            )}
                          </FoundationControlledField>
                        </div>
                        <FoundationControlledField form={form} name="description">
                          {(field) => (
                            <TextAreaField
                              label={t('formReference.descriptionLabel')}
                              hint={t('formReference.descriptionHint')}
                              disabled={pending}
                              rows={7}
                              value={field.value}
                              onBlur={field.onBlur}
                              {...errorProps('description')}
                              ref={(instance) => {
                                field.ref(instance);
                              }}
                              onChange={(event) => field.onChange(event.currentTarget.value)}
                            />
                          )}
                        </FoundationControlledField>
                      </div>
                    ),
                  },
                  {
                    id: 'behavior',
                    label: t('formReference.tabs.behavior'),
                    content: (
                      <div data-reveal-items className="grid gap-5">
                        <FoundationControlledField form={form} name="mode">
                          {(field) => (
                            <RadioGroupField
                              label={t('formReference.mode')}
                              hint={t('formReference.modeHint')}
                              disabled={pending}
                              options={[
                                {
                                  value: 'observe',
                                  label: t('formReference.modeOption.observe'),
                                  description: t('formReference.modeOption.observeDescription'),
                                },
                                {
                                  value: 'guided',
                                  label: t('formReference.modeOption.guided'),
                                  description: t('formReference.modeOption.guidedDescription'),
                                },
                                {
                                  value: 'automatic',
                                  label: t('formReference.modeOption.automatic'),
                                  description: t('formReference.modeOption.automaticDescription'),
                                  disabled: true,
                                },
                              ]}
                              value={field.value}
                              onValueChange={(value) => {
                                if (
                                  value === 'observe' ||
                                  value === 'guided' ||
                                  value === 'automatic'
                                ) {
                                  field.onChange(value);
                                }
                              }}
                            />
                          )}
                        </FoundationControlledField>
                        <DatePickerField
                          label={t('formReference.reviewDate')}
                          hint={t('formReference.reviewDateHint')}
                          calendarLabel={t('formReference.calendarLabel')}
                          disabled={pending}
                          onValueChange={(value) =>
                            form.setValue('reviewDate', value ?? '', { dirty: true })
                          }
                        />
                        <FoundationControlledField form={form} name="notifyReviewers">
                          {(field) => (
                            <SwitchField
                              label={t('formReference.notify')}
                              description={t('formReference.notifyDescription')}
                              checked={field.value}
                              disabled={pending}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        </FoundationControlledField>
                        <FoundationControlledField form={form} name="allowOfflineDraft">
                          {(field) => (
                            <CheckboxField
                              label={t('formReference.offlineDraft')}
                              description={t('formReference.offlineDraftDescription')}
                              checked={field.value}
                              disabled={pending}
                              onCheckedChange={field.onChange}
                            />
                          )}
                        </FoundationControlledField>
                      </div>
                    ),
                  },
                  {
                    id: 'review',
                    label: t('formReference.tabs.review'),
                    content: (
                      <div>
                        <div className="flex items-start gap-4 rounded-panel bg-success-soft p-5 text-success">
                          <ShieldCheck className="size-6 shrink-0" />
                          <div>
                            <h3 className="font-bold">{t('formReference.reviewTitle')}</h3>
                            <p className="mt-2 text-sm leading-6 text-ink-muted">
                              {t('formReference.reviewDescription')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </Section>
          }
          detail={
            <Panel className="p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-control bg-brand-soft text-brand">
                  <CheckCircle2 className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-ink">{t('formReference.asideTitle')}</h2>
                  <p className="text-xs text-ink-muted">{t('formReference.asideDescription')}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {(['schema', 'keyboard', 'states', 'host'] as const).map((item) => (
                  <li className="flex gap-2 text-sm leading-6 text-ink-muted" key={item}>
                    <CheckCircle2 className="mt-1 size-4 shrink-0 text-success" />
                    {t(`formReference.checks.${item}`)}
                  </li>
                ))}
              </ul>
            </Panel>
          }
        />

        <StickyActions>
          <Action
            disabled={pending}
            variant="quiet"
            onPress={() => {
              form.reset();
              setSaved(false);
            }}
          >
            {t('formReference.reset')}
          </Action>
          <Action type="submit" loading={pending} leadingIcon={<Save className="size-4" />}>
            {pending ? t('formReference.saving') : t('formReference.save')}
          </Action>
        </StickyActions>
      </Page>
    </FoundationForm>
  );
}
