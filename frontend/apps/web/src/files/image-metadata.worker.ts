import { load } from 'exifreader';
import type { ImageMetadata } from './image-metadata';

const imageExifFields = {
  make: 'Make',
  model: 'Model',
  lens: 'LensModel',
  captured: 'DateTimeOriginal',
  orientation: 'Orientation',
  aperture: 'FNumber',
  exposure: 'ExposureTime',
  iso: 'ISOSpeedRatings',
  focalLength: 'FocalLength',
  bias: 'ExposureBiasValue',
  flash: 'Flash',
  artist: 'Artist',
  copyright: 'Copyright',
  software: 'Software',
} as const;

export type ImageExifField = keyof typeof imageExifFields;
const maxFieldCharacters = 256;
const gpsTags = ['GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef'];

function coordinates(latitude?: number, longitude?: number) {
  if (
    latitude === undefined ||
    longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return undefined;
  return { latitude, longitude };
}

self.addEventListener('message', (event: MessageEvent<Blob>) => {
  void (async () => {
    try {
      const tags = load(await event.data.arrayBuffer(), {
        expanded: true,
        includeTags: { exif: [...Object.values(imageExifFields), ...gpsTags], gps: true },
      });
      const fields: ImageMetadata['fields'] = {};
      for (const field of Object.keys(imageExifFields) as ImageExifField[]) {
        // 部分数值标签的说明是数字，保留有限数值（包括 0）。
        const value: unknown = tags.exif?.[imageExifFields[field]]?.description;
        const description =
          typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
        if (typeof description !== 'string') continue;
        const text = description
          .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
          .trim()
          .slice(0, maxFieldCharacters);
        if (text) fields[field] = text;
      }
      const location = coordinates(tags.gps?.Latitude, tags.gps?.Longitude);
      self.postMessage({ fields, ...(location ? { location } : {}) } satisfies ImageMetadata);
    } catch {
      // 无效或无法解析的原件只影响信息面板，线程不回传标签原文或底层错误。
      self.postMessage(undefined);
    }
  })();
});
