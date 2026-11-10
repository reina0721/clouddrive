'use client';

import { useEffect, useState } from 'react';
import {
  FoundationControlledField,
  FoundationForm,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { FormActions } from '@clouddrive/surface-foundation/form-actions';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextAreaField, TextField } from '@clouddrive/ui-adapter/form-field';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { useProductAccess } from '@clouddrive/surface/identity/runtime';
import {
  siteProfileSchema,
  SiteProfileError,
  type SiteProfile,
  type SiteProfileManagement,
} from '../../../src/administration/site-profile';
import { SiteLogo, useSiteProfile } from '../../../src/administration/site-profile-runtime';
import { SettingsSections } from './settings-sections';
import { SiteAddressesFields } from './site-addresses-fields';

const logoFields = ['lightLogo', 'darkLogo'] as const;
const linkFields = ['termsUrl', 'privacyUrl'] as const;

function profileDraft(profile: SiteProfile): SiteProfile {
  return { ...profile, siteAddresses: profile.siteAddresses ?? { primary: '', alternatives: [] } };
}

function ProfileForm({
  initial,
  canWrite,
  reload,
}: Readonly<{ initial: SiteProfileManagement; canWrite: boolean; reload: () => void }>) {
  const { t } = useFrontendTranslation();
  const { admin } = useSiteProfile();
  const { notify } = useFeedback();
  const [saved, setSaved] = useState(initial);
  const [failure, setFailure] = useState<SiteProfileError['code']>();
  const [preview, setPreview] = useState<Partial<Pick<SiteProfile, 'lightLogo' | 'darkLogo'>>>({});
  const form = useFoundationForm({
    schema: siteProfileSchema,
    defaultValues: profileDraft(initial.profile),
  });
  useRegisterDirtySource({
    pageId: 'system-settings.site',
    message: () => t('identityProduct.unsaved'),
    isDirty: () => form.isDirty,
    isSubmitting: () => form.isSubmitting,
  });
  const label = (key: string) => t('systemSettings.site.' + key);
  const disabled = !canWrite || form.isSubmitting;
  const invalid = (key: keyof SiteProfile) =>
    form.hasError(key) ? { error: label('invalid') } : {};
  async function save(profile: SiteProfile) {
    if (!admin || !canWrite) return;
    setFailure(undefined);
    try {
      const result = await admin.save({ revision: saved.revision, profile });
      setSaved(result);
      setPreview({});
      form.reset(profileDraft(result.profile));
      notify({ title: label('saved'), tone: 'success' });
    } catch (error) {
      setFailure(error instanceof SiteProfileError ? error.code : 'unavailable');
    }
  }
  function reset() {
    form.reset(profileDraft(saved.profile));
    setPreview({});
    setFailure(undefined);
  }
  return (
    <FoundationForm form={form} onSubmit={save} className="min-w-0 space-y-4">
      {!canWrite ? <p className="text-sm text-ink-muted">{label('readonly')}</p> : null}
      {failure ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-danger" role="alert">
            {label(failure)}
          </p>
          {failure === 'conflict' ? (
            <Action variant="secondary" onPress={reload}>
              {label('reload')}
            </Action>
          ) : null}
        </div>
      ) : null}
      <Section
        title={label('basic')}
        description={label('publicHint')}
        appearance="outlined"
        contentInset
      >
        <div className="grid min-w-0 max-w-2xl gap-4">
          <TextField
            label={label('name')}
            disabled={disabled}
            {...invalid('name')}
            {...form.registerField('name')}
          />
          <TextAreaField
            label={label('description')}
            disabled={disabled}
            {...invalid('description')}
            {...form.registerField('description')}
          />
        </div>
      </Section>
      <FoundationControlledField form={form} name="siteAddresses">
        {(field) => (
          <SiteAddressesFields
            value={field.value}
            onChange={field.onChange}
            allowed={saved.publicationOrigins ?? []}
            disabled={disabled}
            invalid={form.hasError('siteAddresses')}
          />
        )}
      </FoundationControlledField>
      <Section
        title={label('icons')}
        description={label('urlHint')}
        appearance="outlined"
        contentInset
      >
        <div className="grid min-w-0 max-w-2xl gap-4">
          {logoFields.map((name) => (
            <FoundationControlledField key={name} form={form} name={name}>
              {(field) => {
                const candidate = siteProfileSchema.shape[name].safeParse(field.value);
                const src = preview[name] ?? saved.profile[name];
                return (
                  <div className="grid min-w-0 gap-2">
                    <TextField
                      label={label(name)}
                      disabled={disabled}
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                      {...invalid(name)}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`grid size-12 place-items-center rounded-control border border-border ${name === 'darkLogo' ? 'bg-ink text-surface' : 'bg-surface text-ink'}`}
                      >
                        <SiteLogo
                          key={src}
                          src={src}
                          className="size-8"
                          fallback={<span aria-hidden="true">C</span>}
                        />
                      </span>
                      <Action
                        size="sm"
                        variant="secondary"
                        disabled={!candidate.success || src === field.value}
                        onPress={() => setPreview((value) => ({ ...value, [name]: field.value }))}
                      >
                        {label(name === 'darkLogo' ? 'previewDark' : 'previewLight')}
                      </Action>
                    </div>
                  </div>
                );
              }}
            </FoundationControlledField>
          ))}
          <TextField
            label={label('icon')}
            disabled={disabled}
            {...invalid('icon')}
            {...form.registerField('icon')}
          />
        </div>
      </Section>
      <Section
        title={label('legal')}
        description={label('legalHint')}
        appearance="outlined"
        contentInset
      >
        <div className="grid min-w-0 max-w-2xl gap-4">
          {linkFields.map((name) => (
            <TextField
              key={name}
              label={label(name)}
              disabled={disabled}
              {...invalid(name)}
              {...form.registerField(name)}
            />
          ))}
        </div>
      </Section>
      {canWrite ? (
        <FormActions
          secondary={
            <Action variant="quiet" disabled={form.isSubmitting || !form.isDirty} onPress={reset}>
              {t('systemSettings.reset')}
            </Action>
          }
          primary={
            <Action type="submit" disabled={form.isSubmitting || !form.isDirty}>
              {label('save')}
            </Action>
          }
        />
      ) : null}
    </FoundationForm>
  );
}

export function SiteProfilePage() {
  const { t } = useFrontendTranslation();
  const { admin } = useSiteProfile();
  const access = useProductAccess();
  const canRead = access.data?.permissions.includes('settings.read') === true;
  const canWrite = access.data?.permissions.includes('settings.update') === true;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SiteProfileManagement | 'failed'>();
  function reload() {
    setResult(undefined);
    setAttempt((value) => value + 1);
  }
  useEffect(() => {
    if (!admin || !canRead) return;
    const controller = new AbortController();
    void admin.read(controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setResult(value);
      },
      () => {
        if (!controller.signal.aborted) setResult('failed');
      },
    );
    return () => controller.abort();
  }, [admin, attempt, canRead]);
  const label = (key: string) => t('systemSettings.site.' + key);
  return (
    <Page>
      <PageHeader title={label('page')} description={label('intro')} />
      <SettingsSections active="site" />
      {!admin || (!access.loading && !canRead) ? (
        <p role="status">{label(access.error || !admin ? 'unavailable' : 'forbidden')}</p>
      ) : result === 'failed' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert">{label('unavailable')}</p>
          <Action variant="secondary" onPress={reload}>
            {label('reload')}
          </Action>
        </div>
      ) : result ? (
        <ProfileForm initial={result} canWrite={canWrite} reload={reload} />
      ) : (
        <p role="status">{t('administration.loading')}</p>
      )}
    </Page>
  );
}
