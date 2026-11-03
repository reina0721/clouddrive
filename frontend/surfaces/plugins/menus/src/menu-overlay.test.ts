import { describe, expect, it } from 'vitest';

import {
  applyMenuOverridePatch,
  applyMenuOverlay,
  parseMenuOverlayPersisted,
  readMenuOverrides,
  resetMenuOverridePreset,
  selectVisibleMenuEntries,
  validateMenuOverrideDraft,
  type MenuOverlayEntry,
  type MenuOverrides,
} from './menu-overlay';

const entries: readonly MenuOverlayEntry[] = [
  { id: 'group:administration', kind: 'group', label: 'Administration', order: 1 },
  {
    id: 'nav:users',
    kind: 'menu',
    parentId: 'group:administration',
    routeId: 'users',
    label: 'Users',
    order: 0,
  },
  {
    id: 'nav:users.detail',
    kind: 'submenu',
    parentId: 'nav:users',
    routeId: 'users.detail',
    label: 'User detail',
    order: 0,
  },
  {
    id: 'nav:users.edit',
    kind: 'submenu',
    parentId: 'nav:users',
    routeId: 'users.edit',
    label: 'User editor',
    order: 1,
  },
  {
    id: 'nav:roles',
    kind: 'menu',
    parentId: 'group:administration',
    routeId: 'roles',
    label: 'Roles',
    order: 1,
  },
  { id: 'group:system', kind: 'group', label: 'Personal', order: 2 },
];

describe('applyMenuOverlay', () => {
  it('applies title, order, permission, and visibility overrides per route', () => {
    const overrides: MenuOverrides = {
      users: { label: 'Members', order: 5, permission: 'users.read', hidden: true, version: 2 },
    };
    const resolved = applyMenuOverlay(entries, overrides);
    const users = resolved.find((entry) => entry.routeId === 'users');
    expect(users?.label).toBe('Members');
    expect(users?.baseLabel).toBe('Users');
    expect(users?.order).toBe(5);
    expect(users?.permission).toBe('users.read');
    expect(users?.hidden).toBe(true);
    expect(users?.overridden).toBe(true);
    expect(users?.version).toBe(2);
  });

  it('re-sorts siblings by overridden order and keeps registry order otherwise', () => {
    const resolved = applyMenuOverlay(entries, { roles: { order: -1, version: 1 } });
    const menuOrder = resolved
      .filter((entry) => entry.parentId === 'group:administration')
      .map((entry) => entry.routeId);
    expect(menuOrder).toEqual(['roles', 'users']);
    expect(resolved.map((entry) => entry.id).slice(0, 1)).toEqual(['group:administration']);
  });

  it('inherits hidden state to descendants without touching siblings', () => {
    const resolved = applyMenuOverlay(entries, { users: { hidden: true, version: 1 } });
    expect(resolved.find((entry) => entry.routeId === 'users.detail')?.hidden).toBe(true);
    expect(resolved.find((entry) => entry.routeId === 'users.edit')?.hidden).toBe(true);
    expect(resolved.find((entry) => entry.routeId === 'roles')?.hidden).toBe(false);
  });

  it('ignores overrides for unknown route ids and keeps structural rows unmodified', () => {
    const resolved = applyMenuOverlay(entries, { unknown: { label: 'Nope', version: 1 } });
    expect(resolved.every((entry) => !entry.overridden)).toBe(true);
    expect(resolved.find((entry) => entry.id === 'group:administration')?.label).toBe(
      'Administration',
    );
  });

  it('treats a version-only record as not modified', () => {
    const resolved = applyMenuOverlay(entries, { users: { version: 4 } });
    const users = resolved.find((entry) => entry.routeId === 'users');
    expect(users?.overridden).toBe(false);
    expect(users?.version).toBe(4);
  });
});

describe('menu override writes', () => {
  it('bumps version and normalizes cleared values', () => {
    const applied = applyMenuOverridePatch(
      { label: 'Old', order: 3, permission: 'users.read', version: 2 },
      { label: '  ', order: null, permission: null },
    );
    expect(applied).toEqual({ ok: true, next: { version: 3 } });
  });

  it('keeps hidden visibility when presentation is reset', () => {
    expect(resetMenuOverridePreset({ label: 'Old', hidden: true, version: 5 })).toEqual({
      version: 6,
      hidden: true,
    });
    expect(resetMenuOverridePreset(undefined)).toEqual({ version: 1 });
  });

  it('rejects order and permission outside the contract', () => {
    expect(applyMenuOverridePatch(undefined, { order: 1000 })).toEqual({
      ok: false,
      reason: 'order-range',
    });
    expect(applyMenuOverridePatch(undefined, { permission: 'Users.Read' })).toEqual({
      ok: false,
      reason: 'permission-format',
    });
    expect(applyMenuOverridePatch(undefined, { label: 'x'.repeat(41) })).toEqual({
      ok: false,
      reason: 'label-length',
    });
  });

  it('validates dialog drafts and returns clear markers for empty fields', () => {
    const valid = validateMenuOverrideDraft({
      label: ' Members ',
      permission: 'users.read',
      order: '12',
      hidden: true,
    });
    expect(valid).toEqual({
      ok: true,
      values: { hidden: true, label: 'Members', permission: 'users.read', order: 12 },
    });

    const cleared = validateMenuOverrideDraft({
      label: '',
      permission: '',
      order: '',
      hidden: false,
    });
    expect(cleared).toEqual({
      ok: true,
      values: { hidden: false, label: '', permission: null, order: null },
    });

    expect(
      validateMenuOverrideDraft({ label: '', permission: 'Bad', order: '1.5', hidden: false }),
    ).toEqual({ ok: false, issues: { permission: 'permission-format', order: 'order-range' } });
  });
});

describe('parseMenuOverlayPersisted', () => {
  it('accepts valid records including null permission', () => {
    expect(
      parseMenuOverlayPersisted({
        overrides: {
          users: { label: 'Members', order: 2, permission: null, hidden: false, version: 3 },
        },
        updatedAt: 1_700_000_000_000,
      }),
    ).toEqual({
      overrides: {
        users: { label: 'Members', order: 2, permission: null, hidden: false, version: 3 },
      },
      updatedAt: 1_700_000_000_000,
    });
  });

  it('throws on damaged records instead of silently falling back', () => {
    expect(() => parseMenuOverlayPersisted({ overrides: { users: { version: 0 } } })).toThrow();
    expect(() =>
      parseMenuOverlayPersisted({ overrides: { users: { label: 'x'.repeat(41), version: 1 } } }),
    ).toThrow();
    expect(() =>
      parseMenuOverlayPersisted({ overrides: { users: { permission: 'Bad', version: 1 } } }),
    ).toThrow();
    expect(() => parseMenuOverlayPersisted({ updatedAt: null })).toThrow();
  });

  it('reads overrides through the store selector shape', () => {
    const overrides: MenuOverrides = { users: { version: 1 } };
    expect(readMenuOverrides({ overrides })).toBe(overrides);
  });
});

describe('selectVisibleMenuEntries', () => {
  const resolved = applyMenuOverlay(entries, {
    'users.edit': { label: 'Editor', version: 1 },
  });

  it('keeps ancestors of search matches and drops unrelated branches', () => {
    const visible = selectVisibleMenuEntries(resolved, {
      query: 'editor',
      onlyModified: false,
      collapsedIds: new Set(),
    });
    expect(visible.map((entry) => entry.id)).toEqual([
      'group:administration',
      'nav:users',
      'nav:users.edit',
    ]);
  });

  it('filters to modified entries plus their ancestors', () => {
    const visible = selectVisibleMenuEntries(resolved, {
      query: '',
      onlyModified: true,
      collapsedIds: new Set(),
    });
    expect(visible.map((entry) => entry.id)).toEqual([
      'group:administration',
      'nav:users',
      'nav:users.edit',
    ]);
  });

  it('hides collapsed descendants but shows matches regardless of collapse', () => {
    const collapsedIds = new Set(['nav:users']);
    const withoutFilter = selectVisibleMenuEntries(resolved, {
      query: '',
      onlyModified: false,
      collapsedIds,
    });
    expect(withoutFilter.map((entry) => entry.id)).toEqual([
      'group:administration',
      'nav:users',
      'nav:roles',
      'group:system',
    ]);

    const filtered = selectVisibleMenuEntries(resolved, {
      query: 'detail',
      onlyModified: false,
      collapsedIds,
    });
    expect(filtered.map((entry) => entry.id)).toEqual([
      'group:administration',
      'nav:users',
      'nav:users.detail',
    ]);
  });
});
