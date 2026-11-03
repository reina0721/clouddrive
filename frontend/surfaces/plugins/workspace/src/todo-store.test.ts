// @vitest-environment jsdom
import { rehydrateStore } from '@clouddrive/state-foundation';
import { beforeEach, describe, expect, it } from 'vitest';

import { useWorkspaceTodoStore, WORKSPACE_TODO_STORAGE_KEY } from '../stores/todo-store';
import { parseTodoPersisted } from './todo-store-schema';
import { WORKSPACE_TODO_IDS } from './workspace-data';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe('todo store（plugin-scoped persist）', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useWorkspaceTodoStore.setState({ completedIds: [], warning: null });
  });

  it('toggle / reset 更新完成集合，并按白名单写入 storage', () => {
    useWorkspaceTodoStore.getState().toggleTodo('review-access');
    useWorkspaceTodoStore.getState().toggleTodo('sync-metrics');
    expect(useWorkspaceTodoStore.getState().completedIds).toEqual([
      'review-access',
      'sync-metrics',
    ]);

    useWorkspaceTodoStore.getState().toggleTodo('review-access');
    expect(useWorkspaceTodoStore.getState().completedIds).toEqual(['sync-metrics']);

    const raw = window.localStorage.getItem(WORKSPACE_TODO_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw ?? '{}') as {
      state?: { completedIds?: readonly string[] };
      version?: number;
    };
    expect(stored.version).toBe(1);
    expect(stored.state).toEqual({ completedIds: ['sync-metrics'] });

    useWorkspaceTodoStore.getState().resetTodos();
    expect(useWorkspaceTodoStore.getState().completedIds).toEqual([]);
  });

  it('未知 todo id 不进入完成集合', () => {
    useWorkspaceTodoStore.getState().toggleTodo('not-a-demo-todo');
    expect(useWorkspaceTodoStore.getState().completedIds).toEqual([]);
  });

  it('损坏记录 → 默认值 + 非阻塞 warning，且不覆盖原记录', async () => {
    const corrupt = JSON.stringify({ state: { completedIds: 'broken' }, version: 1 });
    window.localStorage.setItem(WORKSPACE_TODO_STORAGE_KEY, corrupt);

    rehydrateStore(useWorkspaceTodoStore);
    await wait(40);

    const state = useWorkspaceTodoStore.getState();
    expect(state.completedIds).toEqual([]);
    expect(state.warning).toBe('invalid-record');
    // 原记录保留：只有用户下一次主动变更才会写回。
    expect(window.localStorage.getItem(WORKSPACE_TODO_STORAGE_KEY)).toBe(corrupt);
  });
});

describe('parseTodoPersisted（存储边界校验）', () => {
  it('拒绝非法结构', () => {
    expect(parseTodoPersisted(undefined, WORKSPACE_TODO_IDS)).toEqual({ ok: false });
    expect(parseTodoPersisted(null, WORKSPACE_TODO_IDS)).toEqual({ ok: false });
    expect(parseTodoPersisted([], WORKSPACE_TODO_IDS)).toEqual({ ok: false });
    expect(parseTodoPersisted({}, WORKSPACE_TODO_IDS)).toEqual({ ok: false });
    expect(parseTodoPersisted({ completedIds: 'x' }, WORKSPACE_TODO_IDS)).toEqual({ ok: false });
    expect(parseTodoPersisted({ completedIds: [1] }, WORKSPACE_TODO_IDS)).toEqual({ ok: false });
  });

  it('去重、丢弃未知条目并报告 unknownIds', () => {
    expect(
      parseTodoPersisted(
        { completedIds: ['review-access', 'review-access', 'retired-todo', 'sync-metrics'] },
        WORKSPACE_TODO_IDS,
      ),
    ).toEqual({
      ok: true,
      completedIds: ['review-access', 'sync-metrics'],
      unknownIds: ['retired-todo'],
    });
  });

  it('全部合法时没有 unknownIds', () => {
    expect(parseTodoPersisted({ completedIds: ['publish-release'] }, WORKSPACE_TODO_IDS)).toEqual({
      ok: true,
      completedIds: ['publish-release'],
      unknownIds: [],
    });
  });
});
