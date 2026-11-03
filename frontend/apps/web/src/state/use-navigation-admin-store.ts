import { createLocalStorage, createPersistStore } from '@clouddrive/state-foundation';

/**
 * Host —— 导航业务覆盖 store（菜单管理持久化真相）。
 *
 * 归属与边界：
 * - 部署期 Plugin Registry（codegen 产物）决定路由与导航的**存在性**，运行期只读；
 * - 本 store 只保存业务呈现覆盖：可见性、标题、排序、所需权限码；不新增路由、
 *   不改变授权真相（后端/数据服务仍是授权边界）；
 * - 菜单管理 Plugin 经 `@clouddrive/plugin-framework/navigation-admin` Port 读写，
 *   Shell 经 `useProductNavigation` 应用同一份数据 —— 单一持久化真相；
 * - key `clouddrive.navigation-admin` v1，损坏记录拒绝静默覆盖（页面呈现恢复动作）。
 */

export const NAVIGATION_ADMIN_KEY = 'clouddrive.navigation-admin';
export const NAVIGATION_ADMIN_VERSION = 1;

export type NavigationOverride = Readonly<{
  parentId?: string;
  hidden?: boolean;
  label?: string;
  order?: number;
  permission?: string | null;
  version: number;
}>;

export type NavigationOverrides = Readonly<Record<string, NavigationOverride>>;

export type NavigationOverridePatch = Readonly<{
  hidden?: boolean;
  label?: string;
  order?: number;
  permission?: string | null;
}>;

export type NavigationAdminFailureCode = 'conflict' | 'invalid';

export type NavigationAdminResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: NavigationAdminFailureCode; reason: string }>;

export type NavigationAdminState = {
  overrides: NavigationOverrides;
  updatedAt: number | null;
  corrupt: boolean;
  update: (
    navigationId: string,
    patch: NavigationOverridePatch,
    expectedVersion: number,
  ) => NavigationAdminResult;
  resetPresentation: (navigationId: string, expectedVersion: number) => NavigationAdminResult;
  clear: (navigationId: string, expectedVersion: number) => NavigationAdminResult;
  clearAll: () => NavigationAdminResult;
  markRecovered: () => void;
};

/** 覆盖记录的字段校验（与菜单管理 UI 同一规则；非法值不写入）。 */
export const NAVIGATION_LABEL_MIN = 1;
export const NAVIGATION_LABEL_MAX = 40;
export const NAVIGATION_ORDER_MIN = 0;
export const NAVIGATION_ORDER_MAX = 999;
export const NAVIGATION_PERMISSION_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;

function validatePatch(patch: NavigationOverridePatch): NavigationAdminResult | null {
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (label.length < NAVIGATION_LABEL_MIN || label.length > NAVIGATION_LABEL_MAX)
      return { ok: false, code: 'invalid', reason: 'label' };
  }
  if (patch.order !== undefined) {
    if (
      !Number.isInteger(patch.order) ||
      patch.order < NAVIGATION_ORDER_MIN ||
      patch.order > NAVIGATION_ORDER_MAX
    )
      return { ok: false, code: 'invalid', reason: 'order' };
  }
  if (patch.permission !== undefined && patch.permission !== null && patch.permission !== '') {
    if (!NAVIGATION_PERMISSION_PATTERN.test(patch.permission))
      return { ok: false, code: 'invalid', reason: 'permission' };
  }
  return null;
}

function applyPatch(current: NavigationOverride | undefined, patch: NavigationOverridePatch) {
  const next: { -readonly [K in keyof NavigationOverride]: NavigationOverride[K] } = {
    ...(current ?? { version: 0 }),
  };
  if (patch.hidden !== undefined) {
    if (patch.hidden) next.hidden = true;
    else delete next.hidden;
  }
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (label) next.label = label;
    else delete next.label;
  }
  if (patch.order !== undefined) next.order = patch.order;
  if (patch.permission !== undefined) {
    if (patch.permission === null || patch.permission === '') delete next.permission;
    else next.permission = patch.permission;
  }
  next.version = (current?.version ?? 0) + 1;
  return next;
}

function parseOverrides(value: unknown): NavigationOverrides | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  const parsed: Record<string, NavigationOverride> = {};
  for (const [id, raw] of entries) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const version = record.version;
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null;
    const entry: { -readonly [K in keyof NavigationOverride]: NavigationOverride[K] } = { version };
    if (record.hidden !== undefined && typeof record.hidden !== 'boolean') return null;
    if (record.hidden === true) entry.hidden = true;
    if (record.label !== undefined) {
      if (typeof record.label !== 'string') return null;
      const label = record.label.trim();
      if (!label || label.length > NAVIGATION_LABEL_MAX) return null;
      entry.label = label;
    }
    if (record.order !== undefined) {
      if (typeof record.order !== 'number' || !Number.isInteger(record.order)) return null;
      if (record.order < NAVIGATION_ORDER_MIN || record.order > NAVIGATION_ORDER_MAX) return null;
      entry.order = record.order;
    }
    if (record.permission !== undefined && record.permission !== null) {
      if (typeof record.permission !== 'string') return null;
      if (!NAVIGATION_PERMISSION_PATTERN.test(record.permission)) return null;
      entry.permission = record.permission;
    }
    parsed[id] = entry;
  }
  return parsed;
}

export const useNavigationAdminStore = createPersistStore<
  NavigationAdminState,
  { overrides: NavigationOverrides; updatedAt: number | null }
>(
  (set, get) => {
    const guard = (navigationId: string, expectedVersion: number): NavigationAdminResult | null => {
      const current = get().overrides[navigationId];
      return (current?.version ?? 0) === expectedVersion
        ? null
        : { ok: false, code: 'conflict', reason: 'version' };
    };
    return {
      overrides: {},
      updatedAt: null,
      corrupt: false,
      update: (navigationId, patch, expectedVersion) => {
        const invalid = validatePatch(patch);
        if (invalid) return invalid;
        const conflict = guard(navigationId, expectedVersion);
        if (conflict) return conflict;
        set({
          overrides: {
            ...get().overrides,
            [navigationId]: applyPatch(get().overrides[navigationId], patch),
          },
          updatedAt: Date.now(),
        });
        return { ok: true };
      },
      resetPresentation: (navigationId, expectedVersion) => {
        const conflict = guard(navigationId, expectedVersion);
        if (conflict) return conflict;
        const current = get().overrides[navigationId];
        if (!current) return { ok: true };
        // 只保留并发版本号，清除全部呈现覆盖字段（标题/排序/可见性/权限）。
        set({
          overrides: { ...get().overrides, [navigationId]: { version: current.version + 1 } },
          updatedAt: Date.now(),
        });
        return { ok: true };
      },
      clear: (navigationId, expectedVersion) => {
        const conflict = guard(navigationId, expectedVersion);
        if (conflict) return conflict;
        const next = Object.fromEntries(
          Object.entries(get().overrides).filter(([key]) => key !== navigationId),
        );
        set({ overrides: next, updatedAt: Date.now() });
        return { ok: true };
      },
      clearAll: () => {
        set({ overrides: {}, updatedAt: Date.now() });
        return { ok: true };
      },
      markRecovered: () => set({ corrupt: false }),
    };
  },
  {
    name: NAVIGATION_ADMIN_KEY,
    version: NAVIGATION_ADMIN_VERSION,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ overrides, updatedAt }) => ({ overrides, updatedAt }),
    migrate: (persisted) => {
      if (persisted === undefined) return { overrides: {}, updatedAt: null };
      if (persisted === null || typeof persisted !== 'object')
        throw new Error('navigation-admin: corrupt');
      const record = persisted as Record<string, unknown>;
      const overrides = parseOverrides(record.overrides ?? {});
      if (overrides === null) throw new Error('navigation-admin: corrupt');
      const updatedAt = typeof record.updatedAt === 'number' ? record.updatedAt : null;
      return { overrides, updatedAt };
    },
    merge: (persisted, current) => {
      if (persisted === undefined) return current;
      const typed = persisted as { overrides?: unknown; updatedAt?: number | null };
      const overrides = parseOverrides(typed.overrides ?? {});
      if (overrides === null) return current;
      return { ...current, overrides, updatedAt: typed.updatedAt ?? null };
    },
    onRehydrateStorage: () => (_state, error) => {
      if (error) {
        useNavigationAdminStore.setState({ corrupt: true, overrides: {}, updatedAt: null });
      }
    },
  },
);
