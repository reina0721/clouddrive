import { describe, expect, it } from 'vitest';

import {
  buildDepartmentRows,
  departmentDeleteBlocker,
  departmentParentOptions,
  parseDepartmentsPersisted,
  selectVisibleDepartmentRows,
  validateDepartmentDraft,
  type DepartmentNode,
} from './department-model';

const node = (
  id: string,
  parentId: string | null,
  order: number,
  memberCount = 0,
): DepartmentNode => ({
  id,
  parentId,
  name: `Department ${id}`,
  leader: 'Leader',
  memberCount,
  status: 'active',
  remark: '',
  createdAt: 1_700_000_000_000,
  order,
  version: 1,
});

const nodes: readonly DepartmentNode[] = [
  node('root', null, 0, 10),
  node('child', 'root', 0, 5),
  node('grandchild', 'child', 0, 0),
  node('other', 'root', 1, 0),
];

const draft = (patch: Partial<Parameters<typeof validateDepartmentDraft>[2]>) => ({
  name: 'New department',
  leader: 'Leader',
  remark: '',
  status: 'active' as const,
  parentId: 'root',
  ...patch,
});

describe('department tree', () => {
  it('builds a depth-first tree with depth and child counts', () => {
    const rows = buildDepartmentRows(nodes);
    expect(rows.map((row) => [row.id, row.depth, row.childCount])).toEqual([
      ['root', 0, 2],
      ['child', 1, 1],
      ['grandchild', 2, 0],
      ['other', 1, 0],
    ]);
  });

  it('keeps ancestors when filtering by name', () => {
    const rows = buildDepartmentRows(nodes);
    const visible = selectVisibleDepartmentRows(rows, {
      query: 'grandchild',
      collapsedIds: new Set(),
    });
    expect(visible.map((row) => row.id)).toEqual(['root', 'child', 'grandchild']);
  });

  it('hides collapsed descendants while matching rows stay visible', () => {
    const rows = buildDepartmentRows(nodes);
    const collapsed = new Set(['child']);
    expect(
      selectVisibleDepartmentRows(rows, { query: '', collapsedIds: collapsed }).map(
        (row) => row.id,
      ),
    ).toEqual(['root', 'child', 'other']);
    expect(
      selectVisibleDepartmentRows(rows, { query: 'grandchild', collapsedIds: collapsed }).map(
        (row) => row.id,
      ),
    ).toEqual(['root', 'child', 'grandchild']);
  });

  it('blocks deletion when children or members exist', () => {
    expect(departmentDeleteBlocker(nodes, 'root')).toBe('has-children');
    expect(departmentDeleteBlocker(nodes, 'child')).toBe('has-children');
    expect(departmentDeleteBlocker(nodes, 'grandchild')).toBeNull();
    expect(departmentDeleteBlocker([node('leaf', null, 0, 3)], 'leaf')).toBe('has-members');
  });
});

describe('department parent options', () => {
  it('excludes self and descendants for edits', () => {
    expect(departmentParentOptions(nodes, 'child').map((option) => option.id)).toEqual(['root']);
  });

  it('excludes parents at depth 2 for new nodes', () => {
    expect(departmentParentOptions(nodes, null).map((option) => option.id)).toEqual([
      'root',
      'child',
      'other',
    ]);
  });
});

describe('department validation', () => {
  it('accepts valid drafts and trims fields', () => {
    const result = validateDepartmentDraft(
      nodes,
      null,
      draft({ name: '  Platform  ', leader: '  Lin  ' }),
    );
    expect(result).toEqual({
      ok: true,
      values: {
        name: 'Platform',
        leader: 'Lin',
        remark: '',
        status: 'active',
        parentId: 'root',
      },
    });
  });

  it('rejects short names and overlong remarks', () => {
    expect(validateDepartmentDraft(nodes, null, draft({ name: 'x' }))).toMatchObject({
      ok: false,
      issues: { name: 'name-length' },
    });
    expect(validateDepartmentDraft(nodes, null, draft({ remark: 'x'.repeat(201) }))).toMatchObject({
      ok: false,
      issues: { remark: 'remark-length' },
    });
  });

  it('rejects cycles and level overflow', () => {
    expect(validateDepartmentDraft(nodes, 'root', draft({ parentId: 'child' }))).toMatchObject({
      ok: false,
      issues: { parent: 'parent-invalid' },
    });
    expect(validateDepartmentDraft(nodes, 'child', draft({ parentId: 'other' }))).toMatchObject({
      ok: false,
      issues: { parent: 'parent-depth' },
    });
  });
});

describe('departments persistence read', () => {
  it('accepts a valid record', () => {
    expect(parseDepartmentsPersisted({ nodes })).toEqual({ nodes });
  });

  it('rejects cycles and level overflow instead of silently rewriting', () => {
    const cyclic = [{ ...node('a', 'b', 0) }, { ...node('b', 'a', 0) }];
    expect(() => parseDepartmentsPersisted({ nodes: cyclic })).toThrow();
    const deep = [
      node('l0', null, 0),
      node('l1', 'l0', 0),
      node('l2', 'l1', 0),
      node('l3', 'l2', 0),
    ];
    expect(() => parseDepartmentsPersisted({ nodes: deep })).toThrow();
  });
});
