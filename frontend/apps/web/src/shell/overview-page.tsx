'use client';
import { formatDate, formatTimeOfDay, useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { generatedSurfaceRegistry } from '@clouddrive/surface/generated/composition';
import { RouterTextLink } from '../host/router-text-link';
import { useShellStore } from '../state/use-shell-store';
import { useWorkbenchStore } from '../state/use-workbench-store';
import { useNavigationTitle } from './use-navigation-title';

export default function OverviewPage() {
  const { t, locale } = useFrontendTranslation();
  const recents = useWorkbenchStore((state) => state.recents);
  const showRecents = useShellStore((state) => state.preferences.navigation.showRecents);
  const region = useShellStore((state) => state.preferences.localeRegion);
  const entryTitle = useNavigationTitle();
  const recentPages = recents
    .filter((entry) => {
      let url: URL;
      try {
        url = new URL(entry.pathname, 'https://console.invalid');
      } catch {
        return false;
      }
      return (
        url.origin === 'https://console.invalid' &&
        url.pathname !== '/' &&
        Object.values(generatedSurfaceRegistry.routes).some(
          (route) => route.pattern === url.pathname,
        ) &&
        (!/\/(detail|edit)$/.test(url.pathname) || Boolean(url.searchParams.get('id')))
      );
    })
    .slice(0, 6);
  return (
    <Page>
      <PageHeader title={t('overview.title')} description="" />
      {showRecents ? (
        <Section appearance="outlined" id="workbench-recents" title={t('overview.recentsTitle')}>
          {recentPages.length ? (
            <ol data-reveal-items className="divide-y divide-border p-5">
              {recentPages.map((entry) => (
                <li
                  key={entry.pathname}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
                >
                  <RouterTextLink href={entry.pathname}>
                    <span className="inline-flex min-h-control items-center">
                      {entryTitle(entry.pathname, entry.title)}
                    </span>
                  </RouterTextLink>
                  <time
                    className="text-xs text-ink-muted"
                    dateTime={new Date(entry.visitedAt).toISOString()}
                  >
                    {formatDate(
                      locale,
                      entry.visitedAt,
                      region.timeZone === 'auto' ? {} : { timeZone: region.timeZone },
                    )}{' '}
                    · {formatTimeOfDay(locale, region, entry.visitedAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="p-5 text-sm text-ink-muted">{t('overview.recentsEmpty')}</p>
          )}
        </Section>
      ) : null}
    </Page>
  );
}
