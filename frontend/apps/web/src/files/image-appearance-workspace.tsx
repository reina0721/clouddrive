'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Action } from '@clouddrive/ui-adapter/action';
import { FileChoiceAction } from '@clouddrive/ui-adapter/file-choice-action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { RangeSlider } from '@clouddrive/ui-adapter/range-slider';
import {
  defaultImageLogo,
  defaultWatermark,
  imageFilterNames,
  imageLogoSize,
  neutralImageTone,
  toneLimits,
  watermarkColors,
  watermarkOpacity,
  watermarkPositions,
  watermarkSizeLimit,
  watermarkTextLimit,
  type ImageAppearance,
  type ImageFilter,
  type ImageLogo,
  type ImageToneField,
  type ImageWatermark,
} from './image-appearance';
import { ImageCanvas } from './image-canvas';
import { drawFilterSample, type ImageEdit } from './image-edit';
import { imageFormats } from './image-format';
import {
  imageLogoLimit,
  readImageLogo,
  type ImageLogoAsset,
  type ImageLogoError,
} from './image-logo';

type WatermarkTool = 'watermark' | 'logo';
export type ImageAppearanceTool = 'tone' | 'filters' | WatermarkTool;
const logoFileTypes = Object.keys(imageFormats);

const zh = {
  brightness: '亮度',
  contrast: '对比度',
  saturation: '饱和度',
  hue: '色相',
  warmth: '色温',
  exposure: '曝光',
  filters: '滤镜预设',
  filter: {
    original: '原色',
    monochrome: '黑白',
    'warm-sepia': '棕褐',
    vivid: '鲜艳',
    fade: '柔和',
    cool: '冷调',
  },
  strength: '滤镜强度',
  resetTone: '重置色彩微调',
  compare: '查看原色对比',
  comparison: '原色对比只影响预览。应用和保存仍使用选定的外观。',
  apply: '应用外观调整',
  cancel: '取消外观调整',
  mark: '水印文字',
  position: '水印位置',
  positions: [
    '左上',
    '上方居中',
    '右上',
    '左侧居中',
    '中央',
    '右侧居中',
    '左下',
    '下方居中',
    '右下',
  ],
  color: '水印颜色',
  colors: ['白色', '黑色', '金色'],
  opacity: '水印不透明度',
  size: '水印字号比例',
  sizeHint: '字号按输出图片较短边的比例计算。',
  remove: '移除水印',
  invalid: '水印文字包含不支持的控制字符。',
  textTool: '文字水印',
  logoTool: '图片水印',
  chooseLogo: '选择水印图片',
  replaceLogo: '替换水印图片',
  removeLogo: '移除图片水印',
  logoPosition: '图片水印位置',
  logoSize: '图片水印尺寸',
  logoOpacity: '图片水印不透明度',
  logoHint: '选择本机 PNG、JPEG 或 WebP。图片只用于当前编辑。',
  logoLoading: '正在读取水印图片…',
  logoBytes: `水印文件超过 ${imageLogoLimit.mebibytes} MiB。`,
  logoDimensions: `水印图片每边最多 ${imageLogoLimit.sidePixels} 像素。`,
  logoInvalid: '无法读取这张水印图片，请选择有效的 PNG、JPEG 或 WebP。',
};
const en: typeof zh = {
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  hue: 'Hue',
  warmth: 'Warmth',
  exposure: 'Exposure',
  filters: 'Filter presets',
  filter: {
    original: 'Original',
    monochrome: 'Monochrome',
    'warm-sepia': 'Sepia',
    vivid: 'Vivid',
    fade: 'Fade',
    cool: 'Cool',
  },
  strength: 'Filter strength',
  resetTone: 'Reset color adjustments',
  compare: 'Compare original colors',
  comparison: 'Original colors are previewed only. Apply and save use the selected appearance.',
  apply: 'Apply appearance changes',
  cancel: 'Cancel appearance changes',
  mark: 'Watermark text',
  position: 'Watermark position',
  positions: [
    'Top left',
    'Top center',
    'Top right',
    'Middle left',
    'Center',
    'Middle right',
    'Bottom left',
    'Bottom center',
    'Bottom right',
  ],
  color: 'Watermark color',
  colors: ['White', 'Black', 'Gold'],
  opacity: 'Watermark opacity',
  size: 'Watermark font scale',
  sizeHint: 'Font size is a percentage of the shorter output side.',
  remove: 'Remove watermark',
  invalid: 'The watermark contains unsupported control characters.',
  textTool: 'Text watermark',
  logoTool: 'Image watermark',
  chooseLogo: 'Choose watermark image',
  replaceLogo: 'Replace watermark image',
  removeLogo: 'Remove image watermark',
  logoPosition: 'Image watermark position',
  logoSize: 'Image watermark size',
  logoOpacity: 'Image watermark opacity',
  logoHint: 'Choose a local PNG, JPEG or WebP. The image is used only for this edit.',
  logoLoading: 'Reading watermark image…',
  logoBytes: `The watermark file exceeds ${imageLogoLimit.mebibytes} MiB.`,
  logoDimensions: `The watermark image can have at most ${imageLogoLimit.sidePixels} pixels per side.`,
  logoInvalid: 'Could not read this watermark. Choose a valid PNG, JPEG or WebP.',
};

type AppearanceDraft = Omit<ImageAppearance, 'watermark'> & { watermark: ImageWatermark };
function appearanceDraft(appearance: ImageAppearance): AppearanceDraft {
  return { ...appearance, watermark: appearance.watermark ?? defaultWatermark };
}

function FilterSample({
  bitmap,
  edit,
  filter,
  selected,
  label,
  onSelect,
}: {
  bitmap: ImageBitmap;
  edit: ImageEdit;
  filter: ImageFilter;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    try {
      if (!drawFilterSample(element, bitmap, edit, filter)) element.hidden = true;
    } catch {
      // 小样不可用时保留可访问的预设名称和主画布。
      element.hidden = true;
    }
    return () => {
      element.width = 0;
      element.height = 0;
      element.hidden = false;
    };
  }, [bitmap, edit, filter]);
  return (
    <button
      type="button"
      aria-pressed={selected}
      className="flex flex-col items-center justify-center rounded-control border border-border bg-surface p-2 text-sm text-ink"
      style={{
        outline: selected ? '2px solid var(--color-brand)' : undefined,
        outlineOffset: selected ? -2 : undefined,
      }}
      onClick={onSelect}
    >
      <canvas aria-hidden="true" ref={canvas} style={{ maxWidth: '100%', height: 'auto' }} />
      {label}
    </button>
  );
}

function ValueSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="text-ink-muted">{display}</span>
      </div>
      <RangeSlider
        label={label}
        value={value}
        min={min}
        max={max}
        {...(step === undefined ? {} : { step })}
        disabled={disabled}
        onValueChange={onChange}
      />
    </div>
  );
}

/** ImageAppearanceWorkspace 负责外观草稿与比较显示，只有显式应用会进入历史。 */
export function ImageAppearanceWorkspace({
  bitmap,
  edit,
  tool,
  canvasLabels,
  chinese,
  onWatermarkTool,
  adoptLogo,
  discardLogo,
  onCommit,
  children,
}: {
  bitmap: ImageBitmap;
  edit: ImageEdit;
  tool: ImageAppearanceTool;
  canvasLabels: Readonly<{ canvas: string; decodeFailed: string }>;
  chinese: boolean;
  onWatermarkTool: (tool: WatermarkTool) => void;
  adoptLogo: (bitmap: ImageBitmap, name: string) => ImageLogoAsset;
  discardLogo: () => void;
  onCommit: (edit: ImageEdit) => void;
  children: (pending: boolean) => ReactNode;
}) {
  const labels = chinese ? zh : en;
  const [draft, setDraft] = useState(() => appearanceDraft(edit.appearance));
  const [compare, setCompare] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState<ImageLogoError>();
  const logoImport = useRef<AbortController>(undefined);
  useLayoutEffect(() => () => logoImport.current?.abort(), []);
  const text = draft.watermark.text.trim();
  const invalidText = /[\p{Cc}\p{Cf}]/u.test(text) || text.length > watermarkTextLimit;
  const appearance: ImageAppearance = {
    ...draft,
    watermark: text && !invalidText ? { ...draft.watermark, text } : null,
  };
  const pending =
    logoLoading || invalidText || JSON.stringify(appearance) !== JSON.stringify(edit.appearance);
  const positions = watermarkPositions.map((value, index) => ({
    value,
    label: labels.positions[index] ?? value,
  }));
  const preview = {
    ...edit,
    appearance: compare
      ? { ...appearance, tone: neutralImageTone, filter: 'original' as const }
      : appearance,
  };
  function changeWatermark(values: Partial<ImageWatermark>) {
    setDraft((current) => ({ ...current, watermark: { ...current.watermark, ...values } }));
  }

  function changeLogo(values: Partial<Omit<ImageLogo, 'asset'>>) {
    setDraft((current) =>
      current.logo ? { ...current, logo: { ...current.logo, ...values } } : current,
    );
  }

  async function importLogo(file: File) {
    if (logoImport.current) return;
    const controller = new AbortController();
    logoImport.current = controller;
    setLogoLoading(true);
    setLogoError(undefined);
    try {
      const result = await readImageLogo(file, controller.signal);
      if (controller.signal.aborted) {
        if ('bitmap' in result) result.bitmap.close();
        return;
      }
      if ('error' in result) {
        setLogoError(result.error);
        return;
      }
      const asset = adoptLogo(result.bitmap, file.name);
      setDraft((current) => ({
        ...current,
        logo: { ...(current.logo ?? defaultImageLogo), asset },
      }));
    } catch {
      if (!controller.signal.aborted) setLogoError('logoInvalid');
    } finally {
      if (logoImport.current === controller && !controller.signal.aborted) {
        logoImport.current = undefined;
        setLogoLoading(false);
      }
    }
  }

  function cancel() {
    logoImport.current?.abort();
    logoImport.current = undefined;
    setLogoLoading(false);
    setLogoError(undefined);
    discardLogo();
    setDraft(appearanceDraft(edit.appearance));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-0 space-y-3" style={{ flex: '4 1 26rem' }}>
          <ImageCanvas bitmap={bitmap} edit={preview} labels={canvasLabels} />
          <CheckboxField label={labels.compare} checked={compare} onCheckedChange={setCompare} />
          {compare ? <p className="text-xs text-ink-muted">{labels.comparison}</p> : null}
        </div>
        <div className="min-w-0 space-y-3" style={{ flex: '1 1 18rem' }}>
          {tool === 'watermark' || tool === 'logo' ? (
            <div className="flex flex-wrap gap-2">
              <Action
                size="sm"
                variant={tool === 'watermark' ? 'primary' : 'secondary'}
                onPress={() => onWatermarkTool('watermark')}
              >
                {labels.textTool}
              </Action>
              <Action
                size="sm"
                variant={tool === 'logo' ? 'primary' : 'secondary'}
                onPress={() => onWatermarkTool('logo')}
              >
                {labels.logoTool}
              </Action>
            </div>
          ) : null}
          {tool === 'tone' ? (
            <>
              {(Object.keys(toneLimits) as ImageToneField[]).map((field) => {
                const value = draft.tone[field];
                const display =
                  field === 'hue'
                    ? value + '°'
                    : field === 'exposure'
                      ? value.toFixed(1) + ' EV'
                      : value + '%';
                return (
                  <ValueSlider
                    key={field}
                    label={labels[field]}
                    value={value}
                    {...toneLimits[field]}
                    display={display}
                    onChange={(next) =>
                      setDraft((current) => ({
                        ...current,
                        tone: { ...current.tone, [field]: next },
                      }))
                    }
                  />
                );
              })}
              <Action
                size="sm"
                variant="quiet"
                disabled={Object.values(draft.tone).every((value) => value === 0)}
                onPress={() => setDraft((current) => ({ ...current, tone: neutralImageTone }))}
              >
                {labels.resetTone}
              </Action>
            </>
          ) : tool === 'filters' ? (
            <>
              <div
                role="group"
                aria-label={labels.filters}
                className="grid gap-2"
                style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
              >
                {imageFilterNames.map((filter) => (
                  <FilterSample
                    key={filter}
                    bitmap={bitmap}
                    edit={edit}
                    filter={filter}
                    selected={draft.filter === filter}
                    label={labels.filter[filter]}
                    onSelect={() => setDraft((current) => ({ ...current, filter }))}
                  />
                ))}
              </div>
              <ValueSlider
                label={labels.strength}
                value={draft.filterPercent}
                min={0}
                max={100}
                step={5}
                display={draft.filterPercent + '%'}
                disabled={draft.filter === 'original'}
                onChange={(filterPercent) => setDraft((current) => ({ ...current, filterPercent }))}
              />
            </>
          ) : tool === 'logo' ? (
            <>
              <FileChoiceAction
                acceptedTypes={logoFileTypes}
                disabled={logoLoading}
                onSelect={(file) => void importLogo(file)}
              >
                {draft.logo ? labels.replaceLogo : labels.chooseLogo}
              </FileChoiceAction>
              <p className="text-xs text-ink-muted">{labels.logoHint}</p>
              {logoLoading ? (
                <p role="status" className="text-sm text-ink-muted">
                  {labels.logoLoading}
                </p>
              ) : null}
              {logoError ? (
                <p role="alert" className="text-sm text-danger">
                  {labels[logoError]}
                </p>
              ) : null}
              {draft.logo ? (
                <>
                  <p className="text-sm text-ink-muted" style={{ overflowWrap: 'anywhere' }}>
                    {draft.logo.asset.name}
                  </p>
                  <SelectField
                    label={labels.logoPosition}
                    value={draft.logo.position}
                    options={positions}
                    onValueChange={(value) => {
                      const position = watermarkPositions.find((item) => item === value);
                      if (position) changeLogo({ position });
                    }}
                  />
                  <ValueSlider
                    label={labels.logoSize}
                    value={draft.logo.sizePercent}
                    {...imageLogoSize}
                    display={draft.logo.sizePercent + '%'}
                    onChange={(sizePercent) => changeLogo({ sizePercent })}
                  />
                  <ValueSlider
                    label={labels.logoOpacity}
                    value={draft.logo.opacityPercent}
                    {...watermarkOpacity}
                    display={draft.logo.opacityPercent + '%'}
                    onChange={(opacityPercent) => changeLogo({ opacityPercent })}
                  />
                  <Action
                    size="sm"
                    variant="quiet"
                    disabled={logoLoading}
                    onPress={() => {
                      setDraft((current) => ({ ...current, logo: null }));
                      setLogoError(undefined);
                      discardLogo();
                    }}
                  >
                    {labels.removeLogo}
                  </Action>
                </>
              ) : null}
            </>
          ) : (
            <>
              <TextField
                label={labels.mark}
                value={draft.watermark.text}
                maxLength={watermarkTextLimit}
                {...(invalidText ? { error: labels.invalid } : {})}
                onChange={(event) => changeWatermark({ text: event.currentTarget.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <SelectField
                  label={labels.position}
                  value={draft.watermark.position}
                  options={positions}
                  onValueChange={(value) => {
                    const position = watermarkPositions.find((item) => item === value);
                    if (position) changeWatermark({ position });
                  }}
                />
                <SelectField
                  label={labels.color}
                  value={draft.watermark.color}
                  options={watermarkColors.map((value, index) => ({
                    value,
                    label: labels.colors[index] ?? value,
                  }))}
                  onValueChange={(value) => {
                    const color = watermarkColors.find((item) => item === value);
                    if (color) changeWatermark({ color });
                  }}
                />
              </div>
              <ValueSlider
                label={labels.opacity}
                value={draft.watermark.opacityPercent}
                {...watermarkOpacity}
                display={draft.watermark.opacityPercent + '%'}
                onChange={(opacityPercent) => changeWatermark({ opacityPercent })}
              />
              <ValueSlider
                label={labels.size}
                value={draft.watermark.sizePercent}
                {...watermarkSizeLimit}
                display={draft.watermark.sizePercent + '%'}
                onChange={(sizePercent) => changeWatermark({ sizePercent })}
              />
              <p className="text-xs text-ink-muted">{labels.sizeHint}</p>
              <Action
                size="sm"
                variant="quiet"
                disabled={!draft.watermark.text}
                onPress={() => changeWatermark({ text: '' })}
              >
                {labels.remove}
              </Action>
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Action
              size="sm"
              disabled={!pending || invalidText || logoLoading}
              onPress={() => onCommit({ ...edit, appearance })}
            >
              {labels.apply}
            </Action>
            <Action size="sm" variant="quiet" disabled={!pending} onPress={cancel}>
              {labels.cancel}
            </Action>
          </div>
        </div>
      </div>
      {children(pending)}
    </div>
  );
}
