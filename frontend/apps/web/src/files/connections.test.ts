import { describe, expect, it, vi } from 'vitest';
import { FilesError, type FileConnection } from '@clouddrive/surface/files';
import { createConnectionsPort } from './connections';

const connection: FileConnection = {
  id: 'd25f5cc7-8a0d-4483-9764-7b70580a39fc',
  name: '设备',
  rootId: '',
  rootPath: '/',
  readOnly: false,
  blockSystemFiles: true,
  status: 'active',
  createdAt: '2026-11-03T00:00:00Z',
  expiresAt: '2026-12-03T00:00:00Z',
  revision: 4,
  endpointOrigin: 'https://files.example.test',
  endpointPath: '/dav/d25f5cc7-8a0d-4483-9764-7b70580a39fc/',
};
describe('连接Host的地址与版本边界', () => {
  it('仅组合服务端明确origin，拒绝协议或另一个网络主机', () => {
    const port = createConnectionsPort(
      vi.fn(() => Promise.resolve(connection)),
      () => {},
    );
    expect(port.endpoint(connection)).toBe(connection.endpointOrigin + connection.endpointPath);
    expect(() =>
      port.endpoint({ ...connection, endpointPath: '//elsewhere.example.test/path' }),
    ).toThrow(FilesError);
    expect(() => port.endpoint({ ...connection, endpointOrigin: 'file://host' })).toThrow(
      FilesError,
    );
  });
  it('修改始终携带读到的revision，不静默覆盖版本', async () => {
    const call = vi.fn(() => Promise.resolve({ ...connection, revision: 5 }));
    const port = createConnectionsPort(call, () => {});
    expect((await port.update(connection, { name: '改名' })).revision).toBe(5);
    expect(call).toHaveBeenCalledWith('/connections/' + connection.id, {
      method: 'PATCH',
      body: { name: '改名', revision: 4 },
    });
  });
  it('账号退出后不继续显示或复制旧账号的连接地址', () => {
    const port = createConnectionsPort(
      vi.fn(() => Promise.resolve(connection)),
      () => {
        throw new FilesError('canceled');
      },
    );
    expect(() => port.endpoint(connection)).toThrow(FilesError);
  });
});
