import { beforeEach, describe, expect, it } from 'vitest';

import { useWorkspaceStore } from '../state/use-workspace-store';
import { createHostWorkspacePort, resetHostWorkspaceForTest } from '../host/workspace-port';

const descriptor = {
  pageId: 'reference-resources.create',
  version: 1,
  draftFields: ['name', 'kind'],
  allowListState: false,
};

describe('createHostWorkspacePort（页面状态/草稿，SET-006-002）', () => {
  beforeEach(() => {
    resetHostWorkspaceForTest();
    useWorkspaceStore.setState({ records: {} });
  });

  it('save/restore：白名单外字段被过滤（仅允许保存字段入草稿）', () => {
    const port = createHostWorkspacePort();
    port.registerPageState(descriptor);
    const result = port.savePageState('reference-resources.create', {
      draft: { name: 'Alpha', kind: 'sample', secret: '不应保存' },
    });
    expect(result).toEqual({ ok: true });
    const restored = port.restorePageState('reference-resources.create');
    expect(restored?.draft).toEqual({ name: 'Alpha', kind: 'sample' }); // secret 被过滤
  });

  it('草稿冲突：另一窗口写入后本窗口再存不同草稿 → conflict 不覆盖', () => {
    // 窗口 A。
    const windowA = createHostWorkspacePort();
    windowA.registerPageState(descriptor);
    windowA.savePageState('reference-resources.create', { draft: { name: 'A' } });
    // 窗口 B（独立实例）：写入不同草稿（其本地无基线 → 允许，覆盖为 B）。
    const windowB = createHostWorkspacePort();
    windowB.registerPageState(descriptor);
    const bResult = windowB.savePageState('reference-resources.create', { draft: { name: 'B' } });
    expect(bResult).toEqual({ ok: true });
    // 窗口 A 再存 C：stored(B) ≠ A 的 lastWritten(A) 且 ≠ C → conflict，不覆盖。
    const aResult = windowA.savePageState('reference-resources.create', { draft: { name: 'C' } });
    expect(aResult.ok).toBe(false);
    if (!aResult.ok) expect(aResult.conflict).toBe(true);
    // stored 仍是 B（未被 A 覆盖）。
    expect(windowA.restorePageState('reference-resources.create')?.draft).toEqual({ name: 'B' });
  });

  it('同一窗口顺序 autosave 不误报冲突（stored 指纹 == lastWritten）', () => {
    const port = createHostWorkspacePort();
    port.registerPageState(descriptor);
    port.savePageState('reference-resources.create', { draft: { name: '' } });
    const second = port.savePageState('reference-resources.create', { draft: { name: 'Alpha' } });
    expect(second).toEqual({ ok: true });
    expect(port.restorePageState('reference-resources.create')?.draft).toEqual({ name: 'Alpha' });
  });

  it('无记录 restore 返回 null；clearPageState 删除记录', () => {
    const port = createHostWorkspacePort();
    expect(port.restorePageState('missing')).toBeNull();
    port.registerPageState(descriptor);
    port.savePageState('reference-resources.create', { draft: { name: 'A' } });
    port.clearPageState('reference-resources.create');
    expect(port.restorePageState('reference-resources.create')).toBeNull();
  });

  it('list 状态与草稿分离保存', () => {
    const port = createHostWorkspacePort();
    port.registerPageState({ ...descriptor, allowListState: true });
    port.savePageState('reference-resources.create', {
      list: { filters: { status: 'active' }, page: 2, pageSize: 20, scrollTop: 120 },
      draft: { name: 'A' },
    });
    const restored = port.restorePageState('reference-resources.create');
    expect(restored?.list).toEqual({
      filters: { status: 'active' },
      page: 2,
      pageSize: 20,
      scrollTop: 120,
    });
    expect(restored?.draft).toEqual({ name: 'A' });
  });
});
