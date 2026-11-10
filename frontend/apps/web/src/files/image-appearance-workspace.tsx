'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { RangeSlider } from '@clouddrive/ui-adapter/range-slider';
import {
  defaultWatermark,
  imageFilterNames,
  neutralImageTone,
  toneLimits,
  watermarkColors,
  watermarkPositions,
  watermarkSizeLimit,
  watermarkTextLimit,
  type ImageAppearance,
  type ImageFilter,
  type ImageToneField,
  type ImageWatermark,
} from './image-appearance';
import { ImageCanvas } from './image-canvas';
import { drawFilterSample, type ImageEdit } from './image-edit';

export type ImageAppearanceTool = 'tone' | 'filters' | 'watermark';

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
  onCommit,
  children,
}: {
  bitmap: ImageBitmap;
  edit: ImageEdit;
  tool: ImageAppearanceTool;
  canvasLabels: Readonly<{ canvas: string; decodeFailed: string }>;
  chinese: boolean;
  onCommit: (edit: ImageEdit) => void;
  children: (pending: boolean) => ReactNode;
}) {
  const labels = chinese ? zh : en;
  const [draft, setDraft] = useState(() => appearanceDraft(edit.appearance));
  const [compare, setCompare] = useState(false);
  const text = draft.watermark.text.trim();
  const invalidText = /[\p{Cc}\p{Cf}]/u.test(text) || text.length > watermarkTextLimit;
  const appearance: ImageAppearance = {
    ...draft,
    watermark: text && !invalidText ? { ...draft.watermark, text } : null,
  };
  const pending = invalidText || JSON.stringify(appearance) !== JSON.stringify(edit.appearance);
  const preview = {
    ...edit,
    appearance: compare
      ? { ...appearance, tone: neutralImageTone, filter: 'original' as const }
      : appearance,
  };
  function changeWatermark(values: Partial<ImageWatermark>) {
    setDraft((current) => ({ ...current, watermark: { ...current.watermark, ...values } }));
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
                  options={watermarkPositions.map((value, index) => ({
                    value,
                    label: labels.positions[index] ?? value,
                  }))}
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
                min={5}
                max={100}
                step={5}
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
              disabled={!pending || invalidText}
              onPress={() => onCommit({ ...edit, appearance })}
            >
              {labels.apply}
            </Action>
            <Action
              size="sm"
              variant="quiet"
              disabled={!pending}
              onPress={() => setDraft(appearanceDraft(edit.appearance))}
            >
              {labels.cancel}
            </Action>
          </div>
        </div>
      </div>
      {children(pending)}
    </div>
  );
}
