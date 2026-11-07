import { z } from 'zod';

export const fileIconShapes = [
  'file',
  'text',
  'image',
  'video',
  'audio',
  'archive',
  'code',
  'pdf',
  'spreadsheet',
  'image-url',
] as const;

const iconRule = z.object({
  shape: z.enum(fileIconShapes),
  extensions: z.array(z.string()).min(1).max(24),
  light: z.string().optional(),
  dark: z.string().optional(),
  imageUrl: z.string().optional(),
});

const ruleSet = z.object({
  revision: z.number().int().nonnegative(),
  inherit: z.boolean(),
  items: z.array(iconRule).max(32),
});

export const fileIconRulesViewSchema = ruleSet.extend({
  defaults: z.array(iconRule),
  canSave: z.boolean(),
});
export const activeFileIconsSchema = ruleSet.pick({ items: true });
export type FileIconRule = z.infer<typeof iconRule>;
export type FileIconRuleSet = z.infer<typeof ruleSet>;
export type FileIconRulesView = z.infer<typeof fileIconRulesViewSchema>;

export function fileIconExtension(name: string) {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export const fileIconExtensionPattern = /^[a-z0-9][a-z0-9_+-]{0,23}$/;
export const fileIconColorPattern = /^#[0-9a-f]{6}$/i;

export function fileIconImageAllowed(value: string) {
  if (!value.startsWith('https://') || value.length > 512 || /[?#\\]/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return (
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(parsed.hostname) &&
      !/\.(local|localhost|internal|lan|home|onion)$/.test(parsed.hostname) &&
      /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(decodeURIComponent(parsed.pathname))
    );
  } catch {
    return false;
  }
}
