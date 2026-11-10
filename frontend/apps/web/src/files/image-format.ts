export const imageFormats = {
  'image/png': { label: 'PNG', extension: '.png' },
  'image/jpeg': { label: 'JPEG', extension: '.jpg' },
  'image/webp': { label: 'WebP', extension: '.webp' },
} as const;

export type ImageFormat = keyof typeof imageFormats;
export const imageQuality = { min: 10, max: 100, step: 5, defaultValue: 90 } as const;

export function editableImageType(type: string): type is ImageFormat {
  return Object.hasOwn(imageFormats, type);
}
