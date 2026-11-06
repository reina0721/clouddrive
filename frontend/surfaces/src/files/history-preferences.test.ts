import { describe, it, expect } from 'vitest';
import { historyPreferencesSchema, parseHistoryDraft } from './history-preferences';
const current = { revision: 4, enabled: true, extensions: [], maxVersions: 0 };
describe('版本保留设置的输入边界', () => {
  it('明确规范前导点与大小写，空筛选与0保持语义', () => {
    expect(parseHistoryDraft(current, '.TXT, md', '2')).toMatchObject({
      success: true,
      data: { extensions: ['txt', 'md'], maxVersions: 2, revision: 4 },
    });
    expect(parseHistoryDraft(current, ' ', '0')).toMatchObject({
      success: true,
      data: { extensions: [], maxVersions: 0 },
    });
  });
  it('拒绝重复、路径、多个点和非法数量，不偷偷删除或截断', () => {
    for (const extensions of ['txt,TXT', '../txt', '..txt', 'tar.gz', 'a/'.repeat(40)])
      expect(parseHistoryDraft(current, extensions, '2').success).toBe(false);
    for (const count of ['', '-1', '1.5', '21', '02', 'Infinity'])
      expect(parseHistoryDraft(current, 'txt', count).success).toBe(false);
    expect(
      historyPreferencesSchema.safeParse({
        ...current,
        extensions: Array.from({ length: 33 }, (_, i) => 'x' + i),
      }).success,
    ).toBe(false);
  });
});
