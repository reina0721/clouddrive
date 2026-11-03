'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FoundationForm, useFoundationForm } from '@clouddrive/form-foundation';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { TextField, PasswordField } from '@clouddrive/ui-adapter/form-field';
import { Action } from '@clouddrive/ui-adapter/action';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useAuth } from './context';
import { AuthFrame } from './frame';
import { safeReturnTo } from './contract';
import { readAuthConfig } from './config';
import { DemoAccessPanel } from './demo-access';
import { demoAccountPassword, type DemoAccount } from './demo-accounts';
import { rememberDemoAccount } from './demo-session';
import { resetDemoData } from './demo-reset';
import { readRegistrationAvailability } from './registration-policy';
import type { AuthFormValues } from './form-schema';
import { AlertTriangle, CheckCircle2, Clock, Eye, EyeOff } from 'lucide-react';

export function AuthForm({ kind }: Readonly<{ kind: 'login' | 'register' | 'expired' }>) {
  const register = kind === 'register';
  const { t } = useFrontendTranslation();
  const auth = useAuth();
  const params = useSearchParams();
  const target = safeReturnTo(params.get('returnTo'));
  const [registered, setRegistered] = useState(false);
  const [code, setCode] = useState('');
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [policyFailure, setPolicyFailure] = useState(false);
  const [policyRetry, setPolicyRetry] = useState(0);
  // 演示模式判定：显式 Mock 部署才提供快捷身份；后端模式绝不出现（也不因失败降级）。
  const [demoMode] = useState(() => {
    try {
      return readAuthConfig().mode === 'mock';
    } catch {
      return false;
    }
  });
  const signInAsDemo = async (account: DemoAccount) => {
    const accepted = await auth.login({ email: account.email, password: demoAccountPassword });
    if (!accepted) return;
    rememberDemoAccount(account.id);
    window.location.replace(target);
  };
  useEffect(() => {
    if (!register) return;
    let cancelled = false;
    void readRegistrationAvailability().then(
      (enabled) => {
        if (!cancelled) {
          setAvailability(enabled);
          setPolicyFailure(false);
        }
      },
      () => {
        if (!cancelled) setPolicyFailure(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [register, policyRetry]);
  const visibilityIcons = {
    show: <Eye aria-hidden="true" className="size-4" />,
    hide: <EyeOff aria-hidden="true" className="size-4" />,
  };
  const form = useFoundationForm<AuthFormValues>({
    schema: () =>
      import('./form-schema').then(({ createAuthSchema }) => createAuthSchema(register)),
    defaultValues: { name: '', email: '', password: '', confirmation: '' },
  });
  const validation = (field: keyof AuthFormValues, message: string) =>
    form.hasError(field) ? { error: t(message) } : {};
  return (
    <AuthFrame>
      <Page>
        <PageHeader
          title={t(register ? 'auth.registerTitle' : 'auth.loginTitle')}
          description={t(register ? 'auth.registerDescription' : 'auth.loginDescription')}
        />
        {!demoMode && !register ? (
          <Link href="/setup" className="text-brand underline">
            {t('auth.setupTitle')}
          </Link>
        ) : null}
        {kind === 'expired' ? (
          <AlertBanner
            tone="warning"
            title={t('auth.expiredTitle')}
            description={t('auth.expiredDescription')}
            icon={<Clock aria-hidden="true" className="size-4" />}
          />
        ) : null}
        {auth.error ? (
          <AlertBanner
            tone="danger"
            announcement="urgent"
            title={t(`auth.errors.${auth.error}`)}
            description={t('auth.errorDescription')}
            icon={<AlertTriangle aria-hidden="true" className="size-4" />}
          />
        ) : null}
        {register && availability !== true && !registered ? (
          <div role="status" className="space-y-4">
            <p className="text-sm text-ink-muted">
              {t(
                policyFailure
                  ? 'auth.policyFailure'
                  : availability === false
                    ? 'auth.registrationClosed'
                    : 'auth.policyLoading',
              )}
            </p>
            {policyFailure ? (
              <Action
                onPress={() => {
                  setPolicyFailure(false);
                  setPolicyRetry((prior) => prior + 1);
                }}
              >
                {t('auth.policyRetry')}
              </Action>
            ) : null}
          </div>
        ) : registered ? (
          <div role="status" className="space-y-4">
            <AlertBanner
              tone="success"
              title={t('auth.registeredTitle')}
              description={t('auth.registeredDescription')}
              icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
            />
            <Action fullWidth onPress={() => window.location.replace(target)}>
              {t('auth.continue')}
            </Action>
          </div>
        ) : (
          <FoundationForm
            form={form}
            className="grid gap-5"
            onSubmit={async (values) => {
              const input = {
                email: values.email,
                password: values.password,
                ...(code ? { code } : {}),
              };
              const accepted = register
                ? await auth.register({ ...input, name: values.name })
                : await auth.login(input);
              if (!accepted) return;
              form.reset();
              if (register) setRegistered(true);
              else window.location.replace(target);
            }}
          >
            {register ? (
              <TextField
                label={t('auth.name')}
                autoComplete="name"
                disabled={auth.busy}
                {...validation('name', 'auth.nameError')}
                {...form.registerField('name')}
              />
            ) : null}
            <TextField
              label={t('auth.email')}
              purpose="email"
              autoComplete="username"
              disabled={auth.busy}
              {...validation('email', 'auth.emailError')}
              {...form.registerField('email')}
            />
            <PasswordField
              label={t('auth.password')}
              purpose={register ? 'new' : 'current'}
              disabled={auth.busy}
              showLabel={t('auth.showPassword')}
              visibilityIcons={visibilityIcons}
              hideLabel={t('auth.hidePassword')}
              {...(register ? { hint: t('auth.passwordRule') } : {})}
              {...validation('password', register ? 'auth.passwordRule' : 'auth.passwordRequired')}
              {...form.registerField('password')}
            />
            {register ? (
              <PasswordField
                label={t('auth.confirmation')}
                purpose="new"
                disabled={auth.busy}
                showLabel={t('auth.showConfirmation')}
                visibilityIcons={visibilityIcons}
                hideLabel={t('auth.hideConfirmation')}
                {...validation('confirmation', 'auth.confirmationError')}
                {...form.registerField('confirmation')}
              />
            ) : null}
            {!register && auth.error === 'mfa-required' ? (
              <TextField
                label={t('auth.mfaCode')}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
              />
            ) : null}
            <Action type="submit" loading={auth.busy || form.isSubmitting} fullWidth>
              {t(register ? 'auth.registerSubmit' : 'auth.loginSubmit')}
            </Action>
          </FoundationForm>
        )}
        {demoMode && !register && !registered ? (
          <DemoAccessPanel
            busy={auth.busy}
            onReset={() => resetDemoData()}
            onSignIn={signInAsDemo}
          />
        ) : null}
        <p className="text-sm text-ink-muted">
          {t(register ? 'auth.hasAccount' : 'auth.noAccount')}{' '}
          <Link
            className="font-semibold text-brand underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            href={`${register ? '/login' : '/register'}?returnTo=${encodeURIComponent(target)}`}
          >
            {t(register ? 'auth.loginLink' : 'auth.registerLink')}
          </Link>
        </p>
      </Page>
    </AuthFrame>
  );
}
