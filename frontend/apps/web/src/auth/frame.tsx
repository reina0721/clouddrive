'use client';
import './install-translations';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Languages, Moon, Sparkles, Sun } from 'lucide-react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { useShellStore } from '../state/use-shell-store';
import { EnvironmentNotice } from './environment-notice';

export function AuthFrame({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useFrontendTranslation();
  const locale = useShellStore((state) => state.locale);
  const theme = useShellStore((state) => state.theme);
  const setLocale = useShellStore((state) => state.setLocale);
  const setTheme = useShellStore((state) => state.setTheme);
  return (
    <main id="main-content" className="min-h-screen bg-canvas px-4 py-6 sm:px-8 lg:py-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 pb-8">
        <Link
          href="/welcome"
          className="flex items-center gap-3 font-bold text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <span className="grid size-10 place-items-center rounded-control bg-brand text-on-brand">
            C
          </span>
          <span>{t('brand.name')}</span>
        </Link>
        <div className="flex gap-2">
          <IconAction
            label={t('shell.locale')}
            onPress={() => setLocale(locale === 'en' ? 'zh-CN' : 'en')}
          >
            <Languages className="size-4.5" />
          </IconAction>
          <IconAction
            label={t('shell.theme')}
            onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <Moon className="size-4.5" /> : <Sun className="size-4.5" />}
          </IconAction>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <section
          className="hidden min-h-128 flex-col justify-center gap-8 rounded-panel bg-brand-soft p-10 lg:flex"
          aria-label={t('auth.brandTitle')}
        >
          <Sparkles className="size-12 text-brand" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-brand">{t('auth.brandEyebrow')}</p>
            <h2 className="mt-4 text-balance text-4xl font-extrabold tracking-tight text-ink">
              {t('auth.brandTitle')}
            </h2>
            <p className="mt-5 max-w-sm text-base leading-8 text-ink-muted">
              {t('auth.brandDescription')}
            </p>
          </div>
          <ul className="grid gap-4 text-sm text-ink">
            {['workbench', 'preferences', 'feedback'].map((key) => (
              <li className="flex items-center gap-3" key={key}>
                <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                {t(`auth.benefits.${key}`)}
              </li>
            ))}
          </ul>
        </section>
        <div className="mx-auto w-full min-w-0 max-w-md rounded-panel border border-border bg-surface p-6 sm:p-8">
          {children}
          <EnvironmentNotice />
        </div>
      </div>
    </main>
  );
}
