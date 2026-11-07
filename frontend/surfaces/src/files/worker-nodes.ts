import { z } from 'zod';

export const workerNodeIdPattern = /^[a-z0-9_-]{1,64}$/;
const capability = z.object({
  kind: z.enum(['zip', 'extract', 'http', 'trash-expiry', 'blob-reclaim']),
  enabled: z.boolean(),
});
const node = z.object({
  id: z.string().regex(workerNodeIdPattern),
  name: z.string(),
  dispatchEnabled: z.boolean(),
  concurrency: z.number().int().positive(),
  reservedBytes: z.number().int().positive(),
});
export const workerNodeCatalogSchema = z.object({
  local: z.array(capability),
  nodes: z.array(node).max(4),
  canReadTasks: z.boolean(),
});
const counter = z.number().int().nonnegative();
export const workerNodeCheckSchema = z.object({
  version: z.string(),
  checkedAt: z.string(),
  downloadBytesPerSecond: counter,
  uploadBytesPerSecond: counter,
  active: counter,
  waiting: counter,
  stopped: counter,
});
export type WorkerNode = z.infer<typeof node>;
export type WorkerNodeCatalog = z.infer<typeof workerNodeCatalogSchema>;
export type WorkerNodeCheck = z.infer<typeof workerNodeCheckSchema>;
