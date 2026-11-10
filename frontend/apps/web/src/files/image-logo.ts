import { editableImageType } from './image-format';
import { rasterType } from './media-signatures';

export const imageLogoLimit = { mebibytes: 2, sidePixels: 1024 } as const;
export type ImageLogoError = 'logoBytes' | 'logoDimensions' | 'logoInvalid';
export type ImageLogoAsset = Readonly<{ id: number; name: string; bitmap: ImageBitmap }>;

function fitsLogo({ width, height }: { width: number; height: number }) {
  return [width, height].every(
    (side) => Number.isInteger(side) && side > 0 && side <= imageLogoLimit.sidePixels,
  );
}

/** readImageLogo 检查签名和尺寸后才解码；成功时将位图所有权交给调用方。 */
export async function readImageLogo(
  file: File,
  signal: AbortSignal,
): Promise<{ bitmap: ImageBitmap } | { error: ImageLogoError }> {
  if (file.size > imageLogoLimit.mebibytes * 1024 * 1024) return { error: 'logoBytes' };
  try {
    const type = await rasterType(file);
    if (!type || !editableImageType(type)) return { error: 'logoInvalid' };
    const { imageDimensionsFromData } = await import('image-dimensions');
    const bytes = await file.arrayBuffer();
    signal.throwIfAborted();
    const dimensions = imageDimensionsFromData(new Uint8Array(bytes));
    if (!dimensions || type !== 'image/' + dimensions.type) return { error: 'logoInvalid' };
    if (!fitsLogo(dimensions)) return { error: 'logoDimensions' };
    const bitmap = await createImageBitmap(new Blob([bytes], { type }), {
      imageOrientation: 'from-image',
    });
    if (signal.aborted || !fitsLogo(bitmap)) {
      bitmap.close();
      signal.throwIfAborted();
      return { error: 'logoDimensions' };
    }
    return { bitmap };
  } catch (error) {
    if (signal.aborted) throw error;
    return { error: 'logoInvalid' };
  }
}
