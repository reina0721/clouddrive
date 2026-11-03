'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import {
  ACCENT_PRESETS,
  CONTENT_WIDTHS,
  DENSITY_LEVELS,
  IDLE_LOCK_MINUTES,
  LAYOUT_MODES,
  MOTION_PREFERENCES,
  PAGE_TRANSITIONS,
  PREFERENCES_VERSION,
  THEME_MODES,
  type Preferences,
} from '@clouddrive/surface/preferences-model';
import { Action } from '@clouddrive/ui-adapter/action';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { RadioGroupField, SelectField, SwitchField } from '@clouddrive/ui-adapter/form-field';
import { ConfirmDialog, DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore, useState } from 'react';

import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';

/**
 * 快捷偏好抽屉（Host Shell）。
 *
 * 单一事实源：与 `/settings` 共用 `PreferencesPort`（同一 store、同一持久化 key
 * `clouddrive.shell`、同一校验与失败语义），抽屉只提供高频项的即时预览，
 * 不建立第二份偏好状态，也不复制设置页的业务规则。
 */
/** pageTransition 值 → i18n key 片段（fade-slide → fadeSlide）。 */
function transitionKey(value: (typeof PAGE_TRANSITIONS)[number]): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function QuickPreferencesDrawer({
  open,
  onOpenChange,
}: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>) {
  const { t } = useFrontendTranslation();
  const port = usePreferencesPort<Preferences>();
  const preferences = useSyncExternalStore(port.subscribe, port.getSnapshot, port.getSnapshot);
  const [failure, setFailure] = useState<string | null>(null);
  const feedback = useFeedback();

  const apply = (result: { ok: true } | { ok: false; code: string }) => {
    setFailure(
      result.ok ? null : t('shell.quickPreferences.persistFailure', { code: result.code }),
    );
  };
  const update = <C extends keyof Preferences>(category: C, patch: Partial<Preferences[C]>) => {
    apply(port.updateCategory(category, patch));
  };

  const copyConfiguration = async () => {
    const payload = JSON.stringify(
      {
        kind: 'clouddrive.preferences',
        version: PREFERENCES_VERSION,
        exportedAt: new Date().toISOString(),
        preferences,
      },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(payload);
      feedback.notify({ tone: 'success', title: t('shell.quickPreferences.copied') });
    } catch {
      feedback.notify({ tone: 'danger', title: t('shell.quickPreferences.copyFailure') });
    }
  };

  return (
    <DrawerSurface
      closeLabel={t('shell.quickPreferences.close')}
      description={t('shell.quickPreferences.description')}
      isOpen={open}
      placement="right"
      title={t('shell.quickPreferences.title')}
      triggerLabel={t('shell.quickPreferences.open')}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-6">
        {failure ? (
          <AlertBanner
            description={t('shell.quickPreferences.persistFailureHint')}
            icon={<TriangleAlert aria-hidden="true" className="size-4" />}
            title={failure}
            tone="warning"
          />
        ) : null}

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">
            {t('shell.quickPreferences.appearance')}
          </h3>
          <RadioGroupField
            label={t('shell.quickPreferences.themeMode')}
            options={THEME_MODES.map((value) => ({
              value,
              label: t(`shell.quickPreferences.themeModes.${value}`),
            }))}
            presentation="inline"
            value={preferences.appearance.themeMode}
            onValueChange={(value) =>
              update('appearance', { themeMode: value as Preferences['appearance']['themeMode'] })
            }
          />
          <RadioGroupField
            label={t('shell.quickPreferences.accent')}
            options={ACCENT_PRESETS.map((value) => ({
              value,
              label: t(`shell.quickPreferences.accents.${value}`),
            }))}
            presentation="inline"
            value={preferences.appearance.accent}
            onValueChange={(value) =>
              update('appearance', { accent: value as Preferences['appearance']['accent'] })
            }
          />
          <RadioGroupField
            label={t('shell.quickPreferences.density')}
            options={DENSITY_LEVELS.map((value) => ({
              value,
              label: t(`shell.quickPreferences.densities.${value}`),
            }))}
            presentation="inline"
            value={preferences.appearance.density}
            onValueChange={(value) =>
              update('appearance', { density: value as Preferences['appearance']['density'] })
            }
          />
          <RadioGroupField
            label={t('shell.quickPreferences.contentWidth')}
            options={CONTENT_WIDTHS.map((value) => ({
              value,
              label: t(`shell.quickPreferences.widths.${value}`),
            }))}
            presentation="inline"
            value={preferences.appearance.contentWidth}
            onValueChange={(value) =>
              update('appearance', {
                contentWidth: value as Preferences['appearance']['contentWidth'],
              })
            }
          />
          <SelectField
            label={t('shell.quickPreferences.motion')}
            options={MOTION_PREFERENCES.map((value) => ({
              value,
              label: t(`shell.quickPreferences.motions.${value}`),
            }))}
            value={preferences.appearance.motion}
            onValueChange={(value) =>
              update('appearance', { motion: value as Preferences['appearance']['motion'] })
            }
          />
          <SelectField
            label={t('shell.quickPreferences.pageTransition')}
            options={PAGE_TRANSITIONS.map((value) => ({
              value,
              label: t(`shell.quickPreferences.pageTransitions.${transitionKey(value)}`),
            }))}
            value={preferences.appearance.pageTransition}
            onValueChange={(value) =>
              update('appearance', {
                pageTransition: value as Preferences['appearance']['pageTransition'],
              })
            }
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">{t('shell.quickPreferences.layout')}</h3>
          <RadioGroupField
            label={t('shell.quickPreferences.layoutMode')}
            options={LAYOUT_MODES.map((value) => ({
              value,
              label: t(`shell.quickPreferences.layoutModes.${value}`),
              description: t(`shell.quickPreferences.layoutModes.${value}Hint`),
            }))}
            presentation="rows"
            value={preferences.navigation.layoutMode}
            onValueChange={(value) =>
              update('navigation', {
                layoutMode: value as Preferences['navigation']['layoutMode'],
              })
            }
          />
          <SwitchField
            checked={preferences.navigation.pageTabsEnabled}
            description={t('shell.quickPreferences.pageTabsDescription')}
            label={t('shell.quickPreferences.pageTabs')}
            presentation="row"
            onCheckedChange={(checked) => update('navigation', { pageTabsEnabled: checked })}
          />
          <SwitchField
            checked={preferences.navigation.pageTabsPinned}
            description={t('shell.quickPreferences.pageTabsPinnedDescription')}
            disabled={!preferences.navigation.pageTabsEnabled}
            label={t('shell.quickPreferences.pageTabsPinned')}
            presentation="row"
            onCheckedChange={(checked) => update('navigation', { pageTabsPinned: checked })}
          />
          <SwitchField
            checked={preferences.navigation.breadcrumbs}
            description={t('shell.quickPreferences.breadcrumbsDescription')}
            label={t('shell.quickPreferences.breadcrumbs')}
            presentation="row"
            onCheckedChange={(checked) => update('navigation', { breadcrumbs: checked })}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">{t('shell.quickPreferences.security')}</h3>
          <SwitchField
            checked={preferences.security.watermark}
            description={t('shell.quickPreferences.watermarkDescription')}
            label={t('shell.quickPreferences.watermark')}
            presentation="row"
            onCheckedChange={(checked) => update('security', { watermark: checked })}
          />
          <SelectField
            label={t('shell.quickPreferences.idleLock')}
            options={IDLE_LOCK_MINUTES.map((value) => ({
              value: String(value),
              label: t(`shell.quickPreferences.idleLockOptions.${value}`),
            }))}
            value={String(preferences.security.idleLockMinutes)}
            onValueChange={(value) =>
              update('security', {
                idleLockMinutes: Number(value) as Preferences['security']['idleLockMinutes'],
              })
            }
          />
          <SwitchField
            checked={preferences.security.lockOnHidden}
            description={t('shell.quickPreferences.lockOnHiddenDescription')}
            label={t('shell.quickPreferences.lockOnHidden')}
            presentation="row"
            onCheckedChange={(checked) => update('security', { lockOnHidden: checked })}
          />
          <Action
            size="sm"
            variant="secondary"
            onPress={() => window.dispatchEvent(new Event('clouddrive:lock'))}
          >
            {t('shell.quickPreferences.lockNow')}
          </Action>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap gap-2">
            <Action size="sm" variant="secondary" onPress={() => void copyConfiguration()}>
              {t('shell.quickPreferences.copy')}
            </Action>
            <Link
              className="inline-flex h-control-sm items-center rounded-control border border-border bg-surface px-3 text-sm font-semibold text-ink outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus-ring"
              href="/settings"
              onClick={() => onOpenChange(false)}
            >
              {t('shell.quickPreferences.openAll')}
            </Link>
          </div>
          <ConfirmDialog
            cancelLabel={t('common.cancel')}
            confirmLabel={t('shell.quickPreferences.resetConfirm')}
            description={t('shell.quickPreferences.resetDescription')}
            failureMessage={t('shell.quickPreferences.resetFailure')}
            impact={t('shell.quickPreferences.resetImpact')}
            title={t('shell.quickPreferences.resetTitle')}
            triggerLabel={t('shell.quickPreferences.reset')}
            onConfirm={() => {
              apply(port.resetAll());
            }}
          />
        </section>
      </div>
    </DrawerSurface>
  );
}
