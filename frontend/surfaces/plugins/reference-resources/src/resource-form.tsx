import { useEffect, useRef, useState } from 'react';
import {
  FoundationForm,
  FoundationControlledField,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import { route, RouteLink, usePluginNavigation } from '@clouddrive/plugin-framework/plugin';
import { useNotificationsPort } from '@clouddrive/plugin-framework/notifications';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { useWorkspacePort } from '@clouddrive/plugin-framework/workspace';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { FormActions } from '@clouddrive/surface-foundation/form-actions';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import type { ReferenceResource } from '../data';
import { useResourcesStore } from '../stores/resources';
import type { ResourceFormValues } from './schema';

const draftFields = ['name', 'kind'] as const;
const createPageId = 'reference-resources.create';

export function ResourceForm({ resource }: Readonly<{ resource?: ReferenceResource }>) {
  const { t } = useFrontendTranslation();
  const { navigate } = usePluginNavigation();
  const notifications = useNotificationsPort();
  const preferences = usePreferencesPort<Preferences>();
  const workspace = useWorkspacePort<(typeof draftFields)[number]>();
  const mode = resource ? 'edit' : 'create';
  const key = `referenceResources.${mode}`;
  const pageId = `reference-resources.${mode}`;
  const saved = useRef(false);
  const nameInput = useRef<{ focus: () => void } | null>(null);
  useEffect(() => {
    if (preferences.getSnapshot().actionPreferences.focusFirstField) nameInput.current?.focus();
  }, [preferences]);
  const [defaults] = useState<ResourceFormValues>(() => {
    if (resource) return { name: resource.name, kind: resource.kind };
    const restored = workspace.restorePageState(createPageId)?.draft;
    return {
      name: typeof restored?.name === 'string' ? restored.name : '',
      kind: restored?.kind === 'guide' || restored?.kind === 'template' ? restored.kind : 'sample',
    };
  });
  const savedValues = useRef(defaults);
  const restoredDraftPending = useRef(!resource && Boolean(defaults.name));
  const form = useFoundationForm({
    schema: async () => (await import('./schema')).resourceFormSchema,
    defaultValues: defaults,
    focusFirstError: preferences.getSnapshot().actionPreferences.focusFirstError,
  });
  useRegisterDirtySource({
    pageId,
    message: () => t('referenceResources.edit.unsavedMessage'),
    isDirty: () => (form.isDirty || restoredDraftPending.current) && !saved.current,
    isSubmitting: () => form.isSubmitting,
  });
  useEffect(() => {
    if (resource) return;
    return workspace.registerPageState({
      pageId: createPageId,
      version: 1,
      draftFields,
      allowListState: false,
    });
  }, [resource, workspace]);
  const change = (field: keyof ResourceFormValues, value: string) => {
    saved.current = false;
    if (!resource && preferences.getSnapshot().actionPreferences.autosaveDrafts) {
      const prior = workspace.restorePageState(createPageId)?.draft;
      workspace.savePageState(createPageId, { draft: { ...defaults, ...prior, [field]: value } });
    }
  };
  const back = resource
    ? route('reference-resources.detail', {}, { query: { id: resource.id } })
    : route('reference-resources');
  const submit = (values: ResourceFormValues) => {
    const id = resource?.id ?? `resource-${crypto.randomUUID()}`;
    useResourcesStore.getState().save({
      id,
      ...values,
      status: resource?.status ?? 'draft',
      description: resource?.description ?? t('referenceResources.common.localDemo'),
    });
    // Mark the committed baseline before Host synchronously checks its dirty source.
    saved.current = true;
    restoredDraftPending.current = false;
    savedValues.current = values;
    form.reset(values);
    if (!resource) workspace.clearPageState(createPageId);
    const actionPreferences = preferences.getSnapshot().actionPreferences;
    const destination = resource
      ? actionPreferences.editSuccessDestination
      : actionPreferences.createSuccessDestination;
    const target =
      destination === 'detail'
        ? route('reference-resources.detail', {}, { query: { id } })
        : destination === 'list'
          ? route('reference-resources')
          : null;
    notifications.publish({
      category: 'success',
      severity: 'info',
      title: t('referenceResources.edit.savedTitle'),
      description: t(`referenceResources.common.saved.${destination}`),
      target: { routeId: 'reference-resources.detail', query: { id } },
    });
    if (destination === 'continue') form.reset({ name: '', kind: 'sample' });
    if (target) navigate(target);
  };
  const reset = () => {
    saved.current = false;
    form.reset(savedValues.current);
  };
  return (
    <Page>
      <PageHeader
        eyebrow={t('referenceResources.common.localDemo')}
        title={t(`${key}.title`)}
        description={t(`${key}.description`)}
        actions={<RouteLink target={back}>{t(`${key}.back`)}</RouteLink>}
      />
      <Section id={resource ? 'edit-form' : 'create-form'} title={t(`${key}.title`)}>
        <FoundationForm className="p-5" form={form} onSubmit={submit}>
          <div data-reveal-items className="grid gap-5">
            <FoundationControlledField form={form} name="name">
              {(field) => (
                <TextField
                  label={t('referenceResources.common.name')}
                  disabled={form.isSubmitting}
                  value={field.value}
                  name={field.name}
                  onBlur={field.onBlur}
                  ref={(instance) => {
                    if (typeof field.ref === 'function') field.ref(instance);
                    else if (field.ref) field.ref.current = instance;
                    nameInput.current = instance;
                  }}
                  {...(form.hasError('name')
                    ? { error: t('referenceResources.common.invalidName') }
                    : {})}
                  onChange={(event) => {
                    change('name', event.currentTarget.value);
                    field.onChange(event.currentTarget.value);
                  }}
                />
              )}
            </FoundationControlledField>
            <FoundationControlledField form={form} name="kind">
              {(field) => (
                <SelectField
                  label={t('referenceResources.common.kind')}
                  disabled={form.isSubmitting}
                  value={field.value}
                  options={(['sample', 'guide', 'template'] as const).map((value) => ({
                    value,
                    label: t(`referenceResources.common.${value}`),
                  }))}
                  onValueChange={(value) => {
                    if (value === 'sample' || value === 'guide' || value === 'template') {
                      change('kind', value);
                      field.onChange(value);
                    }
                  }}
                />
              )}
            </FoundationControlledField>
            <FormActions
              primary={
                <Action type="submit" loading={form.isSubmitting}>
                  {t(`${key}.submit`)}
                </Action>
              }
              secondary={
                <>
                  {resource ? (
                    preferences.getSnapshot().actionPreferences.confirmReset ? (
                      <ConfirmDialog
                        triggerLabel={t('referenceResources.edit.reset')}
                        title={t('referenceResources.edit.resetTitle')}
                        description={t('referenceResources.edit.resetDescription')}
                        impact={t('referenceResources.edit.resetImpact')}
                        failureMessage={t('referenceResources.edit.resetFailed')}
                        cancelLabel={t('referenceResources.edit.resetCancel')}
                        confirmLabel={t('referenceResources.edit.resetConfirm')}
                        onConfirm={reset}
                      />
                    ) : (
                      <Action variant="secondary" onPress={reset}>
                        {t('referenceResources.edit.reset')}
                      </Action>
                    )
                  ) : null}
                  <RouteLink
                    target={back}
                    onNavigate={() => {
                      if (!resource) workspace.clearPageState(createPageId);
                    }}
                  >
                    {t(`${key}.cancel`)}
                  </RouteLink>
                </>
              }
            />
          </div>
        </FoundationForm>
      </Section>
    </Page>
  );
}
