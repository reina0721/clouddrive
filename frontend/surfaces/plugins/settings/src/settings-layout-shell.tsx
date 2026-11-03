'use client';

/**
 * settings —— 设置内页 Shell（SET-011：持久化布局壳）。
 *
 * - `SETTINGS_CATEGORIES`：单一映射表（shortId/routeId/模型 key/label/iconId/分组）。
 * - `SettingsShellContext`：layout 一次性装配的偏好 ctx 与失败横幅，下传各分类 page
 *   （page 只渲染分类区段，不重复订阅/装配——切换分类仅换右侧内容，壳不重挂载）。
 * - `SettingsSidebar`：SettingsLayout 左栏（固定顶部搜索 + 分组分类导航，含语义
 *   NavigationIcon 与 active 高亮）。
 * - `useSettingsPersistReport`：统一持久化失败呈现（reportingPort + notSaved + 重试）。
 */
import { useEffect, useState, type ReactNode } from 'react';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { type PersistResult } from '@clouddrive/plugin-framework/preferences';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import { NavigationIcon } from '@clouddrive/surface/icon-presentation';
import { PageHeader } from '@clouddrive/surface-foundation/layout';
import { DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { Action } from '@clouddrive/ui-adapter/action';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';

import type { Ctx } from './category-sections';
import { SettingsShellContext } from './settings-context';
import {
  SETTINGS_CATEGORIES,
  SETTINGS_NAV_GROUPS,
  type SettingsCategoryMeta,
} from './settings-categories';
import { RestoreAllButton, RestoreCategoryButton } from './restore-defaults';
import { PreferencesTransferPanel } from './preferences-transfer-panel';
import { normalizeSearchTerm, searchSettings } from './settings-index';

/* ------------------------------------------------------------------ */
/* 偏好订阅 + 持久化失败统一呈现                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 壳 Context：layout 一次性装配，page 消费                                */
/* ------------------------------------------------------------------ */

export type SettingsShellValue = Ctx;

/** layout 安装壳 ctx 供分类 page 消费（page 内 useSettingsShell() 取用）。 */
export function SettingsShellProvider({
  ctx,
  children,
}: Readonly<{ ctx: Ctx; children: ReactNode }>) {
  return <SettingsShellContext.Provider value={ctx}>{children}</SettingsShellContext.Provider>;
}

/* ------------------------------------------------------------------ */
/* 跨目录搜索                                                            */
/* ------------------------------------------------------------------ */

/** 跨目录设置搜索（固定在侧边栏顶部；命中跳对应分类页）。 */
export function SettingsSearch({
  onNavigate,
  query,
  onQueryChange,
}: Readonly<{ onNavigate?: () => void; query?: string; onQueryChange?: (value: string) => void }>) {
  const { t } = useFrontendTranslation();
  const [internalQuery, setInternalQuery] = useState('');
  const searchQuery = query ?? internalQuery;
  const setSearchQuery = onQueryChange ?? setInternalQuery;
  const resolveEntryText = (key: string) => {
    const resolved = t(key);
    return typeof resolved === 'string' ? resolved : key;
  };
  const searchResults = searchSettings(searchQuery, resolveEntryText);
  const searching = normalizeSearchTerm(searchQuery) !== '';

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2">
      <SearchBox
        label={t('settings.searchLabel')}
        placeholder={t('settings.searchPlaceholder')}
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      {searching ? (
        <Action variant="quiet" size="sm" onPress={() => setSearchQuery('')}>
          {t('settings.searchClear')}
        </Action>
      ) : null}
      {searching ? (
        <div className="grid gap-1">
          {searchResults.entries.length === 0 ? (
            <p className="px-1 text-xs leading-5 text-ink-muted">
              {t('settings.searchEmpty')} · {t('settings.searchNoResultsDescription')}
            </p>
          ) : (
            searchResults.entries.map((entry) => {
              const meta = SETTINGS_CATEGORIES.find((item) => item.categoryKey === entry.category);
              if (!meta) return null;
              return (
                <RouteLink
                  ariaLabel={t(entry.nameKey)}
                  className="flex w-full items-center justify-between gap-2 rounded-control px-2.5 py-2 text-start text-sm outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus-ring"
                  key={`${entry.category}.${entry.fieldId}`}
                  target={route(
                    meta.targetRouteId,
                    {},
                    { fragment: `settings-${entry.category}-${entry.fieldId}` },
                  )}
                  {...(onNavigate ? { onNavigate } : {})}
                >
                  <span className="min-w-0 truncate font-medium text-ink">{t(entry.nameKey)}</span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {t(entry.categoryLabelKey)}
                  </span>
                </RouteLink>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 侧边栏（搜索顶部 + 分组分类导航）                                      */
/* ------------------------------------------------------------------ */

/** 分类导航项（含语义 Icon + active 高亮；沿用主导航 leaf 视觉规律）。 */
function NavItem({
  meta,
  active,
  onNavigate,
}: Readonly<{ meta: SettingsCategoryMeta; onNavigate?: () => void; active: string }>) {
  const { t } = useFrontendTranslation();
  const isActive = active === meta.categoryKey;
  return (
    <RouteLink
      ariaLabel={t(meta.labelKey)}
      className={`flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring ${
        isActive
          ? 'bg-brand-soft/60 font-semibold text-brand'
          : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
      }`}
      target={route(meta.targetRouteId)}
      {...(onNavigate ? { onNavigate } : {})}
    >
      <NavigationIcon
        className={isActive ? 'size-4 shrink-0' : 'size-4 shrink-0'}
        iconId={meta.iconId}
      />
      <span className="min-w-0 truncate">{t(meta.labelKey)}</span>
    </RouteLink>
  );
}

/** SettingsLayout 左栏：固定顶部搜索 + 分组分类导航。 */
export function SettingsSidebar({
  active,
  onNavigate,
  query,
  onQueryChange,
  embedded = false,
}: Readonly<{
  active: string;
  onNavigate?: () => void;
  query?: string;
  onQueryChange?: (value: string) => void;
  embedded?: boolean;
}>) {
  const { t } = useFrontendTranslation();
  return (
    <Panel appearance={embedded ? 'embedded' : 'outlined'} className="p-3">
      <SettingsSearch
        {...(onNavigate ? { onNavigate } : {})}
        {...(query !== undefined ? { query } : {})}
        {...(onQueryChange ? { onQueryChange } : {})}
      />
      <nav aria-label={t('settings.navLabel')} className="mt-4 grid gap-4">
        {SETTINGS_NAV_GROUPS.map((groupMeta) => (
          <div className="grid gap-0.5" key={groupMeta.group}>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t(groupMeta.labelKey)}
            </p>
            {SETTINGS_CATEGORIES.filter((meta) => meta.group === groupMeta.group).map((meta) => (
              <NavItem
                active={active}
                key={meta.shortId}
                meta={meta}
                {...(onNavigate ? { onNavigate } : {})}
              />
            ))}
          </div>
        ))}
      </nav>
    </Panel>
  );
}

/** 内容区 wrapper（分类区段 + 失败横幅）。 */
export function SettingsContentFrame({
  banner,
  children,
}: Readonly<{ banner?: ReactNode; children: ReactNode }>) {
  return (
    <div className="min-w-0 space-y-5">
      {banner}
      {children}
    </div>
  );
}

export function SettingsResponsiveNavigation({ meta }: Readonly<{ meta: SettingsCategoryMeta }>) {
  const { t } = useFrontendTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const closeOnDesktop = () => {
      if (globalThis.innerWidth >= 1280) setOpen(false);
    };
    globalThis.addEventListener('resize', closeOnDesktop);
    return () => globalThis.removeEventListener('resize', closeOnDesktop);
  }, []);
  return (
    <>
      <div className="hidden xl:block">
        <SettingsSidebar active={meta.categoryKey} query={query} onQueryChange={setQuery} />
      </div>
      <div className="xl:hidden">
        <Action fullWidth variant="secondary" onPress={() => setOpen(true)}>
          {t('settings.switchCategory')}
        </Action>
        <DrawerSurface
          triggerLabel={t('settings.switchCategory')}
          title={t('settings.navLabel')}
          description={t('settings.searchResultHint')}
          closeLabel={t('settings.closeCategories')}
          isOpen={open}
          onOpenChange={setOpen}
        >
          <SettingsSidebar
            embedded
            active={meta.categoryKey}
            query={query}
            onQueryChange={setQuery}
            onNavigate={() => setOpen(false)}
          />
        </DrawerSurface>
      </div>
    </>
  );
}

export function SettingsCategoryHeader({ meta }: Readonly<{ meta: SettingsCategoryMeta }>) {
  const { t } = useFrontendTranslation();
  return (
    <PageHeader
      eyebrow={t('settings.eyebrow')}
      title={t(meta.labelKey)}
      description={t('settings.categoryDescription', {
        scope: t(`settings.categoryIntro.${meta.shortId}`),
      })}
    />
  );
}

export function SettingsRestoreActions({
  meta,
  onResult,
}: Readonly<{ meta: SettingsCategoryMeta; onResult: (result: PersistResult) => void }>) {
  const { t } = useFrontendTranslation();
  return (
    <div className="grid gap-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <RestoreCategoryButton
          category={meta.categoryKey}
          categoryLabel={t(meta.labelKey)}
          onResult={onResult}
        />
        <RestoreAllButton onResult={onResult} />
      </div>
      {/* 配置输出/导入：分类页脚常驻，保存与恢复之外提供可携带的配置。 */}
      <PreferencesTransferPanel onResult={onResult} />
    </div>
  );
}
