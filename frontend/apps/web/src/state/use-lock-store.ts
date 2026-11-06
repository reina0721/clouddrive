import { createPersistStore, createSessionStorage } from '@clouddrive/state-foundation';

/**
 * 锁屏状态（Host 拥有，会话级持久化）。
 *
 * - `locked` 只影响当前浏览器标签页的会话（sessionStorage）：刷新仍需解锁，
 *   新标签页不会继承锁定，避免把"演示锁屏"伪装成账号安全策略；
 * - `userId` 用于账号切换后丢弃上一账号的锁定状态；
 * - 业务状态与数据不因此改变；真实部署由当前会话复核密码，共享服务端失败预算。
 */
export type LockReason = 'manual' | 'idle' | 'hidden';

type LockState = Readonly<{
  locked: boolean;
  lockedAt: number | null;
  reason: LockReason | null;
  userId: string | null;
  lock: (userId: string, reason: LockReason) => void;
  unlock: () => void;
}>;

export const useLockStore = createPersistStore<
  LockState,
  { locked: boolean; lockedAt: number | null; reason: LockReason | null; userId: string | null }
>(
  (set) => ({
    locked: false,
    lockedAt: null,
    reason: null,
    userId: null,
    lock: (userId, reason) => set({ locked: true, lockedAt: Date.now(), reason, userId }),
    unlock: () => set({ locked: false, lockedAt: null, reason: null, userId: null }),
  }),
  {
    name: 'clouddrive.lock',
    version: 1,
    skipHydration: false,
    storage: createSessionStorage(),
    partialize: ({ locked, lockedAt, reason, userId }) => ({
      locked,
      lockedAt,
      reason,
      userId,
    }),
  },
);
