export const imageFormats = {
  'image/png': { label: 'PNG', extension: '.png' },
  'image/jpeg': { label: 'JPEG', extension: '.jpg' },
  'image/webp': { label: 'WebP', extension: '.webp' },
} as const;

export type ImageFormat = keyof typeof imageFormats;

export function editableImageType(type: string): type is ImageFormat {
  return Object.hasOwn(imageFormats, type);
}
