import { editableImageType, imageFormats } from './image-format';
import { rasterType } from './media-signatures';

export const imageOverlayLimit = { mebibytes: 2, sidePixels: 1024 } as const;
export const imageOverlayTypes = Object.keys(imageFormats);
export type ImageOverlayError = 'overlayBytes' | 'overlayDimensions' | 'overlayInvalid';
export type ImageOverlayAsset = Readonly<{ id: number; name: string; bitmap: ImageBitmap }>;

function fitsOverlay({ width, height }: { width: number; height: number }) {
  return [width, height].every(
    (side) => Number.isInteger(side) && side > 0 && side <= imageOverlayLimit.sidePixels,
  );
}

/** readImageOverlay 检查签名和尺寸后才解码，成功时将位图所有权交给调用方。 */
export async function readImageOverlay(
  file: File,
  signal: AbortSignal,
): Promise<{ bitmap: ImageBitmap } | { error: ImageOverlayError }> {
  if (file.size > imageOverlayLimit.mebibytes * 1024 * 1024) return { error: 'overlayBytes' };
  try {
    const type = await rasterType(file);
    if (!type || !editableImageType(type)) return { error: 'overlayInvalid' };
    const { imageDimensionsFromData } = await import('image-dimensions');
    const bytes = await file.arrayBuffer();
    signal.throwIfAborted();
    const dimensions = imageDimensionsFromData(new Uint8Array(bytes));
    if (!dimensions || type !== 'image/' + dimensions.type) return { error: 'overlayInvalid' };
    if (!fitsOverlay(dimensions)) return { error: 'overlayDimensions' };
    const bitmap = await createImageBitmap(new Blob([bytes], { type }), {
      imageOrientation: 'from-image',
    });
    if (signal.aborted || !fitsOverlay(bitmap)) {
      bitmap.close();
      signal.throwIfAborted();
      return { error: 'overlayDimensions' };
    }
    return { bitmap };
  } catch (error) {
    if (signal.aborted) throw error;
    return { error: 'overlayInvalid' };
  }
}
