import {
  fileAccessDetailSchema,
  audienceTargetSchema,
  effectiveFileAccessSchema,
  type FileAccessPort,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';

/** createFileAccessPort 复用同一文件客户端与账号围栏，不创建新认证或身份缓存。 */
export function createFileAccessPort(
  call: ReturnType<typeof createJsonClient>,
  assertCurrent: () => void,
): FileAccessPort {
  return {
    read: async (id, signal) => {
      assertCurrent();
      const response = await call(
        '/' + encodeURIComponent(id) + '/access',
        signal ? { signal } : {},
      );
      assertCurrent();
      return fileAccessDetailSchema.parse(response);
    },
    update: async (id, input) => {
      assertCurrent();
      const response = await call('/' + encodeURIComponent(id) + '/access', {
        method: 'PUT',
        body: input,
      });
      assertCurrent();
      return fileAccessDetailSchema.parse(response);
    },
    lookup: async (kind, key, signal) => {
      assertCurrent();
      const response = await call('/audience/lookup', {
        method: 'POST',
        body: { kind, key },
        ...(signal ? { signal } : {}),
      });
      assertCurrent();
      return audienceTargetSchema.parse(response);
    },
    preview: async (id, shareId, accountId, signal) => {
      assertCurrent();
      const response = await call('/' + encodeURIComponent(id) + '/access/effective', {
        method: 'POST',
        body: { shareId, accountId },
        ...(signal ? { signal } : {}),
      });
      assertCurrent();
      return effectiveFileAccessSchema.parse(response);
    },
  };
}
