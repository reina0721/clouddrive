'use client';

import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Action } from '@clouddrive/ui-adapter/action';
import { FileChoiceAction } from '@clouddrive/ui-adapter/file-choice-action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import {
  annotationAt,
  annotationColors,
  annotationImageAngles,
  annotationImageSizes,
  annotationLimits,
  annotationOpacities,
  annotationTextSizes,
  annotationWidths,
  closedAnnotation,
  defaultAnnotationImageSizePercent,
  defaultAnnotationStyle,
  translateAnnotation,
  type AnnotationStyle,
  type ImageAnnotation,
  type ImagePoint,
  type RasterAnnotation,
} from './image-annotation';
import { ImageCanvas, type ImageCanvasView } from './image-canvas';
import { sourceImagePoint, type ImageEdit } from './image-edit';
import { imageOverlayLimit, imageOverlayTypes, type ImageOverlayAsset } from './image-overlay';
import { useImageOverlayImport } from './use-image-overlay-import';

const modes = [
  'select',
  'rectangle',
  'ellipse',
  'line',
  'arrow',
  'pen',
  'polygon',
  'text',
] as const;
type Mode = (typeof modes)[number];
const zh = {
  select: '选择',
  rectangle: '矩形',
  ellipse: '椭圆',
  line: '直线',
  arrow: '箭头',
  pen: '画笔',
  polygon: '多边形',
  text: '文字',
  image: '图片',
  tools: '标注工具',
  selected: '选中标注',
  noSelection: '未选中',
  color: '标注颜色',
  width: '线宽（像素）',
  opacity: '不透明度',
  fill: '填充形状',
  textSize: '文字大小（像素）',
  textValue: '标注文字',
  applyText: '应用文字',
  remove: '删除选中标注',
  clear: '清除全部标注',
  finish: '完成多边形',
  cancel: '取消多边形',
  hint: '在画布上拖动画形状，或选择已有标注后拖移。',
  polygonHint: '逐点点击画布，至少选择 3 个点后完成多边形。',
  textHint: '输入文字后点击画布放置。',
  limit: '已达到标注数量上限。',
  imageLimit: `编辑历史最多保留 ${annotationLimits.imageAssets} 张不同的标注图片。`,
  imageLoading: '正在读取标注图片…',
  cancelImage: '取消读取图片',
  overlayBytes: `标注文件超过 ${imageOverlayLimit.mebibytes} MiB。`,
  overlayDimensions: `标注图片每边最多 ${imageOverlayLimit.sidePixels} 像素。`,
  overlayInvalid: '无法读取这张标注图片，请选择有效的 PNG、JPEG 或 WebP。',
  imageSize: '标注图片大小',
  imageAngle: '标注图片旋转',
  duplicate: '复制选中图片',
  forward: '前移一层',
  backward: '后移一层',
  colors: ['红色', '蓝色', '绿色', '金色', '黑色', '白色'],
};
const en: typeof zh = {
  select: 'Select',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  arrow: 'Arrow',
  pen: 'Pen',
  polygon: 'Polygon',
  text: 'Text',
  image: 'Image',
  tools: 'Annotation tools',
  selected: 'Selected annotation',
  noSelection: 'None',
  color: 'Annotation color',
  width: 'Stroke width (pixels)',
  opacity: 'Opacity',
  fill: 'Fill shape',
  textSize: 'Text size (pixels)',
  textValue: 'Annotation text',
  applyText: 'Apply text',
  remove: 'Delete selected annotation',
  clear: 'Clear annotations',
  finish: 'Finish polygon',
  cancel: 'Cancel polygon',
  hint: 'Drag on the canvas to draw or select an annotation to move it.',
  polygonHint: 'Click at least three points on the canvas and finish the polygon.',
  textHint: 'Enter text, then click the canvas to place it.',
  limit: 'The image has reached its annotation limit.',
  imageLimit: `Edit history holds up to ${annotationLimits.imageAssets} distinct annotation images.`,
  imageLoading: 'Reading annotation image…',
  cancelImage: 'Cancel image import',
  overlayBytes: `The annotation file exceeds ${imageOverlayLimit.mebibytes} MiB.`,
  overlayDimensions: `The annotation image can have at most ${imageOverlayLimit.sidePixels} pixels per side.`,
  overlayInvalid: 'Could not read this annotation image. Choose a valid PNG, JPEG or WebP.',
  imageSize: 'Annotation image size',
  imageAngle: 'Annotation image rotation',
  duplicate: 'Duplicate selected image',
  forward: 'Move forward one layer',
  backward: 'Move back one layer',
  colors: ['Red', 'Blue', 'Green', 'Gold', 'Black', 'White'],
};

type CanvasEvent = PointerEvent<HTMLCanvasElement>;
type Drag = Readonly<{
  pointerId: number;
  start: ImagePoint;
  annotation: ImageAnnotation;
  mode: 'draw' | 'move';
}>;
const none = 'none';
const minimumPenStepPixels = 2;
const duplicateOffsetPixels = 12;

function sourcePoint(event: CanvasEvent, edit: ImageEdit) {
  const canvas = event.currentTarget;
  const bounds = canvas.getBoundingClientRect();
  return sourceImagePoint(edit, canvas, {
    x: ((event.clientX - bounds.left) * canvas.width) / bounds.width,
    y: ((event.clientY - bounds.top) * canvas.height) / bounds.height,
  });
}

function numberOptions(values: readonly number[], suffix = '') {
  return values.map((value) => ({ value: String(value), label: String(value) + suffix }));
}

/** ImageAnnotationWorkspace 拥有未提交手势，完成时才加入图片编辑历史。 */
export function ImageAnnotationWorkspace({
  bitmap,
  edit,
  canvasLabels,
  view,
  chinese,
  imageAssetCount,
  adoptImage,
  onCommit,
  children,
}: {
  bitmap: ImageBitmap;
  edit: ImageEdit;
  canvasLabels: Readonly<{ canvas: string; decodeFailed: string }>;
  view: ImageCanvasView;
  chinese: boolean;
  imageAssetCount: number;
  adoptImage: (bitmap: ImageBitmap, name: string) => ImageOverlayAsset;
  onCommit: (edit: ImageEdit) => void;
  children: (pending: boolean) => ReactNode;
}) {
  const labels = chinese ? zh : en;
  const [mode, setMode] = useState<Mode>('rectangle');
  const [defaults, setDefaults] = useState(defaultAnnotationStyle);
  const [selectedId, setSelectedId] = useState<number>();
  const [draft, setDraft] = useState<ImageAnnotation>();
  const [polygon, setPolygon] = useState<readonly ImagePoint[]>([]);
  const [newText, setNewText] = useState('');
  const [textEdit, setTextEdit] = useState<{ id: number; text: string }>();
  const imageImport = useImageOverlayImport();
  const drag = useRef<Drag | undefined>(undefined);
  const nextId = useRef(Math.max(0, ...edit.annotations.map(({ id }) => id)) + 1);
  const currentEdit = useRef(edit);
  useLayoutEffect(() => {
    currentEdit.current = edit;
  }, [edit]);
  const selected = edit.annotations.find(({ id }) => id === selectedId);
  const active = mode === 'select' ? selected : undefined;
  const raster = active?.kind === 'image' ? active : undefined;
  const activeIndex = raster ? edit.annotations.indexOf(raster) : -1;
  const textAnnotation = active?.kind === 'text' ? active : undefined;
  const kind = active?.kind ?? mode;
  const style = active?.style ?? defaults;
  const limitReached = edit.annotations.length >= annotationLimits.count;
  const imageLimitReached = imageAssetCount >= annotationLimits.imageAssets;
  const textInput = textAnnotation
    ? textEdit?.id === textAnnotation.id
      ? textEdit.text
      : textAnnotation.text
    : newText;
  const text = textInput.trim();
  const canUseText =
    Boolean(text) && text.length <= annotationLimits.textLength && !/[\p{Cc}\p{Cf}]/u.test(text);

  function updateAnnotations(annotations: readonly ImageAnnotation[]) {
    onCommit({ ...edit, annotations });
  }

  function replace(annotation: ImageAnnotation) {
    updateAnnotations(
      edit.annotations.map((item) => (item.id === annotation.id ? annotation : item)),
    );
  }

  function add(annotation: ImageAnnotation) {
    updateAnnotations([...edit.annotations, annotation]);
    // 连续笔迹保留画笔。其余新对象完成后可直接调整样式或位置。
    if (annotation.kind === 'pen') setSelectedId(undefined);
    else {
      setMode('select');
      setSelectedId(annotation.id);
    }
  }

  function changeStyle(change: Partial<AnnotationStyle>) {
    const next = { ...style, ...change };
    if (active) replace({ ...active, style: next });
    else setDefaults(next);
  }

  function changeMode(next: Mode) {
    drag.current = undefined;
    setDraft(undefined);
    setPolygon([]);
    setTextEdit(undefined);
    if (next !== 'select') setSelectedId(undefined);
    setMode(next);
  }

  function acceptImage(bitmap: ImageBitmap, name: string) {
    const latest = currentEdit.current;
    const crop = latest.crop;
    const annotation: RasterAnnotation = {
      id: nextId.current++,
      kind: 'image',
      anchor: { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 },
      fitScale: Math.min(crop.width / bitmap.width, crop.height / bitmap.height),
      sizePercent: defaultAnnotationImageSizePercent,
      angleDegrees: 0,
      style: defaultAnnotationStyle,
      asset: adoptImage(bitmap, name),
    };
    onCommit({ ...latest, annotations: [...latest.annotations, annotation] });
    setMode('select');
    setSelectedId(annotation.id);
  }

  function duplicateImage(annotation: RasterAnnotation) {
    const { crop } = edit;
    const shift = (value: number, start: number, length: number) =>
      Math.min(
        start + length,
        Math.max(
          start,
          value + (value >= start + length / 2 ? -duplicateOffsetPixels : duplicateOffsetPixels),
        ),
      );
    add({
      ...annotation,
      id: nextId.current++,
      anchor: {
        x: shift(annotation.anchor.x, crop.x, crop.width),
        y: shift(annotation.anchor.y, crop.y, crop.height),
      },
    });
  }

  function moveLayer(index: number, step: -1 | 1) {
    const annotations = [...edit.annotations];
    const current = annotations[index];
    const other = annotations[index + step];
    if (!current || !other) return;
    annotations[index] = other;
    annotations[index + step] = current;
    updateAnnotations(annotations);
  }

  function updateGesture(current: Drag, point: ImagePoint) {
    if (current.mode === 'move') {
      return translateAnnotation(
        current.annotation,
        point.x - current.start.x,
        point.y - current.start.y,
      );
    }
    const annotation = current.annotation;
    if (annotation.kind === 'text' || annotation.kind === 'image') return annotation;
    if (annotation.kind !== 'pen') return { ...annotation, points: [current.start, point] };
    const last = annotation.points.at(-1);
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) < minimumPenStepPixels)
      return annotation;
    const points =
      annotation.points.length < annotationLimits.pathPoints
        ? [...annotation.points, point]
        : [...annotation.points.slice(0, -1), point];
    return { ...annotation, points };
  }

  function pointerDown(event: CanvasEvent) {
    if (!event.isPrimary || event.button !== 0 || drag.current || imageImport.loading) return;
    const start = sourcePoint(event, edit);
    if (mode === 'select') {
      const bounds = event.currentTarget.getBoundingClientRect();
      const tolerance = Math.max(
        2,
        (5 * Math.max(edit.crop.width, edit.crop.height)) / Math.max(bounds.width, bounds.height),
      );
      const annotation = annotationAt(event.currentTarget, edit.annotations, start, tolerance);
      setSelectedId(annotation?.id);
      setTextEdit(undefined);
      if (!annotation) return;
      drag.current = { pointerId: event.pointerId, start, annotation, mode: 'move' };
    } else {
      if (limitReached) return;
      if (mode === 'polygon') {
        setPolygon((points) =>
          points.length < annotationLimits.polygonPoints ? [...points, start] : points,
        );
        return;
      }
      if (mode === 'text') {
        if (canUseText) add({ id: nextId.current++, kind: 'text', anchor: start, style, text });
        return;
      }
      drag.current = {
        pointerId: event.pointerId,
        start,
        mode: 'draw',
        annotation: { id: nextId.current++, kind: mode, style, points: [start] },
      };
    }
    setDraft(drag.current.annotation);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: CanvasEvent) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    const annotation = updateGesture(current, sourcePoint(event, edit));
    if (current.mode === 'draw' && annotation.kind === 'pen')
      drag.current = { ...current, annotation };
    setDraft(annotation);
  }

  function pointerUp(event: CanvasEvent) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    setDraft(undefined);
    const point = sourcePoint(event, edit);
    const annotation = updateGesture(current, point);
    if (current.mode === 'move') {
      if (point.x !== current.start.x || point.y !== current.start.y) replace(annotation);
      return;
    }
    if (annotation.kind === 'text' || annotation.kind === 'image' || annotation.points.length < 2)
      return;
    if (closedAnnotation(annotation.kind)) {
      if (point.x === current.start.x || point.y === current.start.y) return;
    } else if (
      annotation.kind !== 'pen' &&
      point.x === current.start.x &&
      point.y === current.start.y
    ) {
      return;
    }
    add(annotation);
  }

  function cancelPointer(event: CanvasEvent) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    setDraft(undefined);
  }

  const provisional =
    draft ??
    (polygon.length > 1
      ? ({ id: 0, kind: 'pen', style, points: polygon } satisfies ImageAnnotation)
      : undefined);
  const preview = provisional
    ? {
        ...edit,
        annotations: edit.annotations.some(({ id }) => id === provisional.id)
          ? edit.annotations.map((annotation) =>
              annotation.id === provisional.id ? provisional : annotation,
            )
          : [...edit.annotations, provisional],
      }
    : edit;
  const options = [
    { value: none, label: labels.noSelection },
    ...edit.annotations.map((item) => ({
      value: String(item.id),
      label: labels[item.kind] + ' #' + item.id,
    })),
  ];
  const editingStyle = mode !== 'select' || active !== undefined;

  return (
    <div className="space-y-3">
      <div role="group" aria-label={labels.tools} className="flex flex-wrap gap-2">
        {modes.map((item) => (
          <Action
            key={item}
            size="sm"
            variant={mode === item ? 'primary' : 'secondary'}
            onPress={() => changeMode(item)}
          >
            {labels[item]}
          </Action>
        ))}
        <FileChoiceAction
          acceptedTypes={imageOverlayTypes}
          disabled={limitReached || imageLimitReached || imageImport.loading}
          onSelect={(file) => {
            changeMode('select');
            void imageImport.read(file, acceptImage);
          }}
        >
          {labels.image}
        </FileChoiceAction>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-0 space-y-2" style={{ flex: '4 1 26rem' }}>
          <ImageCanvas
            view={view}
            bitmap={bitmap}
            edit={preview}
            labels={canvasLabels}
            {...(selected ? { selectedAnnotation: selected.id } : {})}
            interaction={{
              cursor: mode === 'select' ? 'move' : 'crosshair',
              down: pointerDown,
              move: pointerMove,
              up: pointerUp,
              cancel: cancelPointer,
            }}
          />
          <p className="text-xs text-ink-muted">
            {mode === 'polygon'
              ? labels.polygonHint
              : mode === 'text'
                ? labels.textHint
                : labels.hint}
          </p>
          {limitReached ? <p role="status">{labels.limit}</p> : null}
          {imageLimitReached ? <p role="status">{labels.imageLimit}</p> : null}
          {imageImport.loading ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="status">{labels.imageLoading}</p>
              <Action size="sm" variant="quiet" onPress={imageImport.cancel}>
                {labels.cancelImage}
              </Action>
            </div>
          ) : null}
          {imageImport.error ? <p role="alert">{labels[imageImport.error]}</p> : null}
          {mode === 'polygon' ? (
            <div className="flex flex-wrap items-center gap-2">
              <Action
                size="sm"
                disabled={polygon.length < 3 || limitReached}
                onPress={() => {
                  add({ id: nextId.current++, kind: 'polygon', style, points: polygon });
                  setPolygon([]);
                }}
              >
                {labels.finish}
              </Action>
              <Action
                size="sm"
                variant="quiet"
                disabled={!polygon.length}
                onPress={() => setPolygon([])}
              >
                {labels.cancel}
              </Action>
              <p role="status">
                {polygon.length} / {annotationLimits.polygonPoints}
              </p>
            </div>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2" style={{ flex: '1 1 17rem' }}>
          <SelectField
            label={labels.selected}
            value={selected ? String(selected.id) : none}
            options={options}
            onValueChange={(value) => {
              changeMode('select');
              setSelectedId(value === none ? undefined : Number(value));
            }}
          />
          {editingStyle ? (
            <div className="grid grid-cols-2 gap-2">
              {!raster ? (
                <SelectField
                  label={labels.color}
                  value={style.color}
                  options={annotationColors.map((value, index) => ({
                    value,
                    label: labels.colors[index] ?? value,
                  }))}
                  onValueChange={(value) => {
                    const color = annotationColors.find((item) => item === value);
                    if (color) changeStyle({ color });
                  }}
                />
              ) : null}
              <SelectField
                label={labels.opacity}
                value={String(style.opacity)}
                options={numberOptions(annotationOpacities, '%')}
                onValueChange={(value) => {
                  const opacity = annotationOpacities.find((item) => item === Number(value));
                  if (opacity) changeStyle({ opacity });
                }}
              />
              {raster ? (
                <>
                  <SelectField
                    label={labels.imageSize}
                    value={String(raster.sizePercent)}
                    options={numberOptions(annotationImageSizes, '%')}
                    onValueChange={(value) => {
                      const sizePercent = annotationImageSizes.find(
                        (item) => item === Number(value),
                      );
                      if (sizePercent !== undefined) replace({ ...raster, sizePercent });
                    }}
                  />
                  <SelectField
                    label={labels.imageAngle}
                    value={String(raster.angleDegrees)}
                    options={numberOptions(annotationImageAngles, '°')}
                    onValueChange={(value) => {
                      const angleDegrees = annotationImageAngles.find(
                        (item) => item === Number(value),
                      );
                      if (angleDegrees !== undefined) replace({ ...raster, angleDegrees });
                    }}
                  />
                </>
              ) : kind === 'text' ? (
                <SelectField
                  label={labels.textSize}
                  value={String(style.textSize)}
                  options={numberOptions(annotationTextSizes)}
                  onValueChange={(value) => {
                    const textSize = annotationTextSizes.find((item) => item === Number(value));
                    if (textSize) changeStyle({ textSize });
                  }}
                />
              ) : (
                <SelectField
                  label={labels.width}
                  value={String(style.width)}
                  options={numberOptions(annotationWidths)}
                  onValueChange={(value) => {
                    const width = annotationWidths.find((item) => item === Number(value));
                    if (width) changeStyle({ width });
                  }}
                />
              )}
              {kind !== 'select' && closedAnnotation(kind) ? (
                <CheckboxField
                  label={labels.fill}
                  checked={style.fill}
                  onCheckedChange={(fill) => changeStyle({ fill })}
                />
              ) : null}
            </div>
          ) : null}
          {kind === 'text' ? (
            <TextField
              label={labels.textValue}
              value={textInput}
              maxLength={annotationLimits.textLength}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (textAnnotation) setTextEdit({ id: textAnnotation.id, text: value });
                else setNewText(value);
              }}
            />
          ) : null}
          {textAnnotation ? (
            <Action
              size="sm"
              variant="secondary"
              disabled={!canUseText || text === textAnnotation.text}
              onPress={() => {
                replace({ ...textAnnotation, text });
                setTextEdit(undefined);
              }}
            >
              {labels.applyText}
            </Action>
          ) : null}
          {raster ? (
            <>
              <p className="text-xs text-ink-muted" style={{ overflowWrap: 'anywhere' }}>
                {raster.asset.name}
              </p>
              <div className="flex flex-wrap gap-2">
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={limitReached || imageImport.loading}
                  onPress={() => duplicateImage(raster)}
                >
                  {labels.duplicate}
                </Action>
                <Action
                  size="sm"
                  variant="quiet"
                  disabled={activeIndex === edit.annotations.length - 1}
                  onPress={() => moveLayer(activeIndex, 1)}
                >
                  {labels.forward}
                </Action>
                <Action
                  size="sm"
                  variant="quiet"
                  disabled={activeIndex <= 0}
                  onPress={() => moveLayer(activeIndex, -1)}
                >
                  {labels.backward}
                </Action>
              </div>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Action
              size="sm"
              variant="quiet"
              disabled={!selected}
              onPress={() => {
                updateAnnotations(edit.annotations.filter(({ id }) => id !== selected?.id));
                setSelectedId(undefined);
              }}
            >
              {labels.remove}
            </Action>
            <Action
              size="sm"
              variant="quiet"
              disabled={!edit.annotations.length}
              onPress={() => {
                updateAnnotations([]);
                setSelectedId(undefined);
              }}
            >
              {labels.clear}
            </Action>
          </div>
        </div>
      </div>
      {children(
        imageImport.loading ||
          Boolean(draft) ||
          polygon.length > 0 ||
          Boolean(
            textAnnotation && textEdit?.id === textAnnotation.id && text !== textAnnotation.text,
          ),
      )}
    </div>
  );
}
