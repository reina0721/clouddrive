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
const item = rule.extend({ extensions: z.array(z.string()) });
const defaultRule = z.object({ extension: z.string(), app: applicationID });

export const fileApplicationPolicySchema = z.object({
  items: z.array(item).max(8),
  defaults: z.array(defaultRule).max(32),
});
export const fileApplicationViewSchema = fileApplicationPolicySchema.extend({
  revision: z.number().int().nonnegative(),
  builtInDefaults: z.array(defaultRule),
  canSave: z.boolean(),
});

export type FileApplicationID = z.infer<typeof applicationID>;
export type FileApplicationPlatform = z.infer<typeof platform>;
export type FileApplicationRule = z.infer<typeof rule>;
export type FileApplicationItem = z.infer<typeof item>;
export type FileApplicationDefault = z.infer<typeof defaultRule>;
export type FileApplicationPolicy = z.infer<typeof fileApplicationPolicySchema>;
export type FileApplicationView = z.infer<typeof fileApplicationViewSchema>;
export type FileApplicationSettings = {
  revision: number;
  apps: FileApplicationRule[];
  defaults: FileApplicationDefault[];
};

const names: Record<FileApplicationID, readonly [string, string]> = {
  image: ['图片查看器', 'Image viewer'],
  audio: ['音频播放器', 'Audio player'],
  video: ['视频播放器', 'Video player'],
  pdf: ['PDF 阅读器', 'PDF reader'],
  epub: ['EPUB 阅读器', 'EPUB reader'],
  archive: ['压缩包预览', 'Archive viewer'],
  markdown: ['Markdown 编辑器', 'Markdown editor'],
  text: ['文本查看器', 'Text viewer'],
};

export function fileApplicationName(id: FileApplicationID, chinese: boolean) {
  return names[id][chinese ? 0 : 1];
}

export function isTextPreview(entry: Pick<FileEntry, 'name' | 'mediaType'>) {
  return (
    isMarkdownFile(entry) ||
    entry.mediaType.startsWith('text/') ||
    /\.(txt|csv|json|xml|html|css|js|log)$/i.test(entry.name)
  );
}

export function fileApplicationChoice(
  policy: FileApplicationPolicy,
  compatible: readonly FileApplicationID[],
  extension: string,
  device: Exclude<FileApplicationPlatform, 'all'>,
) {
  const options = compatible.filter((id) =>
    policy.items.some(
      (item) =>
        item.id === id && item.enabled && (item.platform === 'all' || item.platform === device),
    ),
  );
  const defaultApp = policy.defaults.find((value) => value.extension === extension)?.app;
  return {
    options,
    automatic:
      options.length === 1
        ? options[0]
        : defaultApp && options.includes(defaultApp)
          ? defaultApp
          : undefined,
  };
}
