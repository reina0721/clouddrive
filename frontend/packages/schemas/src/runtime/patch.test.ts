import { describe, expect, it } from 'vitest';

import { applyPatch, assertPatchShape } from './patch';

const doc = () => ({
  'x-clouddrive': {
    source: {
      tokens: { colors: { light: { brand: '#5d49d6' } }, theme: { radii: { control: '0.75rem' } } },
    },
    facts: [{ id: 'a', sourcePointer: '/x-clouddrive/source/tokens/colors' }],
  },
});

const WRITABLE = ['/x-clouddrive/source'];
const READONLY = [
  '/x-clouddrive/contractRef',
  '/x-clouddrive/facts',
  '/x-clouddrive/authoring',
  '/x-clouddrive/artifacts',
];

/** Patch 成功结果的 typed 视图（仅测试访问 source.tokens.* 字段）。 */
type PatchDoc = {
  'x-clouddrive': {
    source: {
      tokens?: {
        colors?: { light?: Record<string, string> };
        theme?: { radii?: Record<string, string> };
      };
      arr?: number[];
    };
  };
};

function dataOf(result: { ok: true; data: unknown }): PatchDoc {
  return result.data as PatchDoc;
}

/** 断言 patch 成功并返回 typed 视图。 */
function expectOk(result: { ok: true; data: unknown } | { ok: false; error: string }): PatchDoc {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return dataOf(result);
}

describe('RFC 6902 Patch（带只读边界）', () => {
  it('replace 可写 source 值', () => {
    const result = applyPatch(
      doc(),
      [
        {
          op: 'replace',
          path: '/x-clouddrive/source/tokens/colors/light/brand',
          value: '#000000',
        },
      ],
      WRITABLE,
      READONLY,
    );
    const data = expectOk(result);
    expect(data['x-clouddrive'].source.tokens!.colors!.light!.brand).toBe('#000000');
  });

  it('add 对象键与数组 "-" 追加', () => {
    const withArray = () => ({
      'x-clouddrive': { source: { arr: [1, 2] } },
    });
    const result1 = applyPatch(
      doc(),
      [{ op: 'add', path: '/x-clouddrive/source/tokens/colors/light/extra', value: '#ffffff' }],
      WRITABLE,
      READONLY,
    );
    expect(result1.ok).toBe(true);
    const result2 = applyPatch(
      withArray(),
      [{ op: 'add', path: '/x-clouddrive/source/arr/-', value: 3 }],
      WRITABLE,
      READONLY,
    );
    expect(result2.ok).toBe(true);
    if (result2.ok) {
      expect(dataOf(result2)['x-clouddrive'].source.arr).toEqual([1, 2, 3]);
    }
  });

  it('remove / replace / move / copy / test 成功路径', () => {
    const r1 = applyPatch(
      doc(),
      [{ op: 'remove', path: '/x-clouddrive/source/tokens/theme/radii/control' }],
      WRITABLE,
      READONLY,
    );
    expect(r1.ok).toBe(true);
    const r2 = applyPatch(
      doc(),
      [
        {
          op: 'move',
          from: '/x-clouddrive/source/tokens/colors/light/brand',
          path: '/x-clouddrive/source/tokens/theme/radii/brand',
        },
      ],
      WRITABLE,
      READONLY,
    );
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      const data = dataOf(r2);
      expect(data['x-clouddrive'].source.tokens!.theme!.radii!.brand).toBe('#5d49d6');
      expect(data['x-clouddrive'].source.tokens!.colors!.light!.brand).toBeUndefined();
    }
    const r3 = applyPatch(
      doc(),
      [
        {
          op: 'copy',
          from: '/x-clouddrive/source/tokens/colors/light/brand',
          path: '/x-clouddrive/source/tokens/theme/radii/copy',
        },
      ],
      WRITABLE,
      READONLY,
    );
    expect(r3.ok).toBe(true);
    const r4 = applyPatch(
      doc(),
      [{ op: 'test', path: '/x-clouddrive/source/tokens/colors/light/brand', value: '#5d49d6' }],
      WRITABLE,
      READONLY,
    );
    expect(r4.ok).toBe(true);
  });

  it('写只读区（facts/artifacts/contractRef/协议结构）整次失败', () => {
    const cases = [
      { op: 'replace' as const, path: '/x-clouddrive/facts/0/id', value: 'x' },
      { op: 'remove' as const, path: '/x-clouddrive/artifacts' },
      { op: 'add' as const, path: '/x-clouddrive/contractRef/file', value: 'x' },
      {
        op: 'replace' as const,
        path: '/x-clouddrive/authoring/patchableSourcePointers/0',
        value: '/',
      },
    ];
    for (const operation of cases) {
      const result = applyPatch(doc(), [operation], WRITABLE, READONLY);
      expect(result.ok).toBe(false);
    }
  });

  it('只读区外但不在 patchable 白名单（source 之外其他 x-clouddrive 顶层）失败', () => {
    const result = applyPatch(
      doc(),
      [{ op: 'add', path: '/x-clouddrive/extra', value: 1 }],
      WRITABLE,
      READONLY,
    );
    expect(result.ok).toBe(false);
  });

  it('move/copy 来源或目标越权均整次失败（无部分应用）', () => {
    const moveFromReadonly = applyPatch(
      doc(),
      [{ op: 'move', from: '/x-clouddrive/facts/0', path: '/x-clouddrive/source/tokens/x' }],
      WRITABLE,
      READONLY,
    );
    expect(moveFromReadonly.ok).toBe(false);
    const moveToReadonly = applyPatch(
      doc(),
      [
        {
          op: 'move',
          from: '/x-clouddrive/source/tokens/colors/light/brand',
          path: '/x-clouddrive/facts/0',
        },
      ],
      WRITABLE,
      READONLY,
    );
    expect(moveToReadonly.ok).toBe(false);
    const copyFromReadonly = applyPatch(
      doc(),
      [
        {
          op: 'copy',
          from: '/x-clouddrive/contractRef',
          path: '/x-clouddrive/source/tokens/x',
        },
      ],
      WRITABLE,
      READONLY,
    );
    expect(copyFromReadonly.ok).toBe(false);
  });

  it('多 op 中途失败不部分应用（原文档不变）', () => {
    const original = doc();
    const result = applyPatch(
      original,
      [
        {
          op: 'replace',
          path: '/x-clouddrive/source/tokens/colors/light/brand',
          value: '#111111',
        },
        { op: 'remove', path: '/x-clouddrive/facts/0' }, // 失败点
      ],
      WRITABLE,
      READONLY,
    );
    expect(result.ok).toBe(false);
    expect(original['x-clouddrive'].source.tokens.colors.light.brand).toBe('#5d49d6');
  });

  it('shape 校验：未知 op / 缺 from / move 自环 / 非数组', () => {
    expect(() => assertPatchShape({})).toThrow('Patch 必须是数组');
    expect(() => assertPatchShape([{ op: 'bogus', path: '/' }])).toThrow('未知 op');
    expect(() => assertPatchShape([{ op: 'move', path: '/a' }])).toThrow('缺少 from');
    expect(() => assertPatchShape([{ op: 'move', from: '/a', path: '/a' }])).toThrow('相同');
  });

  it('非法 path（不以 / 开头）失败', () => {
    const result = applyPatch(doc(), [{ op: 'replace', path: 'a', value: 1 }], WRITABLE, READONLY);
    expect(result.ok).toBe(false);
  });
});
