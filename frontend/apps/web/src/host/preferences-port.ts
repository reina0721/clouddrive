/**
 * Host —— Preferences Port 实现（composition root 装配）。
 *
 * 把 `@clouddrive/plugin-framework/preferences` 的 `PreferencesPort<Preferences>`
 * 契约落到 Host Shell store（`clouddrive.shell` v1，八分类偏好）。Plugin（settings）
 * 与 Shell 经本 Port 读写同一份偏好，禁止跨 Plugin 直接 import store。
 *
 * 失败语义（SET-003-005）：
 * - 更新/恢复动作先改内存（会话效果保留），再经 zustand persist 同步写 localStorage；
 *   写入抛错（quota/安全/存储不可用）→ 返回可判断失败码，不静默宣称成功；
 * - 跨窗口同步：监听 `storage` 事件，读到同 key 的**完整快照**后校验并应用
 *   （“最后成功写入的完整快照收敛”）；页签活动状态保持当前窗口独立；损坏快照忽略，
 *   不静默覆盖本窗口会话。
 */
import type {
  PreferencesPort,
  PersistFailureCode,
  PersistResult,
} from '@clouddrive/plugin-framework/preferences';
import {
  validatePreferences,
  PREFERENCES_VERSION,
  type Preferences,
} from '@clouddrive/surface/preferences-model';

import { useShellStore } from '../state/use-shell-store';

const PERSIST_KEY = 'clouddrive.shell';

function classifyStorageError(error: unknown): PersistFailureCode {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota';
  if (name === 'SecurityError') return 'storage-unavailable';
  return 'write-failed';
}

/** 从 storage 事件携带的原始字符串解析完整 v1 快照；非法/损坏返回 null。 */
function parseStoredSnapshot(raw: string | null): Preferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: { preferences?: unknown } };
    const preferences = parsed.state?.preferences;
    if (preferences === undefined || typeof preferences !== 'object' || preferences === null) {
      return null;
    }
    // 完整快照必须含全部九分类（partialize 写全量）；缺分类视为损坏，不静默覆盖。
    const required = [
      'appearance',
      'navigation',
      'dataDisplay',
      'actionPreferences',
      'localeRegion',
      'notifications',
      'accessibility',
      'security',
      'shortcuts',
    ] as const;
    const record = preferences as Record<string, unknown>;
    if (required.some((category) => !(category in record))) return null;
    const result = validatePreferences(preferences);
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

function toPersistResult(fn: () => void): PersistResult {
  try {
    fn();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: classifyStorageError(error),
      reason: String((error as Error)?.message ?? error),
    };
  }
}

/**
 * 显式持久化当前偏好完整快照（v1 envelope）。zustand persist 的写入经 toThenable
 * catch 吞错（quota/安全错误不向上抛），因此 Port 在内存变更后**显式**写一次
 * localStorage 以取得真实失败语义（SET-003-005：不静默宣称保存成功）；zustand 的
 * 后续同值写入无害。成功后返回 true，失败抛错由 toPersistResult 归类。
 */
function persistSnapshot(): void {
  const preferences = useShellStore.getState().preferences;
  const envelope = JSON.stringify({ state: { preferences }, version: PREFERENCES_VERSION });
  window.localStorage.setItem(PERSIST_KEY, envelope);
}

/** 创建 Preferences Port（Host composition root 单次调用）。 */
export function createHostPreferencesPort(): PreferencesPort<Preferences> & {
  /** 订阅底层 store（zustand）；返回取消函数。 */
  subscribeStore: (listener: () => void) => () => void;
  /** 跨窗口 storage 事件监听启动/停止（返回停止函数）。 */
  startCrossWindowSync: () => () => void;
} {
  const port: PreferencesPort<Preferences> = {
    getSnapshot: () => useShellStore.getState().preferences,
    subscribe: (listener) => useShellStore.subscribe(listener),
    updateCategory: (category, patch) =>
      toPersistResult(() => {
        useShellStore.getState().updateCategory(category, patch);
        persistSnapshot();
      }),
    resetCategory: (category) =>
      toPersistResult(() => {
        useShellStore.getState().resetCategory(category);
        persistSnapshot();
      }),
    resetAll: () =>
      toPersistResult(() => {
        useShellStore.getState().resetAll();
        persistSnapshot();
      }),
  };

  const subscribeStore = (listener: () => void) => useShellStore.subscribe(listener);

  /** 跨窗口：另一 tab 写入完整快照后，本窗口校验并应用（不静默覆盖损坏/不完整快照）。 */
  function startCrossWindowSync(): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PERSIST_KEY || event.storageArea !== window.localStorage) return;
      const incoming = parseStoredSnapshot(event.newValue);
      if (!incoming) return; // 损坏/不完整 → 忽略，保留本窗口会话
      const current = useShellStore.getState();
      if (JSON.stringify(current.preferences) === JSON.stringify(incoming)) return; // no-op
      // 应用完整快照并同步兼容投影（setState 触发 persist 回写；storage 事件不在本 tab
      // 触发，不会循环）。
      useShellStore.getState().applyPersistedPreferences(incoming);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }

  return { ...port, subscribeStore, startCrossWindowSync };
}
