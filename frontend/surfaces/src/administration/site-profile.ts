import { z } from 'zod';

export const siteProfileLimits = { name: 80, description: 600, url: 1024 } as const;
export const maxSiteAlternatives = 8;

export function normalizeSiteOrigin(value: string): string | undefined {
  const input = value.trim();
  if (!/^https?:\/\/[^/]+\/?$/i.test(input) || /[\s\\?#\p{Cc}]/u.test(input)) return;
  try {
    const url = new URL(input);
    if (
      url.username ||
      url.password ||
      url.port === '0' ||
      url.pathname !== '/' ||
      url.hostname.endsWith('.')
    )
      return;
    if (
      url.protocol === 'http:' &&
      url.hostname !== 'localhost' &&
      url.hostname !== '[::1]' &&
      !/^127\.\d+\.\d+\.\d+$/.test(url.hostname)
    )
      return;
    return url.origin;
  } catch {
    return;
  }
}

const siteOrigin = z
  .string()
  .max(siteProfileLimits.url)
  .refine((value) => !!normalizeSiteOrigin(value));
export const siteAddressesSchema = z
  .strictObject({
    primary: z.string().max(siteProfileLimits.url),
    alternatives: z.array(siteOrigin).max(maxSiteAlternatives),
  })
  .refine((value) => {
    if (!value.primary.trim() && !value.alternatives.length) return true;
    const primary = normalizeSiteOrigin(value.primary);
    const normalized = [primary, ...value.alternatives.map(normalizeSiteOrigin)];
    return !!primary && normalized.every(Boolean) && new Set(normalized).size === normalized.length;
  });

const publicURL = z
  .string()
  .max(siteProfileLimits.url)
  .refine((value) => {
    if (!value) return true;
    if (/[\s\\\p{Cc}]/u.test(value)) return false;
    if (value.startsWith('/')) return !value.startsWith('//');
    if (!value.startsWith('https://') || value.startsWith('https:///')) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
    } catch {
      return false;
    }
  });

export const siteProfileSchema = z.strictObject({
  name: z
    .string()
    .refine((value) => [...value].length <= siteProfileLimits.name && !/\p{Cc}/u.test(value)),
  description: z
    .string()
    .refine(
      (value) =>
        [...value].length <= siteProfileLimits.description &&
        !/\p{Cc}/u.test(value.replace(/[\n\t]/g, '')),
    ),
  lightLogo: publicURL,
  darkLogo: publicURL,
  icon: publicURL,
  termsUrl: publicURL,
  privacyUrl: publicURL,
  siteAddresses: siteAddressesSchema.optional(),
});

export const siteProfileVersionSchema = z.strictObject({
  revision: z.int().positive(),
  profile: siteProfileSchema,
});

export const siteProfileManagementSchema = siteProfileVersionSchema.extend({
  publicationOrigins: z.array(siteOrigin).max(32).optional(),
});

export type SiteAddresses = z.infer<typeof siteAddressesSchema>;
export type SiteProfile = z.infer<typeof siteProfileSchema>;
export type SiteProfileVersion = z.infer<typeof siteProfileVersionSchema>;
export type SiteProfileManagement = z.infer<typeof siteProfileManagementSchema>;

export class SiteProfileError extends Error {
  constructor(
    readonly code: 'conflict' | 'forbidden' | 'invalid' | 'origin-not-allowed' | 'unavailable',
  ) {
    super(code);
  }
}
