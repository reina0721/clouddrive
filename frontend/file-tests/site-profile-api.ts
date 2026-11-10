import type { Page } from '@playwright/test';
import type {
  SiteProfileManagement,
  SiteProfileVersion,
} from '../surfaces/src/administration/site-profile';

export async function siteProfileAPI(
  page: Page,
  value?: SiteProfileVersion,
): Promise<SiteProfileManagement> {
  return page.evaluate(async (value) => {
    const prefix = '/api/console/v1';
    const headers = new Headers();
    if (value) {
      const csrf = await fetch(prefix + '/auth/csrf');
      if (!csrf.ok) throw new Error('Site fixture CSRF HTTP ' + csrf.status);
      const { token } = (await csrf.json()) as { token: string };
      headers.set('X-CSRF-Token', token);
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(prefix + '/system/site-profile', {
      method: value ? 'PUT' : 'GET',
      headers,
      ...(value ? { body: JSON.stringify(value) } : {}),
    });
    if (!response.ok) throw new Error('Site fixture HTTP ' + response.status);
    return (await response.json()) as SiteProfileManagement;
  }, value);
}
