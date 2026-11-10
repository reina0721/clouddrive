import { paintAnnotations, type ImageAnnotation, type ImagePoint } from './image-annotation';
import {
  originalImageAppearance,
  paintImageColor,
  paintImageWatermarks,
  type ImageAppearance,
  type ImageFilter,
} from './image-appearance';
import { imageQuality, type ImageFormat } from './image-format';

export type ImageSize = Readonly<{ width: number; height: number }>;
export type ImageCrop = Readonly<ImageSize & { x: number; y: number }>;
export type ImageEdit = Readonly<{
  crop: ImageCrop;
  turns: number;
  flipX: boolean;
  flipY: boolean;
  resize?: ImageSize;
  annotations: readonly ImageAnnotation[];
  appearance: ImageAppearance;
}>;

export const imageSizeLimit = { sidePixels: 8192, totalPixels: 16 * 1024 * 1024 } as const;
const previewSidePixels = 1200;
const maxPreviewScale = 4;
const filterSampleSidePixels = 96;

export function validImageSize({ width, height }: ImageSize) {
  return (
    [width, height].every(
      (side) => Number.isSafeInteger(side) && side > 0 && side <= imageSizeLimit.sidePixels,
    ) && width * height <= imageSizeLimit.totalPixels
  );
}

export function validImageCrop(crop: ImageCrop, source: ImageSize) {
  return (
    validImageSize(crop) &&
    [crop.x, crop.y].every((offset) => Number.isSafeInteger(offset) && offset >= 0) &&
    crop.x + crop.width <= source.width &&
    crop.y + crop.height <= source.height
  );
}

export function originalImage({ width, height }: ImageSize): ImageEdit {
  return {
    crop: { x: 0, y: 0, width, height },
    turns: 0,
    flipX: false,
    flipY: false,
    annotations: [],
    appearance: originalImageAppearance,
  };
}

export function outputImageSize(edit: ImageEdit): ImageSize {
  if (edit.resize) return edit.resize;
  const { width, height } = edit.crop;
  return edit.turns % 2 ? { width: height, height: width } : { width, height };
}

export function turnImage(edit: ImageEdit, direction: -1 | 1): ImageEdit {
  const { resize } = edit;
  return {
    ...edit,
    turns: (edit.turns + direction + 4) % 4,
    // 镜像记录在输出坐标系中，旋转整个画面后两条镜像轴随之互换。
    flipX: edit.flipY,
    flipY: edit.flipX,
    ...(resize ? { resize: { width: resize.height, height: resize.width } } : {}),
  };
}

export function centeredImageCrop(source: ImageSize, ratio: number): ImageCrop {
  const width = Math.min(source.width, Math.max(1, Math.round(source.height * ratio)));
  const height = Math.min(source.height, Math.max(1, Math.round(source.width / ratio)));
  return {
    x: Math.floor((source.width - width) / 2),
    y: Math.floor((source.height - height) / 2),
    width,
    height,
  };
}

function prepareCanvas(canvas: HTMLCanvasElement, size: ImageSize, scale: number) {
  canvas.width = Math.max(1, Math.round(size.width * scale));
  canvas.height = Math.max(1, Math.round(size.height * scale));
  return canvas.getContext('2d');
}

function imageTransform(edit: ImageEdit, { width, height }: ImageSize) {
  const { crop, turns, flipX, flipY } = edit;
  const rotated = turns % 2 !== 0;
  return new DOMMatrix()
    .translate(width / 2, height / 2)
    .scale(flipX ? -1 : 1, flipY ? -1 : 1)
    .rotate(turns * 90)
    .scale((rotated ? height : width) / crop.width, (rotated ? width : height) / crop.height)
    .translate(-crop.x - crop.width / 2, -crop.y - crop.height / 2);
}

/** sourceImagePoint 使用与绘制同一矩阵，把画布上的点反算为原图像素。 */
export function sourceImagePoint(
  edit: ImageEdit,
  canvas: ImageSize,
  point: ImagePoint,
): ImagePoint {
  const source = imageTransform(edit, canvas).inverse().transformPoint(point);
  return {
    x: Math.min(edit.crop.x + edit.crop.width, Math.max(edit.crop.x, Math.round(source.x))),
    y: Math.min(edit.crop.y + edit.crop.height, Math.max(edit.crop.y, Math.round(source.y))),
  };
}

function drawImage(
  canvas: HTMLCanvasElement,
  source: ImageBitmap,
  edit: ImageEdit,
  scale: number,
  background?: ImageFormat,
  selectedAnnotation?: number,
) {
  const context = prepareCanvas(canvas, outputImageSize(edit), scale);
  if (!context) return false;
  const { width, height } = canvas;
  const transform = imageTransform(edit, { width, height });
  context.setTransform(transform);
  const crop = edit.crop;
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
  );
  context.resetTransform();
  paintImageColor(context, edit.appearance);
  context.setTransform(transform);
  paintAnnotations(context, edit.annotations, selectedAnnotation);
  context.resetTransform();
  paintImageWatermarks(context, edit.appearance);
  if (background === 'image/jpeg') {
    // 白底最后铺在照片与覆盖层背后，不受色彩调整影响。
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
  }
  return true;
}

export function drawImagePreview(
  canvas: HTMLCanvasElement,
  source: ImageBitmap,
  edit: ImageEdit,
  selection?: ImageCrop,
  selectedAnnotation?: number,
  zoomPercent?: number,
) {
  const size = selection ? source : outputImageSize(edit);
  const scale =
    zoomPercent === undefined
      ? Math.min(maxPreviewScale, previewSidePixels / Math.max(size.width, size.height))
      : Math.min(1, zoomPercent / 100);
  if (!selection) return drawImage(canvas, source, edit, scale, undefined, selectedAnnotation);
  const context = prepareCanvas(canvas, size, scale);
  if (!context) return false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  paintImageColor(context, edit.appearance);
  context.save();
  context.scale(canvas.width / source.width, canvas.height / source.height);
  paintAnnotations(context, edit.annotations);
  context.restore();
  const x = (selection.x * canvas.width) / source.width;
  const y = (selection.y * canvas.height) / source.height;
  const width = (selection.width * canvas.width) / source.width;
  const height = (selection.height * canvas.height) / source.height;
  context.fillStyle = 'rgb(0 0 0 / 55%)';
  context.beginPath();
  context.rect(0, 0, canvas.width, canvas.height);
  context.rect(x, y, width, height);
  context.fill('evenodd');
  context.strokeStyle = 'white';
  context.strokeRect(x, y, width, height);
  return true;
}

/** drawFilterSample 复用照片渲染，在有界小画布上显示真实预设效果。 */
export function drawFilterSample(
  canvas: HTMLCanvasElement,
  source: ImageBitmap,
  edit: ImageEdit,
  filter: ImageFilter,
) {
  const { width, height } = outputImageSize(edit);
  const scale = Math.min(1, filterSampleSidePixels / Math.max(width, height));
  return drawImage(
    canvas,
    source,
    {
      ...edit,
      annotations: [],
      appearance: { ...edit.appearance, filter, filterPercent: 100, watermark: null, logo: null },
    },
    scale,
  );
}

export async function encodeImage(
  source: ImageBitmap,
  edit: ImageEdit,
  format: ImageFormat,
  qualityPercent: number = imageQuality.defaultValue,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  try {
    if (!drawImage(canvas, source, edit, 1, format)) return null;
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, format, format === 'image/png' ? undefined : qualityPercent / 100),
    );
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
