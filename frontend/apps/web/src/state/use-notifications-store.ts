import { createPersistStore, createLocalStorage } from '@clouddrive/state-foundation';
import type { NotificationItem } from '@clouddrive/plugin-framework/notifications';

/**
 * Notifications Store（Host 拥有）—— 通知中心（SET-006-005）。
 *
 * - 独立 Store（key `clouddrive.notifications`），收纳**真实前端事件**（表单保存
 *   成功/失败、任务完成等），不预填虚构通知；
 * - 持久化内容可序列化（无函数；跳转存 Route Target 形状）；
 * - 未读计数/角标由调用方计算（store 不存派生值）；上限固定（防无限增长）；
 * - 高风险/错误收纳不受通知偏好关闭影响（产品强制，由发布方保证）。
 */
export const NOTIFICATIONS_LIMIT = 50;

type NotificationsState = {
  items: readonly NotificationItem[];
  publish: (input: Readonly<Omit<NotificationItem, 'id' | 'createdAt' | 'read'>>) => string;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

type NotificationsPersisted = {
  items: readonly NotificationItem[];
};

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `notification-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export const useNotificationsStore = createPersistStore<NotificationsState, NotificationsPersisted>(
  (set) => ({
    items: [],
    publish: (input) => {
      const id = nextId();
      const item: NotificationItem = {
        ...input,
        id,
        createdAt: Date.now(),
        read: false,
      };
      set((state) => ({
        items: [item, ...state.items].slice(0, NOTIFICATIONS_LIMIT),
      }));
      return id;
    },
    markRead: (id) =>
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
      })),
    markAllRead: () =>
      set((state) => ({
        items: state.items.map((item) => ({ ...item, read: true })),
      })),
  }),
  {
    name: 'clouddrive.notifications',
    version: 1,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ items }) => ({ items }),
    migrate: (persisted) => {
      if (typeof persisted !== 'object' || persisted === null) {
        throw new Error('notifications: 记录损坏');
      }
      const record = persisted as Partial<NotificationsPersisted>;
      const items = Array.isArray(record.items)
        ? (record.items as readonly NotificationItem[]).filter(
            (item) =>
              item &&
              typeof item.id === 'string' &&
              typeof item.title === 'string' &&
              typeof item.createdAt === 'number' &&
              typeof item.read === 'boolean' &&
              typeof item.category === 'string',
          )
        : [];
      return { items };
    },
  },
);
