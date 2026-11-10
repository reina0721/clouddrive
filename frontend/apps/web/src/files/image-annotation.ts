import type { ImageOverlayAsset } from './image-overlay';

export type ImagePoint = Readonly<{ x: number; y: number }>;
type ShapeKind = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'pen' | 'polygon';
export type AnnotationKind = ShapeKind | 'text' | 'image';
export const annotationColors = ['red', 'royalblue', 'seagreen', 'gold', 'black', 'white'] as const;
export const annotationWidths = [2, 4, 8, 12, 16] as const;
export const annotationOpacities = [25, 50, 75, 100] as const;
export const annotationTextSizes = [12, 16, 24, 32, 48, 64] as const;
export const annotationImageSizes = [10, 25, 50, 75, 100] as const;
export const annotationImageAngles = [-180, -135, -90, -45, 0, 45, 90, 135] as const;
export const defaultAnnotationImageSizePercent = 25;
export const annotationLimits = {
  count: 64,
  pathPoints: 256,
  polygonPoints: 64,
  textLength: 120,
  imageAssets: 12,
};

export type AnnotationStyle = Readonly<{
  color: (typeof annotationColors)[number];
  width: (typeof annotationWidths)[number];
  opacity: (typeof annotationOpacities)[number];
  fill: boolean;
  textSize: (typeof annotationTextSizes)[number];
}>;

type AnnotationBase = Readonly<{
  id: number;
  style: AnnotationStyle;
}>;

type ShapeAnnotation = AnnotationBase &
  Readonly<{ kind: ShapeKind; points: readonly ImagePoint[] }>;
type TextAnnotation = AnnotationBase & Readonly<{ kind: 'text'; anchor: ImagePoint; text: string }>;
export type RasterAnnotation = AnnotationBase &
  Readonly<{
    kind: 'image';
    anchor: ImagePoint;
    asset: ImageOverlayAsset;
    fitScale: number;
    sizePercent: (typeof annotationImageSizes)[number];
    angleDegrees: (typeof annotationImageAngles)[number];
  }>;

export type ImageAnnotation = ShapeAnnotation | TextAnnotation | RasterAnnotation;

export const defaultAnnotationStyle: AnnotationStyle = {
  color: 'red',
  width: 4,
  opacity: 100,
  fill: false,
  textSize: 24,
};

export function closedAnnotation(kind: AnnotationKind) {
  return kind === 'rectangle' || kind === 'ellipse' || kind === 'polygon';
}

function pointBounds(points: readonly ImagePoint[]) {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function annotationPath(annotation: ShapeAnnotation) {
  const path = new Path2D();
  const [start, end] = annotation.points;
  if (!start || !end) return path;
  switch (annotation.kind) {
    case 'rectangle': {
      const { x, y, width, height } = pointBounds([start, end]);
      path.rect(x, y, width, height);
      break;
    }
    case 'ellipse': {
      const { x, y, width, height } = pointBounds([start, end]);
      path.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, 2 * Math.PI);
      break;
    }
    case 'arrow': {
      path.moveTo(start.x, start.y);
      path.lineTo(end.x, end.y);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = Math.min(
        Math.max(10, annotation.style.width * 4),
        Math.hypot(end.x - start.x, end.y - start.y) / 2,
      );
      for (const headAngle of [angle - Math.PI / 6, angle + Math.PI / 6]) {
        path.moveTo(
          end.x - headLength * Math.cos(headAngle),
          end.y - headLength * Math.sin(headAngle),
        );
        path.lineTo(end.x, end.y);
      }
      break;
    }
    default:
      path.moveTo(start.x, start.y);
      for (const point of annotation.points.slice(1)) path.lineTo(point.x, point.y);
      if (annotation.kind === 'polygon') path.closePath();
  }
  return path;
}

function annotationFont(size: number) {
  return size + 'px sans-serif';
}

function textBounds(context: CanvasRenderingContext2D, annotation: TextAnnotation) {
  context.font = annotationFont(annotation.style.textSize);
  return {
    ...annotation.anchor,
    width: context.measureText(annotation.text).width,
    height: annotation.style.textSize * 1.2,
  };
}

function rasterBounds(annotation: RasterAnnotation) {
  const scale = (annotation.fitScale * annotation.sizePercent) / 100;
  const width = annotation.asset.bitmap.width * scale;
  const height = annotation.asset.bitmap.height * scale;
  return { x: -width / 2, y: -height / 2, width, height };
}

function rasterAngle(annotation: RasterAnnotation) {
  return (annotation.angleDegrees * Math.PI) / 180;
}

function transformRaster(context: CanvasRenderingContext2D, annotation: RasterAnnotation) {
  context.translate(annotation.anchor.x, annotation.anchor.y);
  context.rotate(rasterAngle(annotation));
}

/** paintAnnotations 把源像素标注绘制在当前图像坐标系内。选择框只用于预览。 */
export function paintAnnotations(
  context: CanvasRenderingContext2D,
  annotations: readonly ImageAnnotation[],
  selected?: number,
) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.textBaseline = 'top';
  for (const annotation of annotations) {
    const { style } = annotation;
    context.globalAlpha = style.opacity / 100;
    context.strokeStyle = context.fillStyle = style.color;
    context.lineWidth = style.width;
    if (annotation.kind === 'text') {
      context.font = annotationFont(style.textSize);
      context.fillText(annotation.text, annotation.anchor.x, annotation.anchor.y);
    } else if (annotation.kind === 'image') {
      const { x, y, width, height } = rasterBounds(annotation);
      context.save();
      transformRaster(context, annotation);
      context.drawImage(annotation.asset.bitmap, x, y, width, height);
      context.restore();
    } else {
      const path = annotationPath(annotation);
      if (style.fill && closedAnnotation(annotation.kind)) context.fill(path);
      context.stroke(path);
    }
  }
  const active = annotations.find(({ id }) => id === selected);
  if (active) {
    const { x, y, width, height } =
      active.kind === 'text'
        ? textBounds(context, active)
        : active.kind === 'image'
          ? rasterBounds(active)
          : pointBounds(active.points);
    if (active.kind === 'image') transformRaster(context, active);
    const margin = active.kind === 'image' ? 4 : Math.max(4, active.style.width);
    context.globalAlpha = 1;
    context.lineWidth = 2;
    context.strokeStyle = 'white';
    context.strokeRect(x - margin, y - margin, width + 2 * margin, height + 2 * margin);
    context.strokeStyle = 'royalblue';
    context.setLineDash([4, 4]);
    context.strokeRect(x - margin, y - margin, width + 2 * margin, height + 2 * margin);
  }
  context.restore();
}

export function annotationAt(
  canvas: HTMLCanvasElement,
  annotations: readonly ImageAnnotation[],
  point: ImagePoint,
  tolerance: number,
) {
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.save();
  context.resetTransform();
  context.lineCap = 'round';
  const found = [...annotations].reverse().find((annotation) => {
    if (annotation.kind === 'text') {
      const { x, y, width, height } = textBounds(context, annotation);
      return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
    }
    if (annotation.kind === 'image') {
      const dx = point.x - annotation.anchor.x;
      const dy = point.y - annotation.anchor.y;
      const angle = rasterAngle(annotation);
      const { width, height } = rasterBounds(annotation);
      return (
        Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle)) <= width / 2 &&
        Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle)) <= height / 2
      );
    }
    const path = annotationPath(annotation);
    context.lineWidth = annotation.style.width + 2 * tolerance;
    return (
      (closedAnnotation(annotation.kind) && context.isPointInPath(path, point.x, point.y)) ||
      context.isPointInStroke(path, point.x, point.y)
    );
  });
  context.restore();
  return found;
}

export function translateAnnotation(
  annotation: ImageAnnotation,
  dx: number,
  dy: number,
): ImageAnnotation {
  const move = ({ x, y }: ImagePoint): ImagePoint => ({ x: x + dx, y: y + dy });
  return annotation.kind === 'text' || annotation.kind === 'image'
    ? { ...annotation, anchor: move(annotation.anchor) }
    : { ...annotation, points: annotation.points.map(move) };
}
