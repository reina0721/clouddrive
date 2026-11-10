import {
  siteProfileSchema,
  siteProfileVersionSchema,
  SiteProfileError,
  type SiteProfileVersion,
} from '@clouddrive/surface/administration';
import { ApiError, createJsonClient } from '../api/json-client';

export function createSiteProfileClient(apiBaseUrl: string) {
  const request = createJsonClient(apiBaseUrl);
  const path = '/system/site-profile';
  async function call(operation: () => Promise<unknown>) {
    try {
      return await operation();
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 409) throw new SiteProfileError('conflict');
      if (status === 403) throw new SiteProfileError('forbidden');
      if (status === 422) throw new SiteProfileError('invalid');
      throw new SiteProfileError('unavailable');
    }
  }
  return {
    async publicProfile(signal: AbortSignal) {
      return siteProfileSchema.parse(await request('/site-profile', { signal }));
    },
    async read(signal?: AbortSignal) {
      return siteProfileVersionSchema.parse(
        await call(() => request(path, signal ? { signal } : {})),
      );
    },
    async save(value: SiteProfileVersion) {
      return siteProfileVersionSchema.parse(
        await call(() => request(path, { method: 'PUT', body: value })),
      );
    },
  };
}
