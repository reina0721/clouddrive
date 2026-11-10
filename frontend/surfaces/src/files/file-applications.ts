import { z } from 'zod';
import { isMarkdownFile } from './markdown';
import type { FileEntry } from './model';

const applicationID = z.enum([
  'image',
  'audio',
  'video',
  'pdf',
  'epub',
  'archive',
  'markdown',
  'text',
]);
const platform = z.enum(['all', 'desktop', 'mobile']);
const rule = z.object({ id: applicationID, enabled: z.boolean(), platform });
export const maxFileApplicationExtensions = 48;
export const maxFileCreationMappings = 8;
export const maxFileCreationLabelRunes = 48;
const newFile = z.object({ extension: z.string(), label: z.string() });
const item = rule.extend({
  extensions: z.array(z.string()).max(maxFileApplicationExtensions),
  customExtensions: z.boolean(),
  newFiles: z.array(newFile).max(maxFileCreationMappings),
  customNewFiles: z.boolean(),
  canCreate: z.boolean(),
});
const webApplicationID = z.custom<`web-${string}`>(
  (value) => typeof value === 'string' && /^web-[a-f0-9]{32}$/.test(value),
);
const webItem = z.object({
  id: webApplicationID,
  enabled: z.boolean(),
  platform,
  extensions: z.array(z.string()).min(1).max(128),
  name: z.string(),
  origin: z.string().optional(),
  iconUrl: z.string().optional(),
  maxBytes: z.number().int().nonnegative(),
  newTab: z.boolean(),
  protocol: z.literal('wopi').optional(),
  editExtensions: z.array(z.string()).optional(),
});
const wopiApplication = z.object({
  discoveryUrl: z.string(),
  actions: z
    .array(z.object({ extension: z.string(), url: z.string(), editUrl: z.string().optional() }))
    .min(1)
    .max(128),
  editEnabled: z.boolean().optional(),
});
export const wopiDiscoverySchema = wopiApplication.extend({ origin: z.string() });
const webApp = webItem.extend({ urlTemplate: z.string(), wopi: wopiApplication.optional() });
const defaultRule = z.object({
  extension: z.string(),
  app: z.union([applicationID, webApplicationID]),
});

export const fileApplicationPolicySchema = z.object({
  items: z.array(item).max(8),
  defaults: z.array(defaultRule).max(32),
  webItems: z.array(webItem).max(8),
});
export const fileApplicationViewSchema = fileApplicationPolicySchema.extend({
  revision: z.number().int().nonnegative(),
  builtInDefaults: z.array(defaultRule),
  builtInItems: z.array(item).max(8),
  webApps: z.array(webApp).max(8),
  canSave: z.boolean(),
});

export const webFilePreviewSchema = z.object({
  urlTemplate: z.string(),
  origin: z.string(),
  name: z.string(),
  newTab: z.boolean(),
  token: z.string().regex(/^[A-Za-z0-9_-]+$/),
  wopi: z
    .object({ actionUrl: z.string(), expiresAtMilliseconds: z.number().int().positive() })
    .optional(),
});

export const maxWebFileApplications = 8;
export const maxWebApplicationBytes = 1024 ** 4;
export type WebFileApplication = z.infer<typeof webApp>;
export type WebFileApplicationItem = z.infer<typeof webItem>;
export type WebFilePreview = z.infer<typeof webFilePreviewSchema>;
export type WOPIDiscovery = z.infer<typeof wopiDiscoverySchema>;
export const maxWOPIExtensions = 128;
export const maxWOPIEditBytes = 8 * 1024 * 1024;

export type FileApplicationID = z.infer<typeof applicationID>;
export type FileApplicationPlatform = z.infer<typeof platform>;
export type FileCreationMapping = z.infer<typeof newFile>;
export type CreationTemplate = Readonly<{ title: string; extension: string; builtIn: boolean }>;
export type FileApplicationRule = z.infer<typeof rule> & {
  extensions?: string[];
  newFiles?: FileCreationMapping[];
};
export type FileApplicationItem = z.infer<typeof item>;
export type FileApplicationDefault = z.infer<typeof defaultRule>;
export type FileApplicationPolicy = z.infer<typeof fileApplicationPolicySchema>;
export type FileApplicationView = z.infer<typeof fileApplicationViewSchema>;
export type FileApplicationSettings = {
  revision: number;
  apps: FileApplicationRule[];
  defaults: FileApplicationDefault[];
  webApps?: Omit<WebFileApplication, 'origin' | 'editExtensions'>[];
};

const names: Record<FileApplicationID, readonly [string, string]> = {
  image: ['图片查看器', 'Image viewer'],
  audio: ['音频播放器', 'Audio player'],
  video: ['视频播放器', 'Video player'],
  pdf: ['PDF 阅读器', 'PDF reader'],
  epub: ['EPUB 阅读器', 'EPUB reader'],
  archive: ['压缩包预览', 'Archive viewer'],
  markdown: ['Markdown 编辑器', 'Markdown editor'],
  text: ['文本编辑器', 'Text editor'],
};

export function fileApplicationName(id: FileApplicationID, chinese: boolean) {
  return names[id][chinese ? 0 : 1];
}

const mobileFileApplicationWidth = 768;

export function fileApplicationDevice(width: number) {
  return width < mobileFileApplicationWidth ? 'mobile' : 'desktop';
}

export function validFileCreationLabel(label: string) {
  const trimmed = label.trim();
  return !!trimmed && [...trimmed].length <= maxFileCreationLabelRunes && !/\p{Cc}/u.test(trimmed);
}

export function isTextPreview(entry: Pick<FileEntry, 'name' | 'mediaType'>) {
  return (
    isMarkdownFile(entry) ||
    entry.mediaType.startsWith('text/') ||
    /\.(txt|csv|json|xml|html|css|js|log)$/i.test(entry.name)
  );
}

const applicationExtension = /^[a-z0-9][a-z0-9_+-]{0,23}$/;

export function parseFileApplicationExtensions(
  value: string,
  limit = maxFileApplicationExtensions,
): { extensions: string[] } | { error: 'count' | 'format' | 'duplicate' } {
  const extensions = value
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((part) => part.replace(/^\./, '').toLowerCase());
  if (extensions.length > limit) return { error: 'count' } as const;
  if (extensions.some((extension) => !applicationExtension.test(extension)))
    return { error: 'format' } as const;
  if (new Set(extensions).size !== extensions.length) return { error: 'duplicate' } as const;
  return { extensions };
}

export function fileApplicationChoice(
  policy: FileApplicationPolicy,
  inherited: readonly FileApplicationID[],
  configured: readonly FileApplicationID[],
  extension: string,
  device: Exclude<FileApplicationPlatform, 'all'>,
) {
  const associated = policy.items.some(
    (item) => item.customExtensions && item.extensions.includes(extension),
  );
  const options = policy.items
    .filter((item) => {
      if (!item.enabled || (item.platform !== 'all' && item.platform !== device)) return false;
      return item.customExtensions || associated
        ? item.extensions.includes(extension) && configured.includes(item.id)
        : inherited.includes(item.id);
    })
    .map((item) => item.id);
  const defaultApp = policy.defaults.find((value) => value.extension === extension)?.app;
  return {
    options,
    defaultApp,
    automatic: options.length === 1 ? options[0] : options.find((id) => id === defaultApp),
  };
}
