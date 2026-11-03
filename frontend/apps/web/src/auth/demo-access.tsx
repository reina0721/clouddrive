'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { useSyncExternalStore } from 'react';

import { demoAccounts, type DemoAccount } from './demo-accounts';
import { readLastDemoAccountId } from './demo-session';

/**
 * 显式 Mock 演示身份面板（登录/会话过期页）。
 *
 * 产品语义：
 * - 每个身份按钮都是一次**真实登录**（Host AuthService），不是只填表单；
 * - 三个身份各自对应目录里真实存在的角色（administrator / operator / viewer），
 *   权限差异由既有 RBAC 决定，面板不复制权限表；
 * - 客户端凭据只用于本地模拟，文案明确"不构成安全认证"；
 * - "重置演示数据"清除 Mock 目录与会话（保留界面偏好），下一次读取重新播种。
 */
export function DemoAccessPanel({
  busy,
  onSignIn,
  onReset,
}: Readonly<{
  busy: boolean;
  onSignIn: (account: DemoAccount) => void | Promise<void>;
  onReset: () => void | Promise<void>;
}>) {
  const { t } = useFrontendTranslation();
  // 读取本地"上次使用"记忆（客户端外部状态；服务端快照为 null，避免 hydration 不一致）。
  const lastAccountId = useSyncExternalStore(
    () => () => undefined,
    readLastDemoAccountId,
    () => null,
  );
  return (
    <section
      aria-labelledby="demo-access-title"
      className="mt-8 space-y-4 rounded-panel border border-border bg-surface p-4"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-ink" id="demo-access-title">
          {t('auth.demo.pickerTitle')}
        </h2>
        <p className="text-xs leading-5 text-ink-muted">{t('auth.demo.pickerDescription')}</p>
      </div>
      <ul className="grid gap-2">
        {demoAccounts.map((account) => (
          <li key={account.id}>
            <button
              className="flex w-full items-start gap-3 rounded-control border border-border bg-surface p-3 text-left outline-none transition-colors hover:border-brand hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => void onSignIn(account)}
              type="button"
            >
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-muted text-xs font-semibold text-brand">
                {t(`auth.demo.roles.${account.roleId}.badge`)}
              </span>
              <span className="min-w-0 space-y-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {t(`auth.demo.roles.${account.roleId}.name`)}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {account.name} · {account.email}
                  </span>
                  {lastAccountId === account.id ? (
                    <span className="rounded-control bg-brand/10 px-1.5 py-0.5 text-xs font-semibold text-brand">
                      {t('auth.demo.lastUsed')}
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs leading-5 text-ink-muted">
                  {t(`auth.demo.roles.${account.roleId}.capability`)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="max-w-2xl text-xs leading-5 text-ink-muted">{t('auth.demo.securityNote')}</p>
        <ConfirmDialog
          confirmLabel={t('auth.demo.resetConfirm')}
          description={t('auth.demo.resetDescription')}
          failureMessage={t('auth.demo.resetFailure')}
          impact={t('auth.demo.resetImpact')}
          triggerLabel={t('auth.demo.resetAction')}
          title={t('auth.demo.resetTitle')}
          tone="danger"
          cancelLabel={t('common.cancel')}
          onConfirm={() => onReset()}
        />
      </div>
    </section>
  );
}
