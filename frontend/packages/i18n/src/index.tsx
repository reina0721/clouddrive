/* Library entry同时导出 runtime、Hook、Provider 与 formatter，不是应用 Fast Refresh 边界。 */
/* eslint-disable react-refresh/only-export-components */
import i18next, { type i18n as I18nextInstance } from 'i18next';
import {
  I18nextProvider,
  initReactI18next,
  useTranslation as useVendorTranslation,
} from 'react-i18next';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type TranslationResources = Readonly<
  Record<string, Readonly<{ translation: Readonly<Record<string, unknown>> }>>
>;

export type FrontendI18nRuntime = Readonly<{
  locale: () => string;
  changeLocale: (locale: string) => Promise<void>;
  translate: (key: string, values?: Readonly<Record<string, unknown>>) => string;
  addResources: (resources: TranslationResources) => void;
}>;

const RuntimeContext = createContext<FrontendI18nRuntime | null>(null);

const runtimeInstances = new WeakMap<FrontendI18nRuntime, I18nextInstance>();

export function createFrontendI18n({
  resources,
  defaultLocale,
  supportedLocales,
}: Readonly<{
  resources: TranslationResources;
  defaultLocale: string;
  supportedLocales: readonly string[];
}>): FrontendI18nRuntime {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    supportedLngs: [...supportedLocales],
    interpolation: { escapeValue: false },
  });

  const runtime: FrontendI18nRuntime = {
    locale: () => instance.language,
    changeLocale: async (locale) => {
      if (!supportedLocales.includes(locale)) throw new Error(`Unsupported locale: ${locale}`);
      await instance.changeLanguage(locale);
    },
    translate: (key, values) => (values ? instance.t(key, values) : instance.t(key)),
    addResources: (additional) => {
      for (const locale of Object.keys(additional)) {
        if (!supportedLocales.includes(locale)) throw new Error(`Unsupported locale: ${locale}`);
      }
      for (const [locale, resource] of Object.entries(additional)) {
        instance.addResourceBundle(locale, 'translation', resource.translation, true, true);
      }
    },
  };
  runtimeInstances.set(runtime, instance);
  return runtime;
}

export function FrontendI18nProvider({
  runtime,
  children,
}: Readonly<{ runtime: FrontendI18nRuntime; children: ReactNode }>) {
  const instance = runtimeInstances.get(runtime);
  if (!instance) throw new Error('Frontend i18n runtime is not active.');
  return (
    <RuntimeContext.Provider value={runtime}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </RuntimeContext.Provider>
  );
}

/** 页面拥有资源，安装完成才挂载消费者；仍使用同一语言运行时。资源须为稳定模块常量。 */
export function FrontendMessages({
  resources,
  fallback = null,
  children,
}: Readonly<{
  resources: TranslationResources;
  fallback?: ReactNode;
  children: ReactNode;
}>) {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('Frontend i18n runtime is not active.');
  const [installed, setInstalled] = useState<{
    runtime: FrontendI18nRuntime;
    resources: TranslationResources;
    error?: Error;
  }>();
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        runtime.addResources(resources);
        setInstalled({ runtime, resources });
      } catch (error) {
        setInstalled({
          runtime,
          resources,
          error:
            error instanceof Error
              ? error
              : new Error('Page messages could not be installed.', { cause: error }),
        });
      }
    });
    return () => {
      active = false;
    };
  }, [runtime, resources]);
  if (installed?.runtime !== runtime || installed.resources !== resources) return fallback;
  if (installed.error) throw installed.error;
  return children;
}

export function useFrontendTranslation() {
  const { t, i18n } = useVendorTranslation();
  return { t, locale: i18n.language } as const;
}

export function formatDate(
  locale: string,
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatNumber(
  locale: string,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatRelativeTime(
  locale: string,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
}

export { formatTimeOfDay, type HourCycleOption, type TimeDisplayOptions } from './format';
