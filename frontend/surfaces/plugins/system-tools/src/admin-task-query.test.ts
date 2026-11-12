import { describe, expect, it } from 'vitest';
import { adminTaskQueryHref, initialAdminTaskQuery, readAdminTaskQuery } from './admin-task-query';

describe('管理任务 URL 查询', () => {
  it('完整范围、排序、状态和分页可往返，默认值使用干净路径', () => {
    expect(adminTaskQueryHref(initialAdminTaskQuery)).toBe('/system-tools/tasks');
    const query = {
      ...initialAdminTaskQuery,
      ownerId: 'owner+1',
      nodeId: 'worker_1',
      taskId: 'task-id',
      kind: 'http' as const,
      origin: 'user' as const,
      status: 'failed' as const,
      sort: 'id' as const,
      direction: 'asc' as const,
      page: 3,
    };
    const href = adminTaskQueryHref(query);
    expect(readAdminTaskQuery(new URL(href, 'http://local').searchParams)).toEqual(query);
    expect(adminTaskQueryHref({ ...initialAdminTaskQuery, nodeId: '' })).not.toContain('nodeId');
  });
  it('未知枚举和无效页码回落到稳定默认，不发送无界分页', () => {
    for (const page of ['0', '-1', '1.5', '10001', '1e3', '999999999999999999999999999999']) {
      expect(
        readAdminTaskQuery(
          new URLSearchParams({ page, status: 'unknown', kind: 'unknown', origin: 'unknown' }),
        ),
      ).toEqual(initialAdminTaskQuery);
    }
  });
});
