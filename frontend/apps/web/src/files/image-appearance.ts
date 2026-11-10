export const toneLimits = {
  brightness: { min: -100, max: 100, step: 5 },
  contrast: { min: -100, max: 100, step: 5 },
  saturation: { min: -100, max: 100, step: 5 },
  hue: { min: -180, max: 180, step: 15 },
  warmth: { min: -100, max: 100, step: 5 },
  exposure: { min: -2, max: 2, step: 0.1 },
} as const;
export type ImageToneField = keyof typeof toneLimits;
export type ImageTone = Readonly<Record<ImageToneField, number>>;
export const neutralImageTone: ImageTone = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  warmth: 0,
  exposure: 0,
};

export const imageFilterNames = [
  'original',
  'monochrome',
  'warm-sepia',
  'vivid',
  'fade',
  'cool',
] as const;
export type ImageFilter = (typeof imageFilterNames)[number];
export const watermarkPositions = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;
export const watermarkColors = ['white', 'black', 'gold'] as const;
export const watermarkTextLimit = 100;
export const watermarkSizeLimit = { min: 4, max: 24 };
export type ImageWatermark = Readonly<{
  text: string;
  position: (typeof watermarkPositions)[number];
  color: (typeof watermarkColors)[number];
  opacityPercent: number;
  sizePercent: number;
}>;
export const defaultWatermark: ImageWatermark = {
  text: '',
  position: 'bottom-right',
  color: 'white',
  opacityPercent: 75,
  sizePercent: 8,
};

export type ImageAppearance = Readonly<{
  tone: ImageTone;
  filter: ImageFilter;
  filterPercent: number;
  watermark: ImageWatermark | null;
}>;
export const originalImageAppearance: ImageAppearance = {
  tone: neutralImageTone,
  filter: 'original',
  filterPercent: 100,
  watermark: null,
};

type ColorRow = readonly [red: number, green: number, blue: number, offset: number];
type ColorMatrix = readonly [ColorRow, ColorRow, ColorRow];
const identity: ColorMatrix = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
];
const stripePixelLimit = 256 * 1024;
const channelMidpoint = 128;

function after(next: ColorMatrix, previous: ColorMatrix): ColorMatrix {
  const [red, green, blue] = previous;
  const row = ([r, g, b, offset]: ColorRow): ColorRow => [
    r * red[0] + g * green[0] + b * blue[0],
    r * red[1] + g * green[1] + b * blue[1],
    r * red[2] + g * green[2] + b * blue[2],
    r * red[3] + g * green[3] + b * blue[3] + offset,
  ];
  return [row(next[0]), row(next[1]), row(next[2])];
}

function channels(scale: number, offset: number): ColorMatrix {
  return [
    [scale, 0, 0, offset],
    [0, scale, 0, offset],
    [0, 0, scale, offset],
  ];
}

function saturation(amount: number): ColorMatrix {
  const r = 0.213 * (1 - amount);
  const g = 0.715 * (1 - amount);
  const b = 0.072 * (1 - amount);
  return [
    [r + amount, g, b, 0],
    [r, g + amount, b, 0],
    [r, g, b + amount, 0],
  ];
}

// W3C Filter Effects 的色相矩阵保持中性色不变，角度以度为单位。
function hue(degrees: number): ColorMatrix {
  const radians = (degrees * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [
    [
      0.213 + 0.787 * c - 0.213 * s,
      0.715 - 0.715 * c - 0.715 * s,
      0.072 - 0.072 * c + 0.928 * s,
      0,
    ],
    [0.213 - 0.213 * c + 0.143 * s, 0.715 + 0.285 * c + 0.14 * s, 0.072 - 0.072 * c - 0.283 * s, 0],
    [
      0.213 - 0.213 * c - 0.787 * s,
      0.715 - 0.715 * c + 0.715 * s,
      0.072 + 0.928 * c + 0.072 * s,
      0,
    ],
  ];
}

function temperature(offset: number): ColorMatrix {
  return [
    [1, 0, 0, offset],
    [0, 1, 0, 0],
    [0, 0, 1, -offset],
  ];
}

const presets: Record<ImageFilter, ColorMatrix> = {
  original: identity,
  monochrome: saturation(0),
  'warm-sepia': [
    [0.393, 0.769, 0.189, 0],
    [0.349, 0.686, 0.168, 0],
    [0.272, 0.534, 0.131, 0],
  ],
  vivid: after(channels(1.16, -20), saturation(1.45)),
  fade: after(channels(0.75, 32), saturation(0.72)),
  cool: after(temperature(-30), saturation(0.9)),
};

function mixFilter(matrix: ColorMatrix, amount: number): ColorMatrix {
  const blend = (row: ColorRow, index: number): ColorRow => [
    row[0] * amount + (index === 0 ? 1 - amount : 0),
    row[1] * amount + (index === 1 ? 1 - amount : 0),
    row[2] * amount + (index === 2 ? 1 - amount : 0),
    row[3] * amount,
  ];
  return [blend(matrix[0], 0), blend(matrix[1], 1), blend(matrix[2], 2)];
}

/** paintImageColor 对已绘制的照片执行一次 RGB 扫描，按行限制中间内存。 */
export function paintImageColor(context: CanvasRenderingContext2D, appearance: ImageAppearance) {
  const { tone, filter, filterPercent } = appearance;
  if (
    (filter === 'original' || filterPercent === 0) &&
    Object.values(tone).every((value) => value === 0)
  )
    return;
  const contrast = 1 + tone.contrast / 100;
  const light = channels(
    contrast * 2 ** tone.exposure,
    contrast * (tone.brightness * 0.64) + (1 - contrast) * channelMidpoint,
  );
  const color = [
    saturation(1 + tone.saturation / 100),
    hue(tone.hue),
    temperature(tone.warmth * 0.35),
    light,
  ].reduce((matrix, next) => after(next, matrix), mixFilter(presets[filter], filterPercent / 100));
  const [red, green, blue] = color;
  const { width, height } = context.canvas;
  const rows = Math.max(1, Math.floor(stripePixelLimit / width));
  for (let y = 0; y < height; y += rows) {
    const stripe = context.getImageData(0, y, width, Math.min(rows, height - y));
    const pixels = stripe.data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 0) continue;
      const r = pixels[index] ?? 0;
      const g = pixels[index + 1] ?? 0;
      const b = pixels[index + 2] ?? 0;
      pixels[index] = r * red[0] + g * red[1] + b * red[2] + red[3];
      pixels[index + 1] = r * green[0] + g * green[1] + b * green[2] + green[3];
      pixels[index + 2] = r * blue[0] + g * blue[1] + b * blue[2] + blue[3];
    }
    context.putImageData(stripe, 0, y);
  }
}

/** paintImageWatermark 在输出坐标中绘制单行文字，裁剪后仍按所选边距定位。 */
export function paintImageWatermark(
  context: CanvasRenderingContext2D,
  watermark: ImageWatermark | null,
) {
  if (!watermark) return;
  const { width, height } = context.canvas;
  const shorterSide = Math.min(width, height);
  const margin = Math.floor(shorterSide * 0.04);
  const fontSize = Math.max(1, (shorterSide * watermark.sizePercent) / 100);
  const [vertical, horizontal] = watermark.position.split('-');
  const x = horizontal === 'left' ? margin : horizontal === 'right' ? width - margin : width / 2;
  const y = vertical === 'top' ? margin : vertical === 'bottom' ? height - margin : height / 2;
  context.save();
  context.globalAlpha = watermark.opacityPercent / 100;
  context.fillStyle = watermark.color;
  context.font = '600 ' + fontSize + 'px sans-serif';
  context.textAlign = horizontal === 'left' ? 'left' : horizontal === 'right' ? 'right' : 'center';
  context.textBaseline = vertical === 'top' ? 'top' : vertical === 'bottom' ? 'bottom' : 'middle';
  context.fillText(watermark.text, x, y, Math.max(1, width - margin * 2));
  context.restore();
}
