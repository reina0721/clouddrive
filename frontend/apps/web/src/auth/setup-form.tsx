'use client';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { FoundationForm, useFoundationForm } from '@clouddrive/form-foundation';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { TextField, PasswordField } from '@clouddrive/ui-adapter/form-field';
import { Action } from '@clouddrive/ui-adapter/action';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { AuthFrame } from './frame';
import { readAuthConfig } from './config';
import { createJsonClient } from '../api/json-client';
import type { SetupValues } from './setup-schema';

export function SetupForm() {
  const { t } = useFrontendTranslation();
  const [failed, setFailed] = useState(false);
  const form = useFoundationForm<SetupValues>({
    schema: () => import('./setup-schema').then((module) => module.setupSchema),
    defaultValues: { name: '', email: '', password: '', setupToken: '' },
  });
  return (
    <AuthFrame>
      <Page>
        <PageHeader title={t('auth.setupTitle')} description={t('auth.setupDescription')} />
        {failed ? (
          <AlertBanner
            tone="danger"
            title={t('auth.setupFailure')}
            description={t('auth.errorDescription')}
            icon={<AlertTriangle aria-hidden="true" />}
          />
        ) : null}
        <FoundationForm
          form={form}
          onSubmit={async (values) => {
            setFailed(false);
            try {
              const config = readAuthConfig();
              if (config.mode !== 'backend') throw new Error('backend required');
              await createJsonClient(config.apiBaseUrl)('/auth/setup', {
                method: 'POST',
                body: values,
              });
              window.location.replace('/');
            } catch {
              setFailed(true);
            }
          }}
        >
          <TextField label={t('auth.name')} {...form.registerField('name')} />
          <TextField
            label={t('auth.email')}
            purpose="email"
            autoComplete="username"
            {...form.registerField('email')}
          />
          <PasswordField
            label={t('auth.password')}
            purpose="new"
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
            {...form.registerField('password')}
          />
          <PasswordField
            label={t('auth.setupToken')}
            purpose="current"
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
            {...form.registerField('setupToken')}
          />
          <Action type="submit" loading={form.isSubmitting}>
            {t('auth.setupSubmit')}
          </Action>
        </FoundationForm>
      </Page>
    </AuthFrame>
  );
}
