'use client';
import './install-translations';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Cloud, Upload, FileText, Folder, Languages, Moon, Share2, Sun } from 'lucide-react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { CurrentSiteLogo, useSiteProfile } from '@clouddrive/surface/administration/runtime';
import { useShellStore } from '../state/use-shell-store';
import { EnvironmentNotice } from './environment-notice';

export function AuthFrame({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useFrontendTranslation();
  const { profile } = useSiteProfile();
  const name = profile?.name || t('brand.name');
  const locale = useShellStore((state) => state.locale);
  const theme = useShellStore((state) => state.theme);
  const setLocale = useShellStore((state) => state.setLocale);
  const setTheme = useShellStore((state) => state.setTheme);
  return (
    <main id="main-content" className="min-h-screen bg-canvas px-4 py-6 sm:px-8 lg:py-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 pb-8">
        <Link
          href="/"
          aria-label={name}
          className="flex min-w-0 items-center gap-3 font-bold text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <CurrentSiteLogo
            className="size-10 shrink-0"
            fallback={
              <span
                className="grid size-10 shrink-0 place-items-center rounded-action bg-brand-soft text-brand"
                aria-hidden="true"
              >
                <Cloud className="size-6" />
              </span>
            }
          />
          <span className="truncate">{name}</span>
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
          aria-label={profile?.name || t('auth.brandTitle')}
        >
          <div>
            <p className="text-sm font-semibold text-brand">
              {profile?.name || t('auth.brandEyebrow')}
            </p>
            <h2 className="mt-4 text-balance text-4xl font-extrabold tracking-tight text-ink">
              {t('auth.brandTitle')}
            </h2>
            <p className="mt-5 max-w-sm whitespace-pre-wrap break-words text-base leading-8 text-ink-muted">
              {profile?.description || t('auth.brandDescription')}
            </p>
          </div>
          <div aria-hidden="true" className="relative mx-auto w-full max-w-sm pt-4">
            <div className="absolute inset-x-4 top-0 bottom-4 -rotate-3 rounded-panel border border-brand/15 bg-surface/60" />
            <div className="relative flex items-center gap-5 rounded-panel border border-brand/15 bg-surface p-6">
              <Folder className="size-14 shrink-0 text-brand" strokeWidth={1.5} />
              <div className="min-w-0 flex-1 space-y-4">
                {[
                  ['w-20', 'w-32'],
                  ['w-28', 'w-16'],
                ].map(([first, second], index) => (
                  <div key={index} className="flex items-center gap-3">
                    <FileText className="size-7 shrink-0 text-brand/70" strokeWidth={1.5} />
                    <div className="flex-1 space-y-2">
                      <div className={`h-2 max-w-full rounded-full bg-brand/20 ${first}`} />
                      <div className={`h-2 max-w-full rounded-full bg-brand/10 ${second}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ul className="grid gap-4 text-sm text-ink">
            {(
              [
                ['upload', Upload],
                ['read', FileText],
                ['share', Share2],
              ] as const
            ).map(([key, Icon]) => (
              <li className="flex items-center gap-3" key={key}>
                <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
                {t(`auth.benefits.${key}`)}
              </li>
            ))}
          </ul>
        </section>
        <div className="mx-auto w-full min-w-0 max-w-md rounded-panel border border-border bg-surface p-6 sm:p-8">
          {children}
          <EnvironmentNotice />
          {profile?.termsUrl || profile?.privacyUrl ? (
            <footer className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4 text-sm text-ink-muted">
              {profile.termsUrl ? (
                <a
                  className="text-brand underline"
                  href={profile.termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('auth.termsOfUse')}
                </a>
              ) : null}
              {profile.privacyUrl ? (
                <a
                  className="text-brand underline"
                  href={profile.privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('auth.privacyPolicy')}
                </a>
              ) : null}
            </footer>
          ) : null}
        </div>
      </div>
    </main>
  );
}
