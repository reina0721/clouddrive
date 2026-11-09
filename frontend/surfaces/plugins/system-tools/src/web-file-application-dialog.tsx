'use client';

import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import {
  maxWebApplicationBytes,
  maxWOPIExtensions,
  parseFileApplicationExtensions,
  type FileApplicationPlatform,
  type WebFileApplication,
} from '../../../src/files/file-applications';
import { fileIconImageAllowed } from '../../../src/files/icon-rules';
import { webFilePreviewOrigin } from '../../../src/files/web-file-preview';

export function WebFileApplicationDialog({
  application,
  platforms,
  onApply,
  onClose,
}: {
  application?: WebFileApplication | undefined;
  platforms: { value: FileApplicationPlatform; label: string }[];
  onApply: (app: WebFileApplication) => void;
  onClose: () => void;
}) {
  const { locale, t } = useFrontendTranslation();
  const zh = locale.startsWith('zh');
  const wopi = application?.protocol === 'wopi' ? application.wopi : undefined;
  const title = wopi
    ? zh
      ? '编辑 WOPI 应用'
      : 'Edit WOPI application'
    : application
      ? zh
        ? '编辑网页应用'
        : 'Edit web application'
      : zh
        ? '添加网页应用'
        : 'Add web application';
  const [name, setName] = useState(application?.name ?? '');
  const [extensions, setExtensions] = useState(application?.extensions.join(', ') ?? '');
  const [template, setTemplate] = useState(application?.urlTemplate ?? '');
  const [icon, setIcon] = useState(application?.iconUrl ?? '');
  const [size, setSize] = useState(String(application?.maxBytes ?? 0));
  const [platform, setPlatform] = useState<FileApplicationPlatform>(application?.platform ?? 'all');
  const [newTab, setNewTab] = useState(application?.newTab ?? false);
  const [editEnabled, setEditEnabled] = useState(wopi?.editEnabled ?? false);
  const parsed = parseFileApplicationExtensions(extensions, wopi ? maxWOPIExtensions : undefined);
  const editableFormats =
    'extensions' in parsed
      ? (wopi?.actions.filter(
          (action) => action.editUrl && parsed.extensions.includes(action.extension),
        ) ?? [])
      : [];
  const origin = wopi ? application?.origin : webFilePreviewOrigin(template.trim());
  const unsupported =
    wopi &&
    'extensions' in parsed &&
    parsed.extensions.some(
      (extension) => !wopi.actions.some((action) => action.extension === extension),
    );
  const maxBytes = Number(size);
  const invalidSize =
    !/^\d+$/.test(size) || !Number.isSafeInteger(maxBytes) || maxBytes > maxWebApplicationBytes;
  const invalidIcon = !!icon.trim() && !fileIconImageAllowed(icon.trim());
  const invalidName = !name.trim() || [...name.trim()].length > 64 || /\p{Cc}/u.test(name.trim());
  const disabled =
    invalidName ||
    invalidIcon ||
    invalidSize ||
    unsupported ||
    !origin ||
    'error' in parsed ||
    !parsed.extensions.length;
  return (
    <DialogSurface
      isOpen
      title={title}
      triggerLabel={title}
      description={
        zh
          ? '外部应用通过短期授权读取用户确认的文件。'
          : 'External applications read an approved file through temporary authorization.'
      }
      confirmLabel={zh ? '应用到草稿' : 'Apply to draft'}
      cancelLabel={t('files.cancel')}
      confirmDisabled={disabled}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() => {
        if (disabled) return;
        onApply({
          id: application?.id ?? `web-${crypto.randomUUID().replaceAll('-', '')}`,
          enabled: application?.enabled ?? true,
          name: name.trim(),
          extensions: parsed.extensions,
          urlTemplate: template.trim(),
          ...(icon.trim() ? { iconUrl: icon.trim() } : {}),
          origin,
          platform,
          maxBytes,
          newTab,
          ...(wopi
            ? {
                protocol: 'wopi',
                wopi: { ...wopi, editEnabled: editEnabled && editableFormats.length > 0 },
              }
            : {}),
        });
      }}
    >
      <div className="space-y-4">
        <TextField
          label={zh ? '图标地址' : 'Icon address'}
          value={icon}
          {...(invalidIcon
            ? {
                error: zh
                  ? '请输入受支持的 HTTPS 图片地址。'
                  : 'Enter a supported HTTPS image address.',
              }
            : {})}
          onChange={(event) => setIcon(event.target.value)}
        />
        <TextField
          label={zh ? '名称' : 'Name'}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextAreaField
          label={zh ? '扩展名列表' : 'Extensions'}
          value={extensions}
          rows={2}
          {...(unsupported
            ? {
                error: zh
                  ? '请选择发现结果中支持的扩展名。'
                  : 'Use extensions supported by the discovery result.',
              }
            : 'error' in parsed
              ? {
                  error: zh
                    ? '请检查扩展名格式或重复项。'
                    : 'Check extension format and duplicates.',
                }
              : {})}
          onChange={(event) => setExtensions(event.target.value)}
        />
        {wopi ? (
          <div className="space-y-2">
            <p>
              <strong>WOPI Discovery Endpoint</strong>
            </p>
            <p className="break-all text-sm text-ink-muted">{wopi.discoveryUrl}</p>
            <p className="text-sm text-ink-muted">
              {wopi.actions.map((action) => '.' + action.extension).join(', ')}
            </p>
          </div>
        ) : (
          <>
            <TextField
              label={zh ? '应用 URL' : 'Application URL'}
              value={template}
              {...(template.trim() && !origin
                ? {
                    error: zh
                      ? '请输入含文件地址变量的 HTTPS 模板。'
                      : 'Enter an HTTPS template containing a source variable.',
                  }
                : {})}
              onChange={(event) => setTemplate(event.target.value)}
            />
            <details>
              <summary>{zh ? '模板变量' : 'Template variables'}</summary>
              <p className="text-sm text-ink-muted">
                {zh
                  ? '仅用于查询值。文件地址、名称、主题变量如下。'
                  : 'Use source, name, and theme variables in query values.'}
              </p>
              <p>
                <code>{'{$src}, {$src_raw}, {$src_raw_base64}, {$name}, {$theme}, {$dark}'}</code>
              </p>
            </details>
          </>
        )}
        <TextField
          label={zh ? '最大文件大小（字节）' : 'Maximum file size (bytes)'}
          value={size}
          {...(invalidSize
            ? {
                error: zh
                  ? '请输入 0 到 1 TiB 的字节数。'
                  : 'Enter a byte count between zero and 1 TiB.',
              }
            : {})}
          onChange={(event) => setSize(event.target.value)}
        />
        <p className="text-sm text-ink-muted">
          {zh
            ? '0 表示不限。超过限制的文件无法使用此应用。'
            : 'Zero means unlimited. Files over the limit cannot use this app.'}
        </p>
        <SelectField
          label={zh ? '平台' : 'Platform'}
          value={platform}
          options={platforms}
          onValueChange={(value) => {
            if (value === 'all' || value === 'desktop' || value === 'mobile') setPlatform(value);
          }}
        />
        <CheckboxField
          label={zh ? '在新标签页打开' : 'Open in a new tab'}
          checked={newTab}
          onCheckedChange={setNewTab}
        />
        {wopi ? (
          <>
            <CheckboxField
              label={zh ? '允许在线编辑' : 'Allow online editing'}
              checked={editEnabled && editableFormats.length > 0}
              disabled={editableFormats.length === 0}
              onCheckedChange={setEditEnabled}
            />
            <p className="text-sm text-ink-muted">
              {editableFormats.length
                ? editableFormats.map((action) => '.' + action.extension).join(', ')
                : zh
                  ? '当前扩展名只有查看动作。可重新发现应用以更新格式。'
                  : 'The current extensions have view actions only. Rediscover the application to update its formats.'}
            </p>
          </>
        ) : null}
      </div>
    </DialogSurface>
  );
}
