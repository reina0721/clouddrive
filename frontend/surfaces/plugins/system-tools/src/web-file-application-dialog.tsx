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
  const title = application
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
  const parsed = parseFileApplicationExtensions(extensions);
  const origin = webFilePreviewOrigin(template.trim());
  const maxBytes = Number(size);
  const invalidSize =
    !/^\d+$/.test(size) || !Number.isSafeInteger(maxBytes) || maxBytes > maxWebApplicationBytes;
  const invalidIcon = !!icon.trim() && !fileIconImageAllowed(icon.trim());
  const invalidName = !name.trim() || [...name.trim()].length > 64 || /\p{Cc}/u.test(name.trim());
  const disabled =
    invalidName ||
    invalidIcon ||
    invalidSize ||
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
          ? '网页应用通过短期地址读取用户确认的文件。'
          : 'Web applications read an approved file through a temporary address.'
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
          {...('error' in parsed
            ? {
                error: zh ? '请检查扩展名格式或重复项。' : 'Check extension format and duplicates.',
              }
            : {})}
          onChange={(event) => setExtensions(event.target.value)}
        />
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
      </div>
    </DialogSurface>
  );
}
