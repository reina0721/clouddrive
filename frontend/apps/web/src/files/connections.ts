import {
  connectionSchema,
  connectionIssuedSchema,
  connectionListingSchema,
  writeLockListingSchema,
  writeLockReleaseSchema,
  FilesError,
  type ConnectionsPort,
  type FileConnection,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';

/** createConnectionsPort 复用现有会话传输，端点由服务端提供，剪贴板由Host拥有。 */
export function createConnectionsPort(
  call: ReturnType<typeof createJsonClient>,
  assertCurrent: () => void,
): ConnectionsPort {
  const path = (connection: FileConnection) => '/connections/' + encodeURIComponent(connection.id);
  const endpoint = (connection: FileConnection) => {
    assertCurrent();
    const url = new URL(connection.endpointPath, connection.endpointOrigin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== new URL(connection.endpointOrigin).origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new FilesError('invalid');
    return url.href;
  };
  const copy = async (value: string) => {
    assertCurrent();
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      throw new FilesError('unavailable', { cause: error });
    }
  };
  return {
    listWriteLocks: async (signal) =>
      writeLockListingSchema.parse(await call('/write-locks', signal ? { signal } : {})).items,
    releaseWriteLock: async (lock, signal) => {
      writeLockReleaseSchema.parse(
        await call('/write-locks/' + encodeURIComponent(lock.id) + '/release', {
          method: 'POST',
          body: { revision: lock.revision },
          ...(signal ? { signal } : {}),
        }),
      );
    },
    read: async (connection) => connectionSchema.parse(await call(path(connection))),
    list: async (cursor = '', signal) =>
      connectionListingSchema.parse(
        await call(
          '/connections?' + new URLSearchParams({ cursor, limit: '20' }).toString(),
          signal ? { signal } : {},
        ),
      ),
    create: async (input) =>
      connectionIssuedSchema.parse(await call('/connections', { method: 'POST', body: input })),
    update: async (connection, change) =>
      connectionSchema.parse(
        await call(path(connection), {
          method: 'PATCH',
          body: { ...change, revision: connection.revision },
        }),
      ),
    setState: async (connection, state) =>
      connectionSchema.parse(
        await call(path(connection) + '/state', {
          method: 'POST',
          body: { revision: connection.revision, state },
        }),
      ),
    rotate: async (connection) =>
      connectionIssuedSchema.parse(
        await call(path(connection) + '/rotate', {
          method: 'POST',
          body: { revision: connection.revision },
        }),
      ),
    endpoint,
    copyEndpoint: (connection) => copy(endpoint(connection)),
    copyUsername: (connection) => copy(connection.id),
    copyPassword: (connection) => copy(connection.password),
  };
}
