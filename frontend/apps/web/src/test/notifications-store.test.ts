import { beforeEach, describe, expect, it } from 'vitest';
import type { NotificationItem } from '@clouddrive/plugin-framework/notifications';

import { NOTIFICATIONS_LIMIT, useNotificationsStore } from '../state/use-notifications-store';
import { createHostNotificationsPort } from '../host/notifications-port';

function base(): Readonly<Omit<NotificationItem, 'id' | 'createdAt' | 'read'>> {
  return { category: 'success', severity: 'info', title: '保存成功' };
}

describe('useNotificationsStore（通知中心，SET-006-005）', () => {
  beforeEach(() => {
    useNotificationsStore.setState({ items: [] });
  });

  it('publish 前置新通知并返回 id', () => {
    const store = useNotificationsStore.getState();
    const id = store.publish({ ...base(), title: 'A' });
    const items = useNotificationsStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(id);
    expect(items[0]?.title).toBe('A');
    expect(items[0]?.read).toBe(false);
  });

  it('markRead / markAllRead 更新已读', () => {
    const store = useNotificationsStore.getState();
    const idA = store.publish({ ...base(), title: 'A' });
    store.publish({ ...base(), title: 'B' });
    useNotificationsStore.getState().markRead(idA);
    const items = useNotificationsStore.getState().items;
    expect(items.find((i) => i.id === idA)?.read).toBe(true);
    expect(items.find((i) => i.title === 'B')?.read).toBe(false);
    useNotificationsStore.getState().markAllRead();
    expect(useNotificationsStore.getState().items.every((i) => i.read)).toBe(true);
  });

  it('上限截断（最旧被淘汰）', () => {
    const store = useNotificationsStore.getState();
    for (let i = 0; i < NOTIFICATIONS_LIMIT + 10; i += 1) {
      store.publish({ ...base(), title: `N${i}` });
    }
    const items = useNotificationsStore.getState().items;
    expect(items).toHaveLength(NOTIFICATIONS_LIMIT);
    expect(items[0]?.title).toBe(`N${NOTIFICATIONS_LIMIT + 9}`); // 最新在前
    expect(items.some((i) => i.title === 'N0')).toBe(false);
  });
});

describe('createHostNotificationsPort（Notifications Port 实现）', () => {
  beforeEach(() => {
    useNotificationsStore.setState({ items: [] });
  });

  it('publish/list/unreadCount/subscribe/markRead 全链路', () => {
    const port = createHostNotificationsPort();
    const seen: number[] = [];
    const unsub = port.subscribe(() => seen.push(1));

    const id = port.publish({ ...base(), title: '保存成功' });
    expect(port.list()).toHaveLength(1);
    expect(port.unreadCount()).toBe(1);
    expect(seen).toHaveLength(1);

    port.markRead(id);
    expect(port.unreadCount()).toBe(0);
    expect(seen).toHaveLength(2);

    port.markAllRead();
    expect(port.unreadCount()).toBe(0);
    unsub();
    port.publish({ ...base(), title: 'X' });
    expect(seen).toHaveLength(3); // 退订后不再通知（保持 3 次）
  });
});
