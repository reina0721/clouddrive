import { describe, expect, it } from 'vitest';

import { resolveStartTarget, type StartTargetContext } from '../host/startup-target';

function ctx(overrides: Partial<StartTargetContext>): StartTargetContext {
  return {
    currentPathname: '/',
    restoreTarget: null,
    recents: [],
    homeTarget: '/',
    defaultAreaFirstEntry: null,
    validPathnames: new Set(['/settings', '/foundations', '/motion', '/reference-resources']),
    ...overrides,
  };
}

describe('resolveStartTarget（启动目标解析，SET-005-004）', () => {
  it('深链接（currentPathname ≠ /）不被启动偏好重定向', () => {
    const result = resolveStartTarget(
      ctx({
        currentPathname: '/settings?category=appearance',
        recents: [{ pathname: '/motion' }],
      }),
    );
    expect(result).toBeNull();
  });

  it('工作恢复目标优先（有效时）', () => {
    const result = resolveStartTarget(ctx({ restoreTarget: '/reference-resources' }));
    expect(result).toBe('/reference-resources');
  });

  it('无恢复目标 → 最近页面', () => {
    const result = resolveStartTarget(
      ctx({ recents: [{ pathname: '/motion' }, { pathname: '/foundations' }] }),
    );
    expect(result).toBe('/motion');
  });

  it('无恢复/最近 → 指定首页（homeTarget）', () => {
    const result = resolveStartTarget(ctx({ homeTarget: '/settings' }));
    expect(result).toBe('/settings');
  });

  it('homeTarget=当前首页 → 默认区域首入口', () => {
    const result = resolveStartTarget(
      ctx({ homeTarget: '/', defaultAreaFirstEntry: '/foundations' }),
    );
    expect(result).toBe('/foundations');
  });

  it('全部候选失效（不在 validPathnames）→ 当前首页（null）', () => {
    const result = resolveStartTarget(
      ctx({
        restoreTarget: '/removed-page',
        recents: [{ pathname: '/removed-recent' }],
        homeTarget: '/',
        defaultAreaFirstEntry: '/also-removed',
      }),
    );
    expect(result).toBeNull();
  });

  it('候选 = / 自身视为无效（跳过）', () => {
    const result = resolveStartTarget(
      ctx({ restoreTarget: '/', homeTarget: '/', defaultAreaFirstEntry: '/foundations' }),
    );
    expect(result).toBe('/foundations');
  });
});
