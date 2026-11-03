'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import type { RequestDisguise } from '@clouddrive/surface/api-workbench';
import { useApiWorkbenchPort } from '@clouddrive/surface/api-workbench';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { Sliders } from 'lucide-react';
import { Action } from '@clouddrive/ui-adapter/action';

export type DisguisePanelProps = Readonly<{
  disguise: RequestDisguise;
  onChange: (disguise: RequestDisguise) => void;
}>;

export function DisguisePanel({ disguise, onChange }: DisguisePanelProps) {
  const { t } = useFrontendTranslation();
  const port = useApiWorkbenchPort();
  const isMockMode = !port.capabilities.disguise;

  return (
    <div className="grid max-w-lg gap-4">
      {isMockMode && (
        <AlertBanner
          tone="warning"
          icon={<Sliders className="size-5 shrink-0 text-warning" />}
          title={t('apiWorkbench.disguise.mockNoticeTitle')}
          description={t('apiWorkbench.disguise.mockNoticeDesc')}
        />
      )}

      <TextField
        label={t('apiWorkbench.disguise.timeout')}
        value={String(disguise.timeoutMs || 10000)}
        onChange={(e) =>
          onChange({ ...disguise, timeoutMs: parseInt(e.target.value, 10) || 10000 })
        }
      />

      <TextField
        label={t('apiWorkbench.disguise.ua')}
        placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
        value={disguise.userAgent ?? ''}
        disabled={isMockMode}
        {...(isMockMode ? { hint: t('apiWorkbench.disguise.uaHint') } : {})}
        onChange={(e) => onChange({ ...disguise, userAgent: e.target.value })}
      />

      <TextField
        label={t('apiWorkbench.disguise.proxy')}
        placeholder="http://127.0.0.1:7890"
        value={disguise.proxy ?? ''}
        disabled
        hint={t('apiWorkbench.disguise.unsupported')}
        onChange={(e) => onChange({ ...disguise, proxy: e.target.value })}
      />

      <TextField
        label={t('apiWorkbench.disguise.fingerprint')}
        placeholder="chrome_124_tls_fp"
        value={disguise.fingerprint ?? ''}
        disabled
        hint={t('apiWorkbench.disguise.unsupported')}
        onChange={(e) => onChange({ ...disguise, fingerprint: e.target.value })}
      />
      {disguise.proxy || disguise.fingerprint ? (
        <Action onPress={() => onChange({ ...disguise, proxy: undefined, fingerprint: undefined })}>
          {t('apiWorkbench.disguise.clearUnsupported')}
        </Action>
      ) : null}
    </div>
  );
}
