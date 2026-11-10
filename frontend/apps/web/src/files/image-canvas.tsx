'use client';

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import {
  drawImagePreview,
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

export function ImageCanvas({
  bitmap,
  edit,
  labels,
  selection,
  onCrop,
  selectedAnnotation,
  interaction,
}: Readonly<{
  bitmap: ImageBitmap;
  edit: ImageEdit;
  labels: Readonly<{ canvas: string; decodeFailed: string }>;
  selection?: ImageCrop;
  onCrop?: (crop: ImageCrop) => void;
  selectedAnnotation?: number;
  interaction?: ImageCanvasInteraction;
}>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; start: ImagePoint; previous: ImageCrop }>(undefined);
  const [failed, setFailed] = useState(false);
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
        if (!drawImagePreview(node, bitmap, edit, selection, selectedAnnotation)) setFailed(true);
      } catch {
        setFailed(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [bitmap, edit, selection, selectedAnnotation]);
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-panel bg-surface-muted"
      style={{ height: 'min(44dvh, 36rem)' }}
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
          className="block max-w-full"
          style={{
            width: 'auto',
            height: 'auto',
            maxHeight: '100%',
            touchAction: onCrop || interaction ? 'none' : undefined,
            cursor: interaction?.cursor ?? (onCrop ? 'crosshair' : undefined),
          }}
          onPointerDown={(event) => {
            if (interaction) return interaction.down(event);
            if (!onCrop || !selection || !event.isPrimary || event.button !== 0) return;
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
            if (!onCrop || start?.id !== event.pointerId) return;
            const next = cropFromPoints(start.start, pointOnSource(event, bitmap));
            if (validImageCrop(next, bitmap)) onCrop(next);
          }}
          onPointerUp={(event) => {
            if (interaction) return interaction.up(event);
            const start = drag.current;
            if (!onCrop || start?.id !== event.pointerId) return;
            drag.current = undefined;
            const next = cropFromPoints(start.start, pointOnSource(event, bitmap));
            onCrop(validImageCrop(next, bitmap) ? next : start.previous);
          }}
          onLostPointerCapture={(event) => {
            if (interaction) return interaction.cancel(event);
            if (drag.current?.id !== event.pointerId) return;
            const { previous } = drag.current;
            drag.current = undefined;
            onCrop?.(previous);
          }}
          {...(interaction ? { onPointerCancel: interaction.cancel } : {})}
        />
      )}
    </div>
  );
}
