// @vitest-environment jsdom
import { parseColumnLayoutPersisted } from './column-layout-schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { rehydrateStore } from '@clouddrive/state-foundation';

import { normalizeColumnLayout, useColumnLayoutStore } from '../stores/column-layout';

const CANONICAL = ['workstream', 'owner', 'status', 'region', 'progress', 'updated'] as const;
const MANDATORY = new Set(['workstream']);

describe('列布局 store（column-layout，SET-002-005 分片）', () => {
  it('migrates v1 without discarding sort or explicit visibility', () => {
    expect(
      parseColumnLayoutPersisted({
        layouts: {
          list: {
            visibleOrder: ['status', 'status', 'owner'],
            sort: { columnId: 'status', direction: 'ascending' },
          },
        },
      }).layouts.list,
    ).toEqual({
      visibleOrder: ['status', 'owner'],
      customVisibility: true,
      sort: { columnId: 'status', direction: 'ascending' },
    });
  });
  it('rejects damaged width records rather than applying invalid geometry', () => {
    expect(() =>
      parseColumnLayoutPersisted({
        layouts: { list: { visibleOrder: ['owner'], widths: { owner: -1 } } },
      }),
    ).toThrow('记录损坏');
  });
  beforeEach(() => {
    useColumnLayoutStore.setState({ layouts: {} });
  });

  it('normalize：无保存值 → canonical 顺序', () => {
    expect(normalizeColumnLayout([...CANONICAL], undefined, MANDATORY)).toEqual([...CANONICAL]);
  });

  it('normalize：过滤已退役列 + 保留标识列在首位；保存序缺失列 = 显式隐藏不补回', () => {
    // 保存值含已退役列 'legacy'；mandatory workstream 强制首位；region/progress/
    // updated 未在保存序 → 隐藏（不补回）。
    const out = normalizeColumnLayout(
      [...CANONICAL],
      ['owner', 'legacy', 'status', 'workstream'],
      MANDATORY,
    );
    expect(out).toEqual(['workstream', 'owner', 'status']);
  });

  it('save/restore 持久化按 pageId', () => {
    useColumnLayoutStore.getState().saveLayout('resource-list', {
      visibleOrder: ['status', 'owner'],
    });
    const layouts = useColumnLayoutStore.getState().layouts;
    expect(layouts['resource-list']?.visibleOrder).toEqual(['status', 'owner']);
    useColumnLayoutStore.getState().restoreLayout('resource-list', {
      visibleOrder: ['updated'],
    });
    expect(useColumnLayoutStore.getState().layouts['resource-list']?.visibleOrder).toEqual([
      'updated',
    ]);
  });

  it('rehydrateStore：localStorage 预置记录在显式 hydration 后进入 state', async () => {
    useColumnLayoutStore.setState({ layouts: {} });
    window.localStorage.setItem(
      'clouddrive.page-archetypes.column-layout',
      JSON.stringify({
        state: { layouts: { 'resource-list': { visibleOrder: ['status', 'owner'] } } },
        version: 1,
      }),
    );
    rehydrateStore(useColumnLayoutStore);
    // 等待 hydration 落地（微任务/短超时）。
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(useColumnLayoutStore.getState().layouts['resource-list']?.visibleOrder).toEqual([
      'status',
      'owner',
    ]);
  });
});
