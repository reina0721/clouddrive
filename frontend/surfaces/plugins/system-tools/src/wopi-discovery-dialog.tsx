'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import type { WebFileApplication, WOPIDiscovery } from '../../../src/files/file-applications';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';

function validEndpoint(value: string) {
  if (!value.startsWith('https://') || value.length > 2048 || /[\s\\#]/u.test(value)) return false;
  try {
    const endpoint = new URL(value);
    return !!endpoint.hostname && !endpoint.username && !endpoint.password;
  } catch {
    return false;
  }
}

export function WOPIDiscoveryDialog({
  application,
  onApply,
  onClose,
}: {
  application?: WebFileApplication | undefined;
  onApply: (app: WebFileApplication) => void;
  onClose: () => void;
}) {
  const { locale, t } = useFrontendTranslation();
  const zh = locale.startsWith('zh');
  const files = useFiles();
  const title = zh ? '导入 WOPI 应用设置' : 'Import WOPI application';
  const [endpoint, setEndpoint] = useState(application?.wopi?.discoveryUrl ?? '');
  const [draft, setDraft] = useState<WOPIDiscovery>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController>(null);
  useEffect(() => () => request.current?.abort(), []);
  const valid = validEndpoint(endpoint.trim());
  async function discover() {
    if (!valid || loading) return;
    setLoading(true);
    setDraft(undefined);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await files.discoverWOPI(endpoint.trim(), controller.signal);
      if (!controller.signal.aborted) setDraft(result);
    } catch (cause) {
      if (!controller.signal.aborted) {
        const detail = t(
          `files.errors.${cause instanceof FilesError ? cause.code : 'unavailable'}`,
        );
        setError(
          zh
            ? `无法导入 WOPI 应用。 ${detail}`
            : `Could not import the WOPI application. ${detail}`,
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <DialogSurface
      isOpen
      title={title}
      triggerLabel={title}
      description={
        zh
          ? '输入文档服务的 HTTPS 发现地址，检查可用的查看与编辑格式。'
          : 'Enter the document service’s HTTPS discovery address to check viewing and editing formats.'
      }
      cancelLabel={t('files.cancel')}
      confirmLabel={zh ? '应用到草稿' : 'Apply to draft'}
      confirmDisabled={!draft || loading}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() => {
        if (!draft) return;
        const discovered = draft.actions.map((action) => action.extension);
        const retained = application?.extensions.filter((extension) =>
          discovered.includes(extension),
        );
        const extensions = retained?.length ? retained : discovered;
        const editEnabled =
          application?.wopi?.editEnabled === true &&
          draft.actions.some((action) => action.editUrl && extensions.includes(action.extension));
        onApply({
          id: application?.id ?? `web-${crypto.randomUUID().replaceAll('-', '')}`,
          name: application?.name ?? 'WOPI · ' + new URL(draft.origin).hostname.slice(0, 57),
          enabled: application?.enabled ?? true,
          platform: application?.platform ?? 'all',
          extensions,
          maxBytes: application?.maxBytes ?? 0,
          newTab: application?.newTab ?? false,
          ...(application?.iconUrl ? { iconUrl: application.iconUrl } : {}),
          origin: draft.origin,
          protocol: 'wopi',
          urlTemplate: '',
          wopi: { discoveryUrl: draft.discoveryUrl, actions: draft.actions, editEnabled },
        });
      }}
    >
      <div className="space-y-4">
        <TextField
          label="WOPI Discovery Endpoint"
          value={endpoint}
          placeholder="https://example.com/hosting/discovery"
          disabled={loading}
          {...(endpoint.trim() && !valid
            ? { error: zh ? '请输入有效的 HTTPS 地址。' : 'Enter a valid HTTPS address.' }
            : {})}
          onChange={(event) => {
            setEndpoint(event.target.value);
            setDraft(undefined);
            setError('');
          }}
        />
        <Action
          variant="secondary"
          disabled={!valid || loading}
          loading={loading}
          onPress={() => void discover()}
        >
          {zh ? '检查发现地址' : 'Check discovery address'}
        </Action>
        {error ? <p role="alert">{error}</p> : null}
        {draft ? (
          <div role="status">
            <p>
              {zh
                ? `发现 ${draft.actions.length} 种可预览格式`
                : `${draft.actions.length} preview formats found`}
            </p>
            <p>{draft.actions.map((action) => '.' + action.extension).join(', ')}</p>
            {draft.actions.some((action) => action.editUrl) ? (
              <p>
                {zh ? '可编辑格式' : 'Editable formats'}{' '}
                {draft.actions
                  .filter((action) => action.editUrl)
                  .map((action) => '.' + action.extension)
                  .join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </DialogSurface>
  );
}
