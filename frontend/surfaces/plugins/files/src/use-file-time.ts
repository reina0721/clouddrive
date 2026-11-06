'use client';
import { useSyncExternalStore } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstant, formatInstantDate } from '@clouddrive/i18n/format';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import type { Preferences } from '../../../src/preferences-model';

/** useFileTime 订阅既有区域偏好，统一文件瞬间显示，不持有第二套设置。 */
export function useFileTime() {
  const port = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    port.subscribe,
    port.getSnapshot,
    port.getSnapshot,
  ).localeRegion;
  const { locale, t } = useFrontendTranslation();
  const display = (value: string, kind: 'date' | 'full') => {
    try {
      return kind === 'date'
        ? formatInstantDate(region, value)
        : formatInstant(locale, region, value);
    } catch (error) {
      if (error instanceof RangeError) return t('files.time.unavailable');
      throw error;
    }
  };
  return {
    region,
    date: (value: string) => display(value, 'date'),
    full: (value: string) => display(value, 'full'),
  };
}
