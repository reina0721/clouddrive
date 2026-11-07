'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { useCallback, useState } from 'react';
import {
  fileIconColorPattern,
  fileIconExtensionPattern,
  fileIconImageAllowed,
  fileIconShapes,
  type FileIconRule,
  type FileIconRuleSet,
  type FileIconRulesView,
} from '../../../src/files/icon-rules';
import { FileGlyph } from '../../../src/files/icons';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';

const zh = {
  title: '文件图标',
  description: '按文件扩展名设置图标。外部图像由用户浏览器请求，来源须允许跨源读取。',
  inherited: '当前使用内置规则',
  customized: '当前使用自定义规则',
  add: '添加图标',
  edit: '编辑图标',
  remove: '移除',
  restore: '恢复内置规则',
  save: '保存图标规则',
  apply: '应用到草稿',
  extensions: '扩展名列表',
  shape: '图标类型',
  light: '浅色图标颜色',
  dark: '深色图标颜色',
  image: '图像 URL',
  extensionHint: '用逗号或空格分隔，每行最多 24 个。',
  colorHint: '使用六位十六进制颜色。深色留空时使用浅色。',
  imageHint: '使用允许跨源读取的 HTTPS 图片地址。',
  extensionError: '扩展名无效或超过数量上限。',
  duplicate: '扩展名已在本行或其他规则中使用。',
  colorError: '请输入六位十六进制颜色。',
  imageError: '请输入合规的 HTTPS 图片地址。',
  readonly: '当前账号只有查看权限。',
  empty: '暂无扩展名图标规则。',
  changed: '草稿尚未保存。',
  saved: '文件图标规则已保存。',
  conflict: '其他管理员已更新图标规则。请刷新后重试。',
  failed: '保存图标规则失败。请检查输入或重试。',
  shapes: {
    file: '文件',
    text: '文档',
    image: '图片',
    video: '视频',
    audio: '音频',
    archive: '压缩包',
    code: '代码',
    pdf: 'PDF',
    spreadsheet: '表格',
    'image-url': '图像 URL',
  },
};
const en: typeof zh = {
  title: 'File icons',
  description:
    'Choose icons by file extension. External images are requested by the browser and require cross-origin access.',
  inherited: 'Using built-in rules',
  customized: 'Using custom rules',
  add: 'Add icon',
  edit: 'Edit icon',
  remove: 'Remove',
  restore: 'Restore built-in rules',
  save: 'Save icon rules',
  apply: 'Apply to draft',
  extensions: 'Extensions',
  shape: 'Icon type',
  light: 'Light icon color',
  dark: 'Dark icon color',
  image: 'Image URL',
  extensionHint: 'Separate up to 24 extensions with commas or spaces.',
  colorHint: 'Use a six-digit hex color. A blank dark color uses the light color.',
  imageHint: 'Use an HTTPS image URL that permits cross-origin access.',
  extensionError: 'Enter valid extensions within the limit.',
  duplicate: 'An extension is already used in this or another rule.',
  colorError: 'Enter a six-digit hex color.',
  imageError: 'Enter an allowed HTTPS image URL.',
  readonly: 'Your account has read-only access.',
  empty: 'No extension icon rules.',
  changed: 'Unsaved draft.',
  saved: 'File icon rules saved.',
  conflict: 'Another administrator updated the icon rules. Refresh and try again.',
  failed: 'Could not save icon rules. Check the values or try again.',
  shapes: {
    file: 'File',
    text: 'Document',
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    archive: 'Archive',
    code: 'Code',
    pdf: 'PDF',
    spreadsheet: 'Spreadsheet',
    'image-url': 'Image URL',
  },
};

function RuleEditor({
  initial,
  rules,
  labels,
  onClose,
  onApply,
}: {
  initial: FileIconRule | undefined;
  rules: readonly FileIconRule[];
  labels: typeof zh;
  onClose: () => void;
  onApply: (rule: FileIconRule) => void;
}) {
  const { t } = useFrontendTranslation();
  const [shape, setShape] = useState(initial?.shape ?? 'file');
  const [extensions, setExtensions] = useState(initial?.extensions.join(', ') ?? '');
  const [light, setLight] = useState(initial?.light ?? '');
  const [dark, setDark] = useState(initial?.dark ?? '');
  const [image, setImage] = useState(initial?.imageUrl ?? '');
  const normalized = extensions
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((ext) => ext.replace(/^\./, '').toLowerCase());
  const used = new Set(rules.flatMap((rule) => rule.extensions));
  const invalidExtensions =
    normalized.length > 24 || normalized.some((ext) => !fileIconExtensionPattern.test(ext));
  const duplicate =
    new Set(normalized).size !== normalized.length || normalized.some((ext) => used.has(ext));
  const isImage = shape === 'image-url';
  const lightColor = light.trim().toLowerCase();
  const darkColor = dark.trim().toLowerCase();
  const imageURL = image.trim();
  const invalidLight = !fileIconColorPattern.test(lightColor);
  const invalidDark = !!darkColor && !fileIconColorPattern.test(darkColor);
  const validImage = fileIconImageAllowed(imageURL);
  const valid =
    !!normalized.length &&
    !invalidExtensions &&
    !duplicate &&
    (isImage ? validImage : !invalidLight && !invalidDark);
  const rule: FileIconRule = {
    shape,
    extensions: normalized,
    ...(isImage
      ? { imageUrl: imageURL }
      : { light: lightColor, ...(darkColor ? { dark: darkColor } : {}) }),
  };
  return (
    <DialogSurface
      isOpen
      triggerLabel={labels.add}
      title={initial ? labels.edit : labels.add}
      description={labels.extensionHint}
      cancelLabel={t('files.cancel')}
      confirmLabel={labels.apply}
      confirmDisabled={!valid}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() => {
        if (valid) onApply(rule);
        return Promise.resolve();
      }}
    >
      <div className="min-w-0 space-y-4">
        <SelectField
          label={labels.shape}
          value={shape}
          options={fileIconShapes.map((value) => ({ value, label: labels.shapes[value] }))}
          onValueChange={(value) => {
            const selected = fileIconShapes.find((option) => option === value);
            if (selected) setShape(selected);
          }}
        />
        <TextField
          label={labels.extensions}
          value={extensions}
          maxLength={640}
          onChange={(event) => setExtensions(event.target.value)}
          {...(invalidExtensions || duplicate
            ? { error: invalidExtensions ? labels.extensionError : labels.duplicate }
            : {})}
        />
        {isImage ? (
          <TextField
            label={labels.image}
            value={image}
            maxLength={512}
            hint={labels.imageHint}
            onChange={(event) => setImage(event.target.value)}
            {...(image && !validImage ? { error: labels.imageError } : {})}
          />
        ) : (
          <>
            <TextField
              label={labels.light}
              value={light}
              maxLength={7}
              hint={labels.colorHint}
              onChange={(event) => setLight(event.target.value)}
              {...(light && invalidLight ? { error: labels.colorError } : {})}
            />
            <TextField
              label={labels.dark}
              value={dark}
              maxLength={7}
              onChange={(event) => setDark(event.target.value)}
              {...(invalidDark ? { error: labels.colorError } : {})}
            />
            {!invalidLight && !invalidDark ? (
              <FileGlyph kind="file" mediaType="" rule={rule} />
            ) : null}
          </>
        )}
      </div>
    </DialogSurface>
  );
}

function RulesEditor({
  initial,
  labels,
  refresh,
}: {
  initial: FileIconRulesView;
  labels: typeof zh;
  refresh: () => void;
}) {
  const { saveFileIconRules } = useFiles();
  const { t } = useFrontendTranslation();
  const [view, setView] = useState(initial);
  const [draft, setDraft] = useState<Pick<FileIconRuleSet, 'inherit' | 'items'>>();
  const [editing, setEditing] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'saved' | 'failed' | 'conflict'>();
  const current = draft ?? view;
  const items = current.inherit ? view.defaults : current.items;
  const editable = view.canSave && !busy && status !== 'conflict';
  const stage = (items: FileIconRule[]) => {
    setDraft({ inherit: false, items });
    setStatus(undefined);
  };
  async function save() {
    if (!draft || !editable) return;
    setBusy(true);
    setStatus(undefined);
    try {
      const next = await saveFileIconRules({ revision: view.revision, ...draft });
      setView(next);
      setDraft(undefined);
      setStatus('saved');
    } catch (error) {
      setStatus(error instanceof FilesError && error.code === 'conflict' ? 'conflict' : 'failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Action
          variant="secondary"
          onPress={() => setEditing(items.length)}
          disabled={!editable || items.length >= 32}
        >
          {labels.add}
        </Action>
        <Action
          variant="secondary"
          disabled={!editable || current.inherit}
          onPress={() => {
            setDraft({ inherit: true, items: [] });
            setStatus(undefined);
          }}
        >
          {labels.restore}
        </Action>
        <Action disabled={!editable || !draft} onPress={() => void save()}>
          {labels.save}
        </Action>
        <Action variant="quiet" disabled={busy} onPress={refresh}>
          {t('files.refresh')}
        </Action>
      </div>
      <p role="status" className="text-sm text-ink-muted">
        {status === 'saved'
          ? labels.saved
          : draft
            ? labels.changed
            : view.inherit
              ? labels.inherited
              : labels.customized}
      </p>
      {!view.canSave ? <p className="text-sm text-ink-muted">{labels.readonly}</p> : null}
      {status === 'failed' || status === 'conflict' ? (
        <p role="alert" className="text-sm text-danger">
          {labels[status]}
        </p>
      ) : null}
      {!items.length ? (
        <p>{labels.empty}</p>
      ) : (
        <ul className="min-w-0 space-y-2" aria-label={labels.title}>
          {items.map((rule, index) => (
            <li key={rule.extensions.join(',')}>
              <Panel className="surface-route-region">
                <div className="flex min-w-0 flex-wrap items-center gap-3 p-3">
                  <FileGlyph kind="file" mediaType="" size="small" rule={rule} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{labels.shapes[rule.shape]}</p>
                    <p className="break-all text-sm text-ink-muted">{rule.extensions.join(', ')}</p>
                    <p className="break-all text-xs text-ink-muted">
                      {rule.imageUrl ?? [rule.light, rule.dark].filter(Boolean).join(' / ')}
                    </p>
                  </div>
                  <Action
                    size="sm"
                    variant="secondary"
                    disabled={!editable}
                    onPress={() => setEditing(index)}
                  >
                    {labels.edit}
                  </Action>
                  <Action
                    size="sm"
                    variant="quiet"
                    disabled={!editable}
                    onPress={() => stage(items.filter((_, position) => position !== index))}
                  >
                    {labels.remove}
                  </Action>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
      {editing !== undefined ? (
        <RuleEditor
          initial={items[editing]}
          rules={items.filter((_, index) => index !== editing)}
          labels={labels}
          onClose={() => setEditing(undefined)}
          onApply={(rule) => {
            const next = [...items];
            next[editing] = rule;
            stage(next);
            setEditing(undefined);
          }}
        />
      ) : null}
    </div>
  );
}

export function FileIconRulesPanel() {
  const { readFileIconRules } = useFiles();
  const { locale, t } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const state = useCatalogRequest(
    useCallback((signal) => readFileIconRules(signal), [readFileIconRules]),
  );
  return (
    <div className="min-w-0 space-y-4">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      <p>{labels.description}</p>
      {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
      {state.result && 'error' in state.result ? (
        <CatalogFailure error={state.result.error} retry={state.refresh} />
      ) : null}
      {state.result && 'value' in state.result ? (
        <RulesEditor initial={state.result.value} labels={labels} refresh={state.refresh} />
      ) : null}
    </div>
  );
}
