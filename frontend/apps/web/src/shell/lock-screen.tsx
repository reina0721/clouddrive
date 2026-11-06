'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { PasswordField } from '@clouddrive/ui-adapter/form-field';
import { AlertTriangle, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/context';
import { verifyAccountPassword } from '../auth/unlock';
import { useLockStore } from '../state/use-lock-store';

/**
 * 锁屏覆盖层（Host）。
 *
 * 安全边界（必须在文案中如实说明）：
 * - 这是**客户端锁定**：遮挡内容、要求复核当前账号密码，不改变会话有效期，也不是授权边界；
 * - 清除本地存储或重新打开标签页即可绕过；
 * - 解锁失败沿用统一认证错误码，不额外暴露信息。
 */
export function LockScreen() {
  const { t } = useFrontendTranslation();
  const auth = useAuth();
  const locked = useLockStore((state) => state.locked);
  const reason = useLockStore((state) => state.reason);
  const lockedAt = useLockStore((state) => state.lockedAt);
  const unlock = useLockStore((state) => state.unlock);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<
    'empty' | 'credentials' | 'locked' | 'expired' | 'forbidden' | 'unavailable' | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const user = auth.session?.user ?? null;

  // 打开锁屏时把焦点移入卡片（不依赖 autoFocus，避免可访问性告警）。
  useEffect(() => {
    cardRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [locked, lockedAt, user?.id]);

  if (!locked || !user) return null;

  const submit = async () => {
    if (requestRef.current) return;
    if (!password) {
      setError('empty');
      return;
    }
    setSubmitting(true);
    setError(null);
    const request = new AbortController();
    requestRef.current = request;
    const snapshot = useLockStore.getState();
    const current = () =>
      !request.signal.aborted &&
      useLockStore.getState().locked &&
      useLockStore.getState().userId === user.id &&
      useLockStore.getState().lockedAt === snapshot.lockedAt;
    try {
      // 专用复核共享服务端失败预算，不走会创建会话的 auth.login。
      const result = await verifyAccountPassword(user.email, password, request.signal);
      if (!current()) return;
      if (result.ok) {
        setPassword('');
        unlock();
      } else {
        setError(result.code);
      }
    } finally {
      if (!request.signal.aborted) {
        setPassword('');
        setSubmitting(false);
      }
      if (requestRef.current === request) requestRef.current = null;
    }
  };

  return (
    <div
      aria-labelledby="lock-screen-title"
      aria-modal="true"
      className="fixed inset-0 z-overlay grid place-items-center bg-canvas/80 p-6 backdrop-blur-sm"
      data-lock-reason={reason ?? 'manual'}
      role="dialog"
    >
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-panel border border-border bg-surface p-6 shadow-overlay"
        ref={cardRef}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-control items-center justify-center rounded-control bg-surface-muted text-brand"
        >
          <LockKeyhole className="size-6" />
        </span>
        <h2 className="text-lg font-semibold text-ink" id="lock-screen-title">
          {t(reason === 'idle' ? 'shell.lock.idleTitle' : 'shell.lock.title')}
        </h2>
        <p className="text-sm text-ink-muted">{t('shell.lock.subtitle', { name: user.name })}</p>
        {error ? (
          <AlertBanner
            announcement="urgent"
            description={t(
              error === 'locked'
                ? 'shell.lock.lockedDescription'
                : error === 'expired' || error === 'forbidden'
                  ? 'shell.lock.signInDescription'
                  : 'shell.lock.errorDescription',
            )}
            icon={<AlertTriangle aria-hidden="true" className="size-4" />}
            title={t(error === 'empty' ? 'shell.lock.passwordRequired' : `auth.errors.${error}`)}
            tone="danger"
          />
        ) : null}
        <form
          aria-busy={submitting || undefined}
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <PasswordField
            hideLabel={t('auth.hidePassword')}
            label={t('shell.lock.password')}
            purpose="current"
            showLabel={t('auth.showPassword')}
            value={password}
            visibilityIcons={{
              show: <Eye aria-hidden="true" className="size-4" />,
              hide: <EyeOff aria-hidden="true" className="size-4" />,
            }}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
          <Action fullWidth disabled={submitting} type="submit">
            {t(submitting ? 'shell.lock.checking' : 'shell.lock.unlock')}
          </Action>
          <span className="sr-only" role="status">
            {submitting ? t('shell.lock.checking') : ''}
          </span>
        </form>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-ink-muted">{t('shell.lock.clientOnly')}</p>
          <Action
            size="sm"
            variant="quiet"
            onPress={() => {
              void auth.logout();
            }}
          >
            {t('auth.logout')}
          </Action>
        </div>
      </div>
    </div>
  );
}
