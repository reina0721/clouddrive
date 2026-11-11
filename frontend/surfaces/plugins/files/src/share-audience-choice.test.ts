import { describe, expect, it } from 'vitest';
import { shareAudienceChoice, simpleShareAudience } from './share-audience-choice';
import {
  initialShareAudience,
  readOnlySharePermissions,
  deniedSharePermissions,
  shareAudienceValid,
} from '../../../src/files/sharing';

describe('分享访问范围', () => {
  it('登录范围明确拒绝匿名，登录用户沿用链接权限，不携带旧的账号或角色例外', () => {
    const value = simpleShareAudience('signed-in');
    expect(shareAudienceValid(value)).toBe(true);
    expect(Object.values(value.anonymous!)).toEqual(Array(10).fill(false));
    expect(value.authenticated).toBeNull();
    expect(value.accounts).toEqual([]);
    expect(value.roles).toEqual([]);
    expect(shareAudienceChoice(value)).toBe('signed-in');
    expect(simpleShareAudience('anyone')).toEqual(initialShareAudience());
  });
  it('有账号、角色或不同默认能力的策略始终显示自定义，不会被概括为更宽泛的访问范围', () => {
    const rule = {
      subjectId: '0c8d3f53-034a-4f08-9d68-884c39c7c389',
      permissions: { ...readOnlySharePermissions },
    };
    for (const patch of [
      { accounts: [rule] },
      { roles: [rule] },
      { authenticated: { ...deniedSharePermissions } },
      { anonymous: { ...readOnlySharePermissions } },
    ]) {
      expect(shareAudienceChoice({ ...initialShareAudience(), ...patch })).toBe('custom');
    }
  });
});
