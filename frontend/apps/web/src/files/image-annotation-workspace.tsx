'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import {
  annotationAt,
  annotationColors,
  annotationLimits,
  annotationOpacities,
  annotationTextSizes,
  annotationWidths,
  closedAnnotation,
  defaultAnnotationStyle,
  translateAnnotation,
  type AnnotationStyle,
  type ImageAnnotation,
  type ImagePoint,
} from './image-annotation';
import { ImageCanvas, type ImageCanvasView } from './image-canvas';
import { sourceImagePoint, type ImageEdit } from './image-edit';

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
  onCommit,
  children,
}: {
  bitmap: ImageBitmap;
  edit: ImageEdit;
  canvasLabels: Readonly<{ canvas: string; decodeFailed: string }>;
  view: ImageCanvasView;
  chinese: boolean;
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
  const drag = useRef<Drag | undefined>(undefined);
  const nextId = useRef(Math.max(0, ...edit.annotations.map(({ id }) => id)) + 1);
  const selected = edit.annotations.find(({ id }) => id === selectedId);
  const active = mode === 'select' ? selected : undefined;
  const textAnnotation = active?.kind === 'text' ? active : undefined;
  const kind = active?.kind ?? mode;
  const style = active?.style ?? defaults;
  const limitReached = edit.annotations.length >= annotationLimits.count;
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

  function updateGesture(current: Drag, point: ImagePoint) {
    if (current.mode === 'move') {
      return translateAnnotation(
        current.annotation,
        point.x - current.start.x,
        point.y - current.start.y,
      );
    }
    const annotation = current.annotation;
    if (annotation.kind === 'text') return annotation;
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
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
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
    if (annotation.kind === 'text' || annotation.points.length < 2) return;
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
              <SelectField
                label={labels.opacity}
                value={String(style.opacity)}
                options={numberOptions(annotationOpacities, '%')}
                onValueChange={(value) => {
                  const opacity = annotationOpacities.find((item) => item === Number(value));
                  if (opacity) changeStyle({ opacity });
                }}
              />
              {kind === 'text' ? (
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
        Boolean(draft) ||
          polygon.length > 0 ||
          Boolean(
            textAnnotation && textEdit?.id === textAnnotation.id && text !== textAnnotation.text,
          ),
      )}
    </div>
  );
}
