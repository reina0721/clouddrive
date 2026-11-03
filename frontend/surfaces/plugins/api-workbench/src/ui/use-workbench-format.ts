import { formatDate, formatNumber, useFrontendTranslation } from '@clouddrive/i18n';

export function useWorkbenchFormat() {
  const { t, locale } = useFrontendTranslation();
  const count = (value: number) => formatNumber(locale, value);
  return {
    count,
    duration: (value: number) => t('apiWorkbench.common.ms', { value: count(value) }),
    bytes: (value: number) =>
      value < 1024
        ? t('apiWorkbench.common.bytes', { value: count(value) })
        : t('apiWorkbench.common.kilobytes', {
            value: formatNumber(locale, value / 1024, { maximumFractionDigits: 1 }),
          }),
    timestamp: (value: string) =>
      Number.isNaN(Date.parse(value))
        ? value
        : formatDate(locale, value, { dateStyle: 'short', timeStyle: 'medium' }),
  };
}
