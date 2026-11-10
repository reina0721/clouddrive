'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { readImageOverlay, type ImageOverlayError } from './image-overlay';
import type { ImageFormat } from './image-format';

/** useImageOverlayImport 在工作区卸载或取消时关闭尚未移交的位图。 */
export function useImageOverlayImport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ImageOverlayError>();
  const request = useRef<AbortController>(undefined);
  useLayoutEffect(() => () => request.current?.abort(), []);

  function cancel() {
    request.current?.abort();
    request.current = undefined;
    setLoading(false);
    setError(undefined);
  }

  async function read(
    file: File,
    accept: (bitmap: ImageBitmap, name: string, type: ImageFormat) => void,
  ) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(undefined);
    try {
      const result = await readImageOverlay(file, controller.signal);
      if ('error' in result) {
        if (!controller.signal.aborted) setError(result.error);
      } else if (controller.signal.aborted) {
        result.bitmap.close();
      } else {
        accept(result.bitmap, file.name, result.type);
      }
    } catch (cause) {
      if (!controller.signal.aborted) throw cause;
    } finally {
      if (request.current === controller && !controller.signal.aborted) {
        request.current = undefined;
        setLoading(false);
      }
    }
  }

  return { loading, error, cancel, read };
}
