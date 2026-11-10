'use client';

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import {
  drawImagePreview,
  outputImageSize,
  validImageCrop,
  type ImageCrop,
  type ImageEdit,
  type ImageSize,
} from './image-edit';
import type { ImagePoint } from './image-annotation';

function pointOnSource(event: PointerEvent<HTMLCanvasElement>, source: ImageSize): ImagePoint {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        source.width,
        Math.round(((event.clientX - bounds.left) / bounds.width) * source.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        source.height,
        Math.round(((event.clientY - bounds.top) / bounds.height) * source.height),
      ),
    ),
  };
}

function cropFromPoints(start: ImagePoint, end: ImagePoint): ImageCrop {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  };
}

type CanvasPointerHandler = (event: PointerEvent<HTMLCanvasElement>) => void;
export type ImageCanvasInteraction = Readonly<{
  cursor: 'crosshair' | 'move';
  down: CanvasPointerHandler;
  move: CanvasPointerHandler;
  up: CanvasPointerHandler;
  cancel: CanvasPointerHandler;
}>;

export type ImageCanvasView = Readonly<{
  zoom: 'fit' | number;
  pan: boolean;
  viewportLabel: string;
  original?: ImageEdit;
  onFitPercent: (percent: number) => void;
}>;
const viewportHeight = 'min(44dvh, 36rem)';

export function ImageCanvas({
  bitmap,
  edit,
  labels,
  view,
  selection,
  onCrop,
  selectedAnnotation,
  interaction: annotationInteraction,
}: Readonly<{
  bitmap: ImageBitmap;
  edit: ImageEdit;
  labels: Readonly<{ canvas: string; decodeFailed: string }>;
  view: ImageCanvasView;
  selection?: ImageCrop;
  onCrop?: (crop: ImageCrop) => void;
  selectedAnnotation?: number;
  interaction?: ImageCanvasInteraction;
}>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const center = useRef({ x: 0.5, y: 0.5 });
  const panDrag = useRef<{ id: number; x: number; y: number; left: number; top: number }>(
    undefined,
  );
  const drag = useRef<{ id: number; start: ImagePoint; previous: ImageCrop }>(undefined);
  const [failed, setFailed] = useState(false);
  const { zoom, original, onFitPercent } = view;
  const zoomPercent = zoom === 'fit' ? undefined : zoom;
  const pan = zoomPercent !== undefined && view.pan;
  const editable = !pan && !original;
  const interaction = editable ? annotationInteraction : undefined;
  const changeCrop = editable ? onCrop : undefined;
  const visibleEdit = original ?? edit;
  const visibleSelection = original ? undefined : selection;
  const visibleAnnotation = original ? undefined : selectedAnnotation;
  const { width, height } = visibleSelection ? bitmap : outputImageSize(visibleEdit);

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    if (zoomPercent === undefined) {
      center.current = { x: 0.5, y: 0.5 };
      return;
    }
    node.scrollLeft = center.current.x * node.scrollWidth - node.clientWidth / 2;
    node.scrollTop = center.current.y * node.scrollHeight - node.clientHeight / 2;
  }, [zoomPercent, width, height]);

  useEffect(() => {
    const node = canvas.current;
    if (!node || zoomPercent !== undefined) return;
    const update = () => {
      const displayed = node.clientWidth;
      if (displayed > 0) onFitPercent(Math.max(1, Math.round((displayed * 100) / width)));
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    update();
    return () => observer.disconnect();
  }, [onFitPercent, width, zoomPercent]);

  useLayoutEffect(() => {
    const node = canvas.current;
    return () => {
      if (node) {
        node.width = 0;
        node.height = 0;
      }
    };
  }, []);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      try {
        if (
          !drawImagePreview(
            node,
            bitmap,
            visibleEdit,
            visibleSelection,
            visibleAnnotation,
            zoomPercent,
          )
        )
          setFailed(true);
      } catch {
        setFailed(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [bitmap, visibleEdit, visibleSelection, visibleAnnotation, zoomPercent]);

  const display =
    zoomPercent === undefined
      ? undefined
      : {
          width: Math.max(1, (width * zoomPercent) / 100),
          height: Math.max(1, (height * zoomPercent) / 100),
        };

  return (
    <div
      ref={viewport}
      role="region"
      aria-label={view.viewportLabel}
      // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 固定倍率视区可聚焦，使方向键直接滚动画布。
      tabIndex={display ? 0 : undefined}
      className={display ? 'rounded-panel bg-surface-muted' : 'flex rounded-panel bg-surface-muted'}
      style={{
        height: display ? viewportHeight : undefined,
        maxHeight: display ? undefined : viewportHeight,
        aspectRatio: display ? undefined : `${width} / ${height}`,
        overflow: display ? 'auto' : 'hidden',
        touchAction: pan ? 'none' : undefined,
      }}
      onScroll={(event) => {
        if (!display) return;
        const node = event.currentTarget;
        center.current = {
          x: (node.scrollLeft + node.clientWidth / 2) / node.scrollWidth,
          y: (node.scrollTop + node.clientHeight / 2) / node.scrollHeight,
        };
      }}
      onPointerDown={(event) => {
        if (!pan || !event.isPrimary || event.button !== 0) return;
        const node = event.currentTarget;
        panDrag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: node.scrollLeft,
          top: node.scrollTop,
        };
        node.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = panDrag.current;
        if (!pan || start?.id !== event.pointerId) return;
        event.currentTarget.scrollLeft = start.left + start.x - event.clientX;
        event.currentTarget.scrollTop = start.top + start.y - event.clientY;
      }}
      onLostPointerCapture={(event) => {
        if (panDrag.current?.id === event.pointerId) panDrag.current = undefined;
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          minWidth: '100%',
          minHeight: '100%',
          width: display?.width,
          height: display?.height,
        }}
      >
        {failed ? (
          <p role="alert" className="p-4 text-sm text-danger">
            {labels.decodeFailed}
          </p>
        ) : (
          <canvas
            ref={canvas}
            aria-label={labels.canvas}
            role="img"
            className={display ? 'block' : 'block max-w-full'}
            style={{
              width: display?.width ?? 'auto',
              height: display?.height ?? 'auto',
              maxHeight: display ? undefined : '100%',
              touchAction: changeCrop || interaction ? 'none' : undefined,
              cursor: pan
                ? 'grab'
                : (interaction?.cursor ?? (changeCrop ? 'crosshair' : undefined)),
            }}
            onPointerDown={(event) => {
              if (interaction) return interaction.down(event);
              if (!changeCrop || !selection || !event.isPrimary || event.button !== 0) return;
              drag.current = {
                id: event.pointerId,
                start: pointOnSource(event, bitmap),
                previous: selection,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (interaction) return interaction.move(event);
              const start = drag.current;
              if (!changeCrop || start?.id !== event.pointerId) return;
              const next = cropFromPoints(start.start, pointOnSource(event, bitmap));
              if (validImageCrop(next, bitmap)) changeCrop(next);
            }}
            onPointerUp={(event) => {
              if (interaction) return interaction.up(event);
              const start = drag.current;
              if (!changeCrop || start?.id !== event.pointerId) return;
              drag.current = undefined;
              const next = cropFromPoints(start.start, pointOnSource(event, bitmap));
              changeCrop(validImageCrop(next, bitmap) ? next : start.previous);
            }}
            onLostPointerCapture={(event) => {
              if (interaction) return interaction.cancel(event);
              if (drag.current?.id !== event.pointerId) return;
              const { previous } = drag.current;
              drag.current = undefined;
              changeCrop?.(previous);
            }}
            {...(interaction ? { onPointerCancel: interaction.cancel } : {})}
          />
        )}
      </div>
    </div>
  );
}
