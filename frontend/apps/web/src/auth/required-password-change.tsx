'use client';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { FoundationForm, useFoundationForm } from '@clouddrive/form-foundation';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { PasswordField } from '@clouddrive/ui-adapter/form-field';
import { Action } from '@clouddrive/ui-adapter/action';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { AuthFrame } from './frame';
import { readAuthConfig } from './config';
import { createJsonClient } from '../api/json-client';
import { useAuth } from './context';

export function RequiredPasswordChange() {
  const { t } = useFrontendTranslation();
  const auth = useAuth();
  const [failed, setFailed] = useState(false);
  const form = useFoundationForm<{ currentPassword: string; newPassword: string }>({
    schema: () =>
      import('@clouddrive/surface/identity').then((module) => module.changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  return (
    <AuthFrame>
      <Page>
        <PageHeader
          title={t('auth.requiredPasswordTitle')}
          description={t('auth.requiredPasswordDescription')}
        />
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
              await createJsonClient(config.apiBaseUrl)('/auth/password', {
                method: 'POST',
                body: values,
              });
              auth.expire();
              window.location.replace('/login');
            } catch {
              setFailed(true);
            }
          }}
        >
          <PasswordField
            label={t('auth.currentPassword')}
            purpose="current"
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
            {...form.registerField('currentPassword')}
          />
          <PasswordField
            label={t('auth.newPassword')}
            purpose="new"
            showLabel={t('auth.showPassword')}
            hideLabel={t('auth.hidePassword')}
            {...form.registerField('newPassword')}
          />
          <Action type="submit" loading={form.isSubmitting}>
            {t('auth.changePasswordSubmit')}
          </Action>
        </FoundationForm>
      </Page>
    </AuthFrame>
  );
}
