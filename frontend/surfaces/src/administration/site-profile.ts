import { z } from 'zod';

export const siteProfileLimits = { name: 80, description: 600, url: 1024 } as const;

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
});

export const siteProfileVersionSchema = z.strictObject({
  revision: z.int().positive(),
  profile: siteProfileSchema,
});

export type SiteProfile = z.infer<typeof siteProfileSchema>;
export type SiteProfileVersion = z.infer<typeof siteProfileVersionSchema>;

export class SiteProfileError extends Error {
  constructor(readonly code: 'conflict' | 'forbidden' | 'invalid' | 'unavailable') {
    super(code);
  }
}
