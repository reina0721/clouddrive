'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import type { PreferencesPort } from '@clouddrive/plugin-framework/preferences';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import {
  validatePreferences,
  IDLE_LOCK_MINUTES,
  PAGE_TRANSITIONS,
  TIME_ZONE_OPTIONS,
} from '@clouddrive/surface/preferences-model';
import {
  RadioGroupField,
  SelectField,
  SwitchField,
  TextField,
} from '@clouddrive/ui-adapter/form-field';
import { Action } from '@clouddrive/ui-adapter/action';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { Children, isValidElement, type ReactNode } from 'react';
import { Section } from '@clouddrive/surface-foundation/layout';
import { SETTINGS_INDEX } from './settings-index';
import { LockKeyhole, Sun, Moon, MonitorCog, SunMoon } from 'lucide-react';
import {
  AppearanceFeedback,
  DensityPreview,
  FontPreview,
  WidthPreview,
  LongTextFeedback,
  LocaleFeedback,
  NotificationFeedback,
} from './setting-previews';

/**
 * 分类设置区段（settings 插件）—— 每个区段真实消费 preferences-model 的对应分类，
 * 复用现有 Radio/Select/Switch；改动经 PreferencesPort.updateCategory 即时生效。
 *
 * 统一规则：
 * - 产品强制（错误/安全/高风险不可关、危险输入确认不可削弱、numbersFollowLocale 跟随
 *   地区不可关闭）以 disabled + 说明表达，不渲染可关开关；
 * - 同义设置共享字段：可访问性中的字号/动效/对比度其实只是"引用外观值"的展示，不重复
 *   建开关（增强项才是 accessibility 自有）。
 */

export type Ctx = {
  port: PreferencesPort<Preferences>;
  prefs: Preferences;
};

function updateSetting<C extends keyof Preferences>(
  ctx: Ctx,
  category: C,
  patch: { [K in keyof Preferences[C]]?: unknown },
) {
  const candidate = validatePreferences({
    ...ctx.prefs,
    [category]: { ...ctx.prefs[category], ...patch },
  });
  if (!candidate.ok)
    throw new Error(candidate.issues.map((issue) => issue.path + ': ' + issue.message).join('; '));
  return ctx.port.updateCategory(category, candidate.value[category]);
}

/** pageTransition 值 → i18n key 片段（fade-slide → fadeSlide）。 */
function transitionI18nKey(value: (typeof PAGE_TRANSITIONS)[number]): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function SectionShell({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  const { t } = useFrontendTranslation();
  const section = (
    <Section title={title} appearance="outlined" contentInset>
      <div data-reveal-items className="grid gap-4">
        {Children.toArray(children).map((child) => {
          if (!isValidElement<{ label?: string }>(child)) return child;
          const entry = SETTINGS_INDEX.find(
            (candidate) => t(candidate.nameKey) === child.props.label,
          );
          return entry ? (
            <div
              key={entry.category + entry.fieldId}
              id={`settings-${entry.category}-${entry.fieldId}`}
              tabIndex={-1}
              className="min-w-0 outline-none"
            >
              {child}
            </div>
          ) : (
            child
          );
        })}
      </div>
    </Section>
  );
  return section;
}

/* ------------------------------------------------------------------ */
/* 外观 Appearance                                                      */
/* ------------------------------------------------------------------ */

export function AppearanceSection({ ctx }: Readonly<{ ctx: Ctx }>) {
  const { t } = useFrontendTranslation();
  const appearance = ctx.prefs.appearance;
  return (
    <>
      <SectionShell title={t('settings.groups.theme')}>
        <RadioGroupField
          presentation="tiles"
          labelIcon={<SunMoon className="size-5" />}
          hint={t('settings.appearance.themeModeDescription')}
          label={t('settings.appearance.themeMode')}
          options={[
            {
              label: t('settings.appearance.themeLight'),
              value: 'light',
              icon: <Sun className="size-5" />,
            },
            {
              label: t('settings.appearance.themeDark'),
              value: 'dark',
              icon: <Moon className="size-5" />,
            },
            {
              label: t('settings.appearance.themeSystem'),
              value: 'system',
              icon: <MonitorCog className="size-5" />,
            },
          ]}
          value={appearance.themeMode}
          onValueChange={(value) => updateSetting(ctx, 'appearance', { themeMode: value })}
        />
        <RadioGroupField
          presentation="inline"
          hint={t('settings.appearance.accentDescription')}
          label={t('settings.appearance.accent')}
          options={[
            {
              label: t('settings.appearance.accentPurple'),
              value: 'purple',
              icon: (
                <span
                  className="ds-accent-swatch size-5 rounded-full"
                  data-accent-preview="purple"
                />
              ),
            },
            {
              label: t('settings.appearance.accentBlue'),
              value: 'blue',
              icon: (
                <span className="ds-accent-swatch size-5 rounded-full" data-accent-preview="blue" />
              ),
            },
            {
              label: t('settings.appearance.accentGreen'),
              value: 'green',
              icon: (
                <span
                  className="ds-accent-swatch size-5 rounded-full"
                  data-accent-preview="green"
                />
              ),
            },
            {
              label: t('settings.appearance.accentOrange'),
              value: 'orange',
              icon: (
                <span
                  className="ds-accent-swatch size-5 rounded-full"
                  data-accent-preview="orange"
                />
              ),
            },
          ]}
          value={appearance.accent}
          onValueChange={(value) => updateSetting(ctx, 'appearance', { accent: value })}
        />
      </SectionShell>
      <SectionShell title={t('settings.groups.space')}>
        <RadioGroupField
          presentation="previews"
          hint={t('settings.appearance.densityDescription')}
          label={t('settings.appearance.density')}
          options={[
            {
              label: t('settings.appearance.densityCompact'),
              value: 'compact',
              preview: <DensityPreview density="compact" />,
            },
            {
              label: t('settings.appearance.densityStandard'),
              value: 'standard',
              preview: <DensityPreview density="standard" />,
            },
            {
              label: t('settings.appearance.densityComfortable'),
              value: 'comfortable',
              preview: <DensityPreview density="comfortable" />,
            },
          ]}
          value={appearance.density}
          onValueChange={(value) => updateSetting(ctx, 'appearance', { density: value })}
        />
        <RadioGroupField
          presentation="previews"
          hint={t('settings.appearance.fontScaleDescription')}
          label={t('settings.appearance.fontScale')}
          options={[
            {
              label: t('settings.appearance.fontSmall'),
              value: 'small',
              preview: <FontPreview scale="small" sample={t('settings.appearance.fontSample')} />,
            },
            {
              label: t('settings.appearance.fontStandard'),
              value: 'standard',
              preview: (
                <FontPreview scale="standard" sample={t('settings.appearance.fontSample')} />
              ),
            },
            {
              label: t('settings.appearance.fontLarge'),
              value: 'large',
              preview: <FontPreview scale="large" sample={t('settings.appearance.fontSample')} />,
            },
          ]}
          value={appearance.fontScale}
          onValueChange={(value) => updateSetting(ctx, 'appearance', { fontScale: value })}
        />
        <RadioGroupField
          presentation="previews"
          hint={t('settings.appearance.contentWidthDescription')}
          label={t('settings.appearance.contentWidth')}
          options={[
            {
              label: t('settings.appearance.widthAuto'),
              value: 'auto',
              preview: <WidthPreview width="auto" />,
            },
            {
              label: t('settings.appearance.widthStandard'),
              value: 'standard',
              preview: <WidthPreview width="standard" />,
            },
            {
              label: t('settings.appearance.widthWide'),
              value: 'wide',
              preview: <WidthPreview width="wide" />,
            },
          ]}
          value={appearance.contentWidth}
          onValueChange={(value) => updateSetting(ctx, 'appearance', { contentWidth: value })}
        />
      </SectionShell>
      <SectionShell title={t('settings.groups.comfort')}>
        <RadioGroupField
          presentation="inline"
          hint={t('settings.appearance.motionDescription')}
          label={t('settings.appearance.motion')}
          options={[
            { label: t('settings.appearance.motionSystem'), value: 'system' },
            { label: t('settings.appearance.motionStandard'), value: 'standard' },
            { label: t('settings.appearance.motionReduced'), value: 'reduced' },
          ]}
          value={appearance.motion}
          onValueChange={(value) => updateSetting(ctx, 'appearance', { motion: value })}
        />
        <SelectField
          hint={t('settings.appearance.pageTransitionDescription')}
          label={t('settings.appearance.pageTransition')}
          options={PAGE_TRANSITIONS.map((value) => ({
            value,
            label: t(`settings.appearance.pageTransitions.${transitionI18nKey(value)}`),
            description: t(
              `settings.appearance.pageTransitions.${transitionI18nKey(value)}Description`,
            ),
          }))}
          value={appearance.pageTransition}
          onValueChange={(value) =>
            updateSetting(ctx, 'appearance', {
              pageTransition: value,
            })
          }
        />
        <RadioGroupField
          presentation="inline"
          hint={t('settings.appearance.contrastDescription')}
          label={t('settings.appearance.contrast')}
          options={[
            { label: t('settings.appearance.contrastSystem'), value: 'system' },
            { label: t('settings.appearance.contrastStandard'), value: 'standard' },
            { label: t('settings.appearance.contrastHigh'), value: 'high' },
          ]}
          value={appearance.contrast}
          onValueChange={(value) => updateSetting(ctx, 'appearance', { contrast: value })}
        />
        {switchRow(
          ctx,
          'appearance',
          'colorWeak',
          appearance.colorWeak,
          t('settings.appearance.colorWeak'),
          t('settings.appearance.colorWeakDescription'),
        )}
        {switchRow(
          ctx,
          'appearance',
          'grayscale',
          appearance.grayscale,
          t('settings.appearance.grayscale'),
          t('settings.appearance.grayscaleDescription'),
        )}
        <AppearanceFeedback />
      </SectionShell>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 导航 Navigation                                                      */
/* ------------------------------------------------------------------ */

function switchRow(
  ctx: Ctx,
  category: keyof Preferences,
  field: string,
  checked: boolean,
  label: string,
  description: string,
) {
  return (
    <SwitchField
      presentation="row"
      checked={checked}
      description={description}
      label={label}
      onCheckedChange={(next) => updateSetting(ctx, category, { [field]: next })}
    />
  );
}

export function NavigationSection({ ctx }: Readonly<{ ctx: Ctx }>) {
  const { t } = useFrontendTranslation();
  const nav = ctx.prefs.navigation;
  return (
    <>
      <SectionShell title={t('settings.groups.wayfinding')}>
        <RadioGroupField
          presentation="inline"
          hint={t('settings.navigation.layoutModeHint')}
          label={t('settings.navigation.layoutMode')}
          options={[
            {
              label: t('settings.navigation.layoutVertical'),
              value: 'vertical',
              description: t('settings.navigation.layoutVerticalDescription'),
            },
            {
              label: t('settings.navigation.layoutHorizontal'),
              value: 'horizontal',
              description: t('settings.navigation.layoutHorizontalDescription'),
            },
            {
              label: t('settings.navigation.layoutMixed'),
              value: 'mixed',
              description: t('settings.navigation.layoutMixedDescription'),
            },
          ]}
          value={nav.layoutMode}
          onValueChange={(value) => updateSetting(ctx, 'navigation', { layoutMode: value })}
        />
        {switchRow(
          ctx,
          'navigation',
          'scrollToTopOnNavigate',
          nav.scrollToTopOnNavigate,
          t('settings.navigation.scrollToTopOnNavigate'),
          '',
        )}
        {switchRow(
          ctx,
          'navigation',
          'breadcrumbs',
          nav.breadcrumbs,
          t('settings.navigation.breadcrumbs'),
          '',
        )}
        <RadioGroupField
          presentation="inline"
          hint={t('settings.navigation.newPageOpenModeHint')}
          label={t('settings.navigation.newPageOpenMode')}
          options={[
            { label: t('settings.navigation.newPageCurrent'), value: 'current' },
            { label: t('settings.navigation.newPageBrowserTab'), value: 'browser-tab' },
            { label: t('settings.navigation.newPagePageTab'), value: 'page-tab' },
          ]}
          value={nav.newPageOpenMode}
          onValueChange={(value) => updateSetting(ctx, 'navigation', { newPageOpenMode: value })}
        />
      </SectionShell>
      <SectionShell title={t('settings.groups.tabs')}>
        {switchRow(
          ctx,
          'navigation',
          'pageTabsEnabled',
          nav.pageTabsEnabled,
          t('settings.navigation.pageTabsEnabled'),
          '',
        )}
        {switchRow(
          ctx,
          'navigation',
          'restoreLastTabs',
          nav.restoreLastTabs,
          t('settings.navigation.restoreLastTabs'),
          '',
        )}
        <SwitchField
          presentation="row"
          checked={nav.pageTabsPinned}
          disabled={!nav.pageTabsEnabled}
          label={t('settings.navigation.pageTabsPinned')}
          description={t(
            nav.pageTabsEnabled
              ? 'settings.navigation.pageTabsPinnedDescription'
              : 'settings.navigation.pageTabsPinnedUnavailable',
          )}
          onCheckedChange={(pageTabsPinned) => updateSetting(ctx, 'navigation', { pageTabsPinned })}
        />
        <SelectField
          hint={t('settings.navigation.tabCloseBehaviorHint')}
          label={t('settings.navigation.tabCloseBehavior')}
          options={[
            { label: t('settings.navigation.tabCloseRecent'), value: 'recent' },
            { label: t('settings.navigation.tabCloseRight'), value: 'right' },
            { label: t('settings.navigation.tabCloseLeft'), value: 'left' },
          ]}
          value={nav.tabCloseBehavior}
          onValueChange={(value) => updateSetting(ctx, 'navigation', { tabCloseBehavior: value })}
        />
      </SectionShell>
      <SectionShell title={t('settings.groups.memory')}>
        {switchRow(
          ctx,
          'navigation',
          'menuMemory',
          nav.menuMemory,
          t('settings.navigation.menuMemory'),
          '',
        )}
        {switchRow(
          ctx,
          'navigation',
          'rememberRecents',
          nav.rememberRecents,
          t('settings.navigation.rememberRecents'),
          '',
        )}
        {switchRow(
          ctx,
          'navigation',
          'showRecents',
          nav.showRecents,
          t('settings.navigation.showRecents'),
          '',
        )}

        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.navigation.sidebarBehavior')}
          options={[
            { label: t('settings.appearance.sidebarExpanded'), value: 'expanded' },
            { label: t('settings.appearance.sidebarCollapsed'), value: 'collapsed' },
            { label: t('settings.appearance.sidebarRemember'), value: 'remember' },
          ]}
          value={nav.sidebarBehavior}
          onValueChange={(value) => updateSetting(ctx, 'navigation', { sidebarBehavior: value })}
        />
      </SectionShell>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 数据展示 Data display                                                */
/* ------------------------------------------------------------------ */

export function DataDisplaySection({ ctx }: Readonly<{ ctx: Ctx }>) {
  const { t } = useFrontendTranslation();
  const data = ctx.prefs.dataDisplay;
  return (
    <>
      <SectionShell title={t('settings.groups.table')}>
        <SelectField
          hint=""
          label={t('settings.dataDisplay.pageSize')}
          options={[10, 20, 50, 100].map((size) => ({ label: String(size), value: String(size) }))}
          value={String(data.pageSize)}
          onValueChange={(value) => updateSetting(ctx, 'dataDisplay', { pageSize: Number(value) })}
        />
        <RadioGroupField
          presentation="previews"
          hint={t('settings.appearance.comparisonHint')}
          label={t('settings.dataDisplay.tableDensity')}
          options={[
            {
              label: t('settings.appearance.densityCompact'),
              value: 'compact',
              preview: <DensityPreview density="compact" />,
            },
            {
              label: t('settings.appearance.densityStandard'),
              value: 'standard',
              preview: <DensityPreview density="standard" />,
            },
            {
              label: t('settings.appearance.densityComfortable'),
              value: 'comfortable',
              preview: <DensityPreview density="comfortable" />,
            },
          ]}
          value={data.tableDensity}
          onValueChange={(value) => updateSetting(ctx, 'dataDisplay', { tableDensity: value })}
        />
        {switchRow(
          ctx,
          'dataDisplay',
          'rowSeparators',
          data.rowSeparators,
          t('settings.dataDisplay.rowSeparators'),
          '',
        )}
        {switchRow(
          ctx,
          'dataDisplay',
          'stickyHeader',
          data.stickyHeader,
          t('settings.dataDisplay.stickyHeader'),
          '',
        )}
      </SectionShell>
      <SectionShell title={t('settings.groups.tableMemory')}>
        {switchRow(
          ctx,
          'dataDisplay',
          'rememberColumnLayout',
          data.rememberColumnLayout,
          t('settings.dataDisplay.rememberColumnLayout'),
          '',
        )}
        {switchRow(
          ctx,
          'dataDisplay',
          'rememberSort',
          data.rememberSort,
          t('settings.dataDisplay.rememberSort'),
          '',
        )}
        {switchRow(
          ctx,
          'dataDisplay',
          'rememberFilters',
          data.rememberFilters,
          t('settings.dataDisplay.rememberFilters'),
          '',
        )}
        {switchRow(
          ctx,
          'dataDisplay',
          'rememberPagination',
          data.rememberPagination,
          t('settings.dataDisplay.rememberPagination'),
          '',
        )}
      </SectionShell>
      <SectionShell title={t('settings.groups.reading')}>
        {switchRow(
          ctx,
          'dataDisplay',
          'emptyStateHint',
          data.emptyStateHint,
          t('settings.dataDisplay.emptyStateHint'),
          '',
        )}
        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.dataDisplay.longText')}
          options={[
            { label: t('settings.dataDisplay.truncate'), value: 'truncate' },
            { label: t('settings.dataDisplay.wrap'), value: 'wrap' },
          ]}
          value={data.longText}
          onValueChange={(value) => updateSetting(ctx, 'dataDisplay', { longText: value })}
        />
        <LongTextFeedback mode={data.longText} />
      </SectionShell>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 语言与地区 Locale & region                                           */
/* ------------------------------------------------------------------ */

export function LocaleRegionSection({ ctx }: Readonly<{ ctx: Ctx }>) {
  const { t } = useFrontendTranslation();
  const region = ctx.prefs.localeRegion;
  return (
    <>
      <SectionShell title={t('settings.groups.language')}>
        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.localeRegion.language')}
          options={[
            { label: '简体中文', value: 'zh-CN' },
            { label: 'English', value: 'en' },
          ]}
          value={region.language}
          onValueChange={(value) => updateSetting(ctx, 'localeRegion', { language: value })}
        />
      </SectionShell>
      <SectionShell title={t('settings.groups.dateTime')}>
        <SelectField
          hint=""
          label={t('settings.localeRegion.dateFormat')}
          options={['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'].map((format) => ({
            label: format,
            value: format,
          }))}
          value={region.dateFormat}
          onValueChange={(value) => updateSetting(ctx, 'localeRegion', { dateFormat: value })}
        />
        <SelectField
          hint={t('settings.localeRegion.timeZoneHint')}
          label={t('settings.localeRegion.timeZone')}
          options={TIME_ZONE_OPTIONS.map((zone) => ({
            label: zone === 'auto' ? t('settings.localeRegion.timeZoneAuto') : zone,
            value: zone,
          }))}
          value={region.timeZone}
          onValueChange={(value) => updateSetting(ctx, 'localeRegion', { timeZone: value })}
        />
        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.localeRegion.hourCycle')}
          options={[
            { label: t('settings.localeRegion.h24'), value: 'h24' },
            { label: t('settings.localeRegion.h12'), value: 'h12' },
          ]}
          value={region.hourCycle}
          onValueChange={(value) => updateSetting(ctx, 'localeRegion', { hourCycle: value })}
        />
        {switchRow(
          ctx,
          'localeRegion',
          'showSeconds',
          region.showSeconds,
          t('settings.localeRegion.showSeconds'),
          '',
        )}
        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.localeRegion.relativeTime')}
          options={[
            { label: t('settings.localeRegion.relative'), value: 'relative' },
            { label: t('settings.localeRegion.exact'), value: 'exact' },
          ]}
          value={region.relativeTime}
          onValueChange={(value) => updateSetting(ctx, 'localeRegion', { relativeTime: value })}
        />
        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.localeRegion.weekStart')}
          options={[
            { label: t('settings.localeRegion.monday'), value: 'monday' },
            { label: t('settings.localeRegion.sunday'), value: 'sunday' },
          ]}
          value={region.weekStart}
          onValueChange={(value) => updateSetting(ctx, 'localeRegion', { weekStart: value })}
        />
        {/* numbersFollowLocale 产品固定：说明 + disabled（不渲染可关开关）。 */}
        <div className="rounded-panel border border-border bg-surface-muted p-4 text-sm text-ink-muted">
          {t('settings.localeRegion.numbersFollowLocale')}：
          {t('settings.localeRegion.numbersFollowLocaleFixed')}
        </div>
        <LocaleFeedback region={region} />
      </SectionShell>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 通知 Notifications                                                   */
/* ------------------------------------------------------------------ */

export function NotificationsSection({ ctx }: Readonly<{ ctx: Ctx }>) {
  const { t } = useFrontendTranslation();
  const n = ctx.prefs.notifications;
  return (
    <>
      <SectionShell title={t('settings.groups.delivery')}>
        {switchRow(
          ctx,
          'notifications',
          'inAppNotifications',
          n.inAppNotifications,
          t('settings.notifications.inAppNotifications'),
          '',
        )}
        {switchRow(
          ctx,
          'notifications',
          'unreadReminder',
          n.unreadReminder,
          t('settings.notifications.unreadReminder'),
          '',
        )}
        {switchRow(
          ctx,
          'notifications',
          'showBadge',
          n.showBadge,
          t('settings.notifications.showBadge'),
          '',
        )}
        {switchRow(ctx, 'notifications', 'sound', n.sound, t('settings.notifications.sound'), '')}
        {switchRow(
          ctx,
          'notifications',
          'desktopNotifications',
          n.desktopNotifications,
          t('settings.notifications.desktopNotifications'),
          '',
        )}
      </SectionShell>
      <SectionShell title={t('settings.groups.feedback')}>
        {switchRow(
          ctx,
          'notifications',
          'collectNonCriticalToCenter',
          n.collectNonCriticalToCenter,
          t('settings.notifications.collectNonCriticalToCenter'),
          '',
        )}
        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.notifications.toastDuration')}
          options={[
            { label: t('settings.notifications.toastShort'), value: 'short' },
            { label: t('settings.notifications.toastStandard'), value: 'standard' },
            { label: t('settings.notifications.toastLong'), value: 'long' },
          ]}
          value={n.toastDuration}
          onValueChange={(value) => updateSetting(ctx, 'notifications', { toastDuration: value })}
        />
        <NotificationFeedback duration={n.toastDuration} />
      </SectionShell>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 可访问性 Accessibility（自有增强项；动效/对比度/字号同义引用外观，不重复建开关） */
/* ------------------------------------------------------------------ */

export function AccessibilitySection({ ctx }: Readonly<{ ctx: Ctx }>) {
  const { t } = useFrontendTranslation();
  const a = ctx.prefs.accessibility;
  const appearance = ctx.prefs.appearance;
  const fontScaleLabel = {
    small: t('settings.appearance.fontSmall'),
    standard: t('settings.appearance.fontStandard'),
    large: t('settings.appearance.fontLarge'),
  }[appearance.fontScale];
  const motionLabel = {
    system: t('settings.appearance.motionSystem'),
    standard: t('settings.appearance.motionStandard'),
    reduced: t('settings.appearance.motionReduced'),
  }[appearance.motion];
  const contrastLabel = {
    system: t('settings.appearance.contrastSystem'),
    standard: t('settings.appearance.contrastStandard'),
    high: t('settings.appearance.contrastHigh'),
  }[appearance.contrast];
  return (
    <SectionShell title={t('settings.categories.accessibility')}>
      {/* 同义共享字段：外观的字号/动效/对比度在此统一查看（同一 preferences 字段）。 */}
      <div className="rounded-panel border border-border bg-surface-muted p-4">
        <p className="text-sm font-bold text-ink">{t('settings.accessibility.sharedTitle')}</p>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          {t('settings.accessibility.sharedDescription')}
        </p>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">{t('settings.accessibility.sharedFontScale')}</dt>
            <dd className="font-medium text-ink">{fontScaleLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">{t('settings.accessibility.sharedMotion')}</dt>
            <dd className="font-medium text-ink">{motionLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">{t('settings.accessibility.sharedContrast')}</dt>
            <dd className="font-medium text-ink">{contrastLabel}</dd>
          </div>
        </dl>
        <RouteLink
          target={route('settings')}
          className="mt-3 inline-flex min-h-control items-center font-semibold text-brand underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {t('settings.accessibility.goToAppearance')}
        </RouteLink>
      </div>
      {switchRow(
        ctx,
        'accessibility',
        'enhanceFocus',
        a.enhanceFocus,
        t('settings.accessibility.enhanceFocus'),
        '',
      )}
      {switchRow(
        ctx,
        'accessibility',
        'enhanceTargetSize',
        a.enhanceTargetSize,
        t('settings.accessibility.enhanceTargetSize'),
        '',
      )}
      {switchRow(
        ctx,
        'accessibility',
        'showKeyboardHints',
        a.showKeyboardHints,
        t('settings.accessibility.showKeyboardHints'),
        '',
      )}
      {switchRow(
        ctx,
        'accessibility',
        'followSystemAssistive',
        a.followSystemAssistive,
        t('settings.accessibility.followSystemAssistive'),
        '',
      )}
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 安全与隐私 Security（水印 / 空闲锁屏 / 立即锁定）                       */
/* ------------------------------------------------------------------ */

export function SecuritySection({ ctx }: Readonly<{ ctx: Ctx }>) {
  const { t } = useFrontendTranslation();
  const s = ctx.prefs.security;
  return (
    <>
      <SectionShell title={t('settings.groups.watermark')}>
        {switchRow(
          ctx,
          'security',
          'watermark',
          s.watermark,
          t('settings.security.watermark'),
          t('settings.security.watermarkDescription'),
        )}
        <TextField
          disabled={!s.watermark}
          hint={t(
            s.watermark
              ? 'settings.security.watermarkTextHint'
              : 'settings.security.watermarkTextDisabled',
          )}
          label={t('settings.security.watermarkText')}
          placeholder={t('settings.security.watermarkTextPlaceholder')}
          value={s.watermarkText}
          onChange={(event) =>
            updateSetting(ctx, 'security', { watermarkText: event.target.value.slice(0, 40) })
          }
        />
        <p className="text-xs text-ink-muted">
          {t('settings.security.watermarkCharacters', { count: s.watermarkText.length })}
        </p>
      </SectionShell>
      <SectionShell title={t('settings.groups.lock')}>
        <SelectField
          hint={t('settings.security.idleLockMinutesHint')}
          label={t('settings.security.idleLockMinutes')}
          options={IDLE_LOCK_MINUTES.map((minutes) => ({
            label:
              minutes === 0
                ? t('settings.security.idleLockOff')
                : t('settings.security.idleLockOption', { count: minutes }),
            value: String(minutes),
          }))}
          value={String(s.idleLockMinutes)}
          onValueChange={(value) =>
            updateSetting(ctx, 'security', { idleLockMinutes: Number(value) })
          }
        />
        {switchRow(
          ctx,
          'security',
          'lockOnHidden',
          s.lockOnHidden,
          t('settings.security.lockOnHidden'),
          t('settings.security.lockOnHiddenDescription'),
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Action
            leadingIcon={<LockKeyhole className="size-3.5" />}
            variant="secondary"
            onPress={() => {
              // Host 在 window 上监听 `clouddrive:lock` 并接管锁定/解锁流程；
              // 事件从 document 冒泡到 window（bubbles:true），浏览器预览不会真的遮挡页面。
              document.dispatchEvent(new CustomEvent('clouddrive:lock', { bubbles: true }));
            }}
          >
            {t('settings.security.lockNow')}
          </Action>
          <p className="min-w-0 flex-1 text-xs leading-5 text-ink-muted">
            {t('settings.security.lockNowHint')}
          </p>
        </div>
      </SectionShell>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 快捷键 Shortcuts                                                     */
/* ------------------------------------------------------------------ */

export function ShortcutsSection({ ctx }: Readonly<{ ctx: Ctx }>) {
  const { t } = useFrontendTranslation();
  const s = ctx.prefs.shortcuts;
  return (
    <SectionShell title={t('settings.categories.shortcuts')}>
      {switchRow(ctx, 'shortcuts', 'enabled', s.enabled, t('settings.shortcuts.enabled'), '')}
      {switchRow(ctx, 'shortcuts', 'showHints', s.showHints, t('settings.shortcuts.showHints'), '')}
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 操作偏好 Action preferences                                          */
/* ------------------------------------------------------------------ */

export function ActionPreferencesSection({ ctx }: Readonly<{ ctx: Ctx }>) {
  const { t } = useFrontendTranslation();
  const p = ctx.prefs.actionPreferences;
  return (
    <>
      <SectionShell title={t('settings.groups.destinations')}>
        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.actionPreferences.editSuccessDestination')}
          options={[
            { label: t('settings.actionPreferences.stay'), value: 'stay' },
            { label: t('settings.actionPreferences.list'), value: 'list' },
            { label: t('settings.actionPreferences.detail'), value: 'detail' },
          ]}
          value={p.editSuccessDestination}
          onValueChange={(value) =>
            updateSetting(ctx, 'actionPreferences', { editSuccessDestination: value })
          }
        />
        <RadioGroupField
          presentation="rows"
          hint=""
          label={t('settings.actionPreferences.createSuccessDestination')}
          options={[
            { label: t('settings.actionPreferences.list'), value: 'list' },
            { label: t('settings.actionPreferences.continueCreating'), value: 'continue' },
            {
              description: t('settings.actionPreferences.detailNotApplicableHint'),
              label: t('settings.actionPreferences.detail'),
              value: 'detail',
            },
          ]}
          value={p.createSuccessDestination}
          onValueChange={(value) =>
            updateSetting(ctx, 'actionPreferences', {
              createSuccessDestination: value,
            })
          }
        />
      </SectionShell>
      <SectionShell title={t('settings.groups.protection')}>
        {switchRow(
          ctx,
          'actionPreferences',
          'autosaveDrafts',
          p.autosaveDrafts,
          t('settings.actionPreferences.autosaveDrafts'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'confirmLeave',
          p.confirmLeave,
          t('settings.actionPreferences.confirmLeave'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'confirmReset',
          p.confirmReset,
          t('settings.actionPreferences.confirmReset'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'confirmDelete',
          p.confirmDelete,
          t('settings.actionPreferences.confirmDelete'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'confirmBulk',
          p.confirmBulk,
          t('settings.actionPreferences.confirmBulk'),
          '',
        )}
      </SectionShell>
      <SectionShell title={t('settings.groups.guidance')}>
        {switchRow(
          ctx,
          'actionPreferences',
          'focusFirstField',
          p.focusFirstField,
          t('settings.actionPreferences.focusFirstField'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'focusFirstError',
          p.focusFirstError,
          t('settings.actionPreferences.focusFirstError'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'copyFeedback',
          p.copyFeedback,
          t('settings.actionPreferences.copyFeedback'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'expandDetailInfo',
          p.expandDetailInfo,
          t('settings.actionPreferences.expandDetailInfo'),
          '',
        )}
        <RadioGroupField
          presentation="inline"
          hint={t('settings.actionPreferences.detailModeHint')}
          label={t('settings.actionPreferences.detailMode')}
          options={[
            { label: t('settings.actionPreferences.detailCompact'), value: 'compact' },
            { label: t('settings.actionPreferences.detailFull'), value: 'full' },
          ]}
          value={p.detailMode}
          onValueChange={(value) => updateSetting(ctx, 'actionPreferences', { detailMode: value })}
        />
      </SectionShell>
      <SectionShell title={t('settings.groups.search')}>
        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.actionPreferences.refreshMode')}
          options={[
            { label: t('settings.actionPreferences.refreshOff'), value: 'off' },
            { label: t('settings.actionPreferences.refreshOnEnter'), value: 'on-enter' },
            { label: t('settings.actionPreferences.refreshPeriodic'), value: 'periodic' },
          ]}
          value={p.refreshMode}
          onValueChange={(value) => updateSetting(ctx, 'actionPreferences', { refreshMode: value })}
        />
        <RadioGroupField
          presentation="inline"
          hint=""
          label={t('settings.actionPreferences.searchTrigger')}
          options={[
            { label: t('settings.actionPreferences.searchAuto'), value: 'auto' },
            { label: t('settings.actionPreferences.searchEnter'), value: 'enter' },
          ]}
          value={p.searchTrigger}
          onValueChange={(value) =>
            updateSetting(ctx, 'actionPreferences', { searchTrigger: value })
          }
        />
        {switchRow(
          ctx,
          'actionPreferences',
          'rememberSearchHistory',
          p.rememberSearchHistory,
          t('settings.actionPreferences.rememberSearchHistory'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'showSearchHistory',
          p.showSearchHistory,
          t('settings.actionPreferences.showSearchHistory'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'showSearchSuggestions',
          p.showSearchSuggestions,
          t('settings.actionPreferences.showSearchSuggestions'),
          '',
        )}
        {switchRow(
          ctx,
          'actionPreferences',
          'keepLastSearchPerPage',
          p.keepLastSearchPerPage,
          t('settings.actionPreferences.keepLastSearchPerPage'),
          '',
        )}
      </SectionShell>
    </>
  );
}
