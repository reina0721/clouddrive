'use client';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import {
  usePreferencesPort,
  type PersistResult,
  type PreferencesPort,
} from '@clouddrive/plugin-framework/preferences';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { TriangleAlert } from 'lucide-react';
import type { Ctx } from './category-sections';
export function useSettingsPersistReport(): {
  reportingPort: PreferencesPort<Preferences>;
  banner: ReactNode;
  setLastResult: (result: PersistResult) => void;
  ctxFor: (prefs: Preferences) => Ctx;
} {
  const { t } = useFrontendTranslation();
  const port = usePreferencesPort<Preferences>();
  const [lastResult, setLastResult] = useState<PersistResult | null>(null);
  const [lastApply, setLastApply] = useState<(() => PersistResult) | null>(null);

  const reportingPort: PreferencesPort<Preferences> = {
    getSnapshot: port.getSnapshot.bind(port),
    subscribe: port.subscribe.bind(port),
    updateCategory: (category, patch) => {
      const run = () => port.updateCategory(category, patch);
      const result = run();
      setLastApply(() => run);
      setLastResult(result);
      return result;
    },
    resetCategory: (category) => {
      const run = () => port.resetCategory(category);
      const result = run();
      setLastApply(() => run);
      setLastResult(result);
      return result;
    },
    resetAll: () => {
      const run = () => port.resetAll();
      const result = run();
      setLastApply(() => run);
      setLastResult(result);
      return result;
    },
  };

  const banner =
    lastResult && !lastResult.ok ? (
      <AlertBanner
        actionLabel={t('settings.retry')}
        description={t('settings.notSavedDescription')}
        icon={<TriangleAlert className="size-4" aria-hidden="true" />}
        onAction={() => {
          if (lastApply) setLastResult(lastApply());
        }}
        title={t('settings.notSaved')}
        tone="warning"
      />
    ) : null;

  const ctxFor = (prefs: Preferences): Ctx => ({ port: reportingPort, prefs });
  return { reportingPort, banner, setLastResult, ctxFor };
}

/** 响应式 prefs 订阅（layout 单实例，供 ctx 构造）。 */
export function useSettingsPreferences(): Preferences {
  const port = usePreferencesPort<Preferences>();
  return useSyncExternalStore(port.subscribe, port.getSnapshot, port.getSnapshot);
}
