'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type { ApiRequestDefinition, HttpMethod } from '@clouddrive/surface/api-workbench';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { CheckCheck, Save, Send } from 'lucide-react';
import { parseCurl } from '../model/curl';

export type RequestBarProps = Readonly<{
  request: ApiRequestDefinition;
  isExecuting: boolean;
  isSaving: boolean;
  isDirty: boolean;
  baseUrl: string;
  onChange: (patch: Partial<ApiRequestDefinition>) => void;
  onSend: () => void;
  onSave: () => void;
}>;
const methods: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
export function RequestBar({
  request,
  isExecuting,
  isSaving,
  isDirty,
  baseUrl,
  onChange,
  onSend,
  onSave,
}: RequestBarProps) {
  const { t } = useFrontendTranslation();
  const [curlError, setCurlError] = useState(false);
  const changeUrl = (value: string) => {
    setCurlError(false);
    if (value.trim().toLowerCase().startsWith('curl')) {
      const parsed = parseCurl(value);
      if (!parsed) {
        setCurlError(true);
        return;
      }
      onChange({
        method: parsed.method,
        url: parsed.url,
        headers: [...request.headers, ...parsed.headers],
        body: parsed.body,
      });
    } else onChange({ url: value });
  };
  return (
    <div className="@container/editor grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 break-words text-lg font-semibold text-ink">{request.name}</h2>
        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted" role="status">
            {!isDirty && <CheckCheck aria-hidden="true" className="size-4 text-success" />}
            {t(isDirty ? 'apiWorkbench.requestBar.dirty' : 'apiWorkbench.requestBar.saved')}
          </span>
          {isDirty && (
            <Action
              variant="secondary"
              size="sm"
              leadingIcon={<Save className="size-4" />}
              loading={isSaving}
              onPress={onSave}
            >
              {t('apiWorkbench.requestBar.save')}
            </Action>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-end gap-3 @lg/editor:flex-nowrap">
        <div className="order-2 w-32 shrink-0 @lg/editor:order-none">
          <SelectField
            label={t('apiWorkbench.requestBar.method')}
            options={methods.map((method) => ({ value: method, label: method }))}
            value={request.method}
            onValueChange={(value) => {
              const method = methods.find((item) => item === value);
              if (method) onChange({ method });
            }}
          />
        </div>
        <div className="order-1 min-w-0 w-full">
          <TextField
            label={t('apiWorkbench.requestBar.url')}
            placeholder="https://api.example.com"
            value={request.url}
            onChange={(event) => changeUrl(event.target.value)}
            {...(curlError ? { error: t('apiWorkbench.requestBar.curlFailed') } : {})}
          />
        </div>
        <div className="order-3 ml-auto flex shrink-0 justify-end">
          <Action
            variant="primary"
            leadingIcon={<Send className="size-4" />}
            loading={isExecuting}
            disabled={!request.url.trim()}
            onPress={onSend}
          >
            {t(isExecuting ? 'apiWorkbench.requestBar.sending' : 'apiWorkbench.requestBar.send')}
          </Action>
        </div>
      </div>
      <div className="grid min-w-0 gap-1 text-xs leading-5 text-ink-muted">
        <p>{t('apiWorkbench.requestBar.hint')}</p>
        {baseUrl && (
          <p className="min-w-0 break-all">
            <span>{t('apiWorkbench.requestBar.resolvedBase')}: </span>
            <code className="font-mono text-ink">{baseUrl}</code>
          </p>
        )}
      </div>
    </div>
  );
}
