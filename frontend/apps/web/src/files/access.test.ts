import { describe, expect, it, vi } from 'vitest';
import {
  FilesError,
  initialShareAudience,
  shareAudienceSchema,
  deniedSharePermissions,
  editorSharePermissions,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';
import { createFileAccessPort } from './access';

const id = 'd25f5cc7-8a0d-4483-9764-7b70580a39fc';
const detail = {
  entry: {
    id,
    parentId: '',
    kind: 'folder',
    name: '目录',
    sizeBytes: 0,
    mediaType: '',
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
    trashedAt: null,
    contentRevision: 1,
  },
  revision: 3,
  policy: null,
  inheritedFrom: null,
  shares: [],
  maxRules: 32,
};

describe('受众与权限Host契约', () => {
  it('继承null与明确拒绝分开，重复主体与超额规则拒绝', () => {
    const initial = initialShareAudience();
    expect(shareAudienceSchema.parse(initial).anonymous).toBeNull();
    expect(
      shareAudienceSchema.parse({ ...initial, anonymous: deniedSharePermissions }).anonymous,
    ).toEqual(deniedSharePermissions);
    const rule = { subjectId: id, permissions: editorSharePermissions };
    expect(shareAudienceSchema.safeParse({ ...initial, accounts: [rule, rule] }).success).toBe(
      false,
    );
    const rules = Array.from({ length: 33 }, (_, index) => ({
      ...rule,
      subjectId: 'd25f5cc7-8a0d-4483-9764-' + String(index).padStart(12, '0'),
    }));
    expect(
      shareAudienceSchema.safeParse({
        ...initial,
        accounts: rules.slice(0, 32),
        roles: rules.slice(32),
      }).success,
    ).toBe(false);
    expect(
      shareAudienceSchema.safeParse({
        ...initial,
        authenticated: { ...deniedSharePermissions, modify: true },
      }).success,
    ).toBe(false);
  });
  it('原样传递CAS与恢复继承，不自动重试覆盖冲突草稿', async () => {
    const call = vi.fn<ReturnType<typeof createJsonClient>>().mockResolvedValue(detail);
    const port = createFileAccessPort(call, () => {});
    await port.update(id, { revision: 3, policy: null });
    expect(call).toHaveBeenLastCalledWith('/' + id + '/access', {
      method: 'PUT',
      body: { revision: 3, policy: null },
    });
    call.mockRejectedValueOnce(new FilesError('conflict'));
    await expect(port.update(id, { revision: 2, policy: null })).rejects.toMatchObject({
      code: 'conflict',
    });
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('返回前复核账号围栏，取消信号传给精确查找', async () => {
    let current = true;
    const call = vi.fn<ReturnType<typeof createJsonClient>>().mockImplementation(() => {
      current = false;
      return Promise.resolve(detail);
    });
    const port = createFileAccessPort(call, () => {
      if (!current) throw new FilesError('canceled');
    });
    await expect(port.read(id)).rejects.toMatchObject({ code: 'canceled' });
    current = true;
    call.mockResolvedValue({ id, label: '成员' });
    const controller = new AbortController();
    await port.lookup('account', 'member@example.test', controller.signal);
    expect(call).toHaveBeenLastCalledWith('/audience/lookup', {
      method: 'POST',
      body: { kind: 'account', key: 'member@example.test' },
      signal: controller.signal,
    });
  });
});
