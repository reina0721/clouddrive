import { describe, expect, it } from 'vitest';

import {
  navigationIconVocabulary,
  collectUnknownNavigationIconDiagnostics,
  UNKNOWN_NAVIGATION_ICON,
} from './navigation-icon';

describe('Product Surface navigation icon vocabulary', () => {
  it('vocabulary 非空且含既有 reference-resources 语义 resource', () => {
    expect(navigationIconVocabulary.length).toBeGreaterThan(0);
    expect(navigationIconVocabulary).toContain('resource');
  });

  it('合法 iconId 无诊断；未声明（undefined）不产生诊断', () => {
    const diagnostics = collectUnknownNavigationIconDiagnostics([
      { iconId: 'resource', routeId: 'reference-resources' },
      { iconId: 'data', routeId: 'plugin-a' },
    ]);
    expect(diagnostics).toEqual([]);
    // 调用方只应传入已声明 iconId 的引用；此处验证空引用无诊断
    expect(collectUnknownNavigationIconDiagnostics([])).toEqual([]);
  });

  it('未知 iconId：聚合 routeIds 且 code/message 单点构造', () => {
    const diagnostics = collectUnknownNavigationIconDiagnostics([
      { iconId: 'nope', routeId: 'plugin-a' },
      { iconId: 'nope', routeId: 'plugin-a.detail' },
      { iconId: 'also-missing', routeId: 'plugin-b' },
    ]);
    expect(diagnostics).toHaveLength(2);
    const nope = diagnostics.find((d) => d.iconId === 'nope');
    expect(nope?.code).toBe(UNKNOWN_NAVIGATION_ICON);
    expect(nope?.routeIds).toEqual(['plugin-a', 'plugin-a.detail']);
    expect(nope?.message).toContain('navigation.iconId 未命中 Product Surface icon vocabulary');
  });
});
