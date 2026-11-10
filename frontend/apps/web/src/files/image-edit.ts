export type ImageSize = Readonly<{ width: number; height: number }>;
export type ImageCrop = Readonly<ImageSize & { x: number; y: number }>;
export type ImageFormat = 'image/png' | 'image/jpeg';
export type ImageEdit = Readonly<{
  crop: ImageCrop;
  turns: number;
  flipX: boolean;
  flipY: boolean;
  resize?: ImageSize;
}>;

export const imageSizeLimit = { sidePixels: 8192, totalPixels: 16 * 1024 * 1024 } as const;
const previewSidePixels = 1200;
const maxPreviewScale = 4;
const jpegQuality = 0.9;

export function editableImageType(type: string): type is ImageFormat {
  return type === 'image/png' || type === 'image/jpeg';
}

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
  return { crop: { x: 0, y: 0, width, height }, turns: 0, flipX: false, flipY: false };
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

function drawImage(
  canvas: HTMLCanvasElement,
  source: ImageBitmap,
  edit: ImageEdit,
  scale: number,
  background?: ImageFormat,
) {
  const context = prepareCanvas(canvas, outputImageSize(edit), scale);
  if (!context) return false;
  const { width, height } = canvas;
  if (background === 'image/jpeg') {
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
  }
  context.translate(width / 2, height / 2);
  context.scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1);
  context.rotate((edit.turns * Math.PI) / 2);
  const drawWidth = edit.turns % 2 ? height : width;
  const drawHeight = edit.turns % 2 ? width : height;
  const crop = edit.crop;
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );
  return true;
}

export function drawImagePreview(
  canvas: HTMLCanvasElement,
  source: ImageBitmap,
  edit: ImageEdit,
  selection?: ImageCrop,
) {
  const size = selection ? source : outputImageSize(edit);
  const scale = Math.min(maxPreviewScale, previewSidePixels / Math.max(size.width, size.height));
  if (!selection) return drawImage(canvas, source, edit, scale);
  const context = prepareCanvas(canvas, size, scale);
  if (!context) return false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
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

export async function encodeImage(
  source: ImageBitmap,
  edit: ImageEdit,
  format: ImageFormat,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  try {
    if (!drawImage(canvas, source, edit, 1, format)) return null;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, jpegQuality));
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
