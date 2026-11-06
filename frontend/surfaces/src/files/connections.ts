import { z } from 'zod';

export const connectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rootId: z.string(),
  rootPath: z.string(),
  readOnly: z.boolean(),
  blockSystemFiles: z.boolean(),
  status: z.enum(['active', 'disabled', 'revoked', 'expired', 'unavailable']),
  createdAt: z.string(),
  expiresAt: z.string(),
  revision: z.number().int().positive(),
  endpointPath: z.string().startsWith('/'),
  endpointOrigin: z.string().url(),
});
export const connectionIssuedSchema = connectionSchema.extend({
  password: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const connectionListingSchema = z.object({
  items: z.array(connectionSchema),
  nextCursor: z.string(),
  limit: z.number().int().positive().max(20),
  defaultAgeSeconds: z.number().int().positive(),
  maxAgeSeconds: z.number().int().positive(),
  metadataLimited: z.boolean(),
});
export type FileConnection = z.infer<typeof connectionSchema>;
export type ConnectionIssued = z.infer<typeof connectionIssuedSchema>;
export type ConnectionListing = z.infer<typeof connectionListingSchema>;
export type ConnectionInput = Readonly<{
  name: string;
  rootId: string;
  readOnly: boolean;
  blockSystemFiles: boolean;
  expiresAt?: string;
}>;
export type ConnectionChange = Readonly<{
  name?: string;
  readOnly?: boolean;
  blockSystemFiles?: boolean;
}>;
export type ConnectionState = 'active' | 'disabled' | 'revoked';

export const writeLockSchema = z.object({
  id: z.string().uuid(),
  path: z.string().startsWith('/'),
  connectionId: z.string().uuid(),
  depth: z.enum(['0', 'infinity']),
  expiresAt: z.string().datetime(),
  revision: z.number().int().positive(),
});
export const writeLockListingSchema = z.object({ items: z.array(writeLockSchema).max(100) });
export const writeLockReleaseSchema = z.object({ released: z.literal(true) });
export type FileWriteLock = z.infer<typeof writeLockSchema>;

export type ConnectionsPort = Readonly<{
  listWriteLocks(signal?: AbortSignal): Promise<readonly FileWriteLock[]>;
  releaseWriteLock(lock: FileWriteLock, signal?: AbortSignal): Promise<void>;
  list(cursor?: string, signal?: AbortSignal): Promise<ConnectionListing>;
  read(connection: FileConnection): Promise<FileConnection>;
  create(input: ConnectionInput): Promise<ConnectionIssued>;
  update(connection: FileConnection, change: ConnectionChange): Promise<FileConnection>;
  setState(connection: FileConnection, state: ConnectionState): Promise<FileConnection>;
  rotate(connection: FileConnection): Promise<ConnectionIssued>;
  endpoint(connection: FileConnection): string;
  copyEndpoint(connection: FileConnection): Promise<void>;
  copyUsername(connection: FileConnection): Promise<void>;
  copyPassword(connection: ConnectionIssued): Promise<void>;
}>;
