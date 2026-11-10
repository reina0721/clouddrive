'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { RouteLink, route } from '@clouddrive/plugin-framework/plugin';

export function SettingsSections({ active }: Readonly<{ active: 'site' | 'registration' }>) {
  const { t } = useFrontendTranslation();
  const links = [
    { id: 'site', title: t('systemSettings.site.title'), target: route('system-settings.site') },
    { id: 'registration', title: t('systemSettings.title'), target: route('system-settings') },
  ];
  return (
    <nav
      aria-label={t('systemSettings.nav')}
      className="flex flex-wrap gap-2 border-b border-border"
    >
      {links.map(({ id, title, target }) =>
        id === active ? (
          <span
            key={id}
            aria-current="page"
            className="border-b-2 border-brand px-3 py-2 text-sm font-semibold text-brand"
          >
            {title}
          </span>
        ) : (
          <RouteLink
            key={id}
            target={target}
            className="px-3 py-2 text-sm text-ink-muted hover:text-brand"
          >
            {title}
          </RouteLink>
        ),
      )}
    </nav>
  );
}
