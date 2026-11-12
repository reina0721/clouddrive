import { z } from 'zod';

export const runtimeProbeSchema = z.object({ status: z.enum(['pass', 'fail']) });
export const runtimeBuildSchema = z.object({
  version: z.string(),
  commit: z.string(),
  buildTime: z.string(),
  goVersion: z.string(),
  dirty: z.boolean(),
});
export const runtimeMetadataSchema = z.object({
  configuration: z.array(z.object({ name: z.string(), value: z.string() })),
  capabilities: z.array(z.string()),
});
const count = z.number().int().nonnegative();
export const runtimeDiagnosticsSchema = z.object({
  started: z.boolean(),
  live: z.boolean(),
  ready: z.boolean(),
  processState: z.string(),
  generationState: z.string(),
  generation: count,
  phase: z.string(),
  activeRequests: count,
  activeConnections: count,
  authReady: z.boolean(),
  databaseReady: z.boolean(),
  cleanupRequired: z.boolean(),
  lastFailurePhase: z.string().optional(),
  lastFailureOwner: z.string().optional(),
  lastFailureType: z.string().optional(),
  telemetry: z.object({
    enabled: z.boolean(),
    ready: z.boolean(),
    queueDepth: count,
    droppedSpans: count,
    exportedSpans: count,
    lastErrorType: z.string().optional(),
  }),
  scheduler: z.object({ enabled: z.boolean() }),
  schedulerHealth: z.string(),
  messaging: z.object({ enabled: z.boolean() }),
  messagingHealth: z.string(),
  process: z.object({
    allocBytes: count,
    sysBytes: count,
    heapAllocBytes: count,
    numGoroutine: count,
    numGC: count,
    uptimeSeconds: z.number().nonnegative(),
  }),
  units: z
    .array(
      z.object({
        Owner: z.string(),
        Kind: z.enum(['participant', 'task']),
        Phase: z.string(),
        State: z.string(),
        ExitPolicy: z.string(),
        Attempt: count,
        LastErrorType: z.string(),
        Since: z.string().datetime(),
      }),
    )
    .optional(),
  since: z.string().datetime(),
});
export const runtimeMetricsSchema = z.object({
  items: z.array(z.object({ key: z.string(), value: z.number(), unit: z.string() })),
  asOf: z.string().datetime(),
});
export type RuntimeProbe = z.infer<typeof runtimeProbeSchema>;
export type RuntimeBuild = z.infer<typeof runtimeBuildSchema>;
export type RuntimeMetadata = z.infer<typeof runtimeMetadataSchema>;
export type RuntimeDiagnostics = z.infer<typeof runtimeDiagnosticsSchema>;
export type RuntimeMetrics = z.infer<typeof runtimeMetricsSchema>;

/** 运行信息分别读取，某项失败不抹去其余项；指标文本只在明确请求时读取。 */
export type RuntimePort = Readonly<{
  probe(kind: 'readiness' | 'liveness', signal?: AbortSignal): Promise<RuntimeProbe>;
  build(signal?: AbortSignal): Promise<RuntimeBuild>;
  metadata(signal?: AbortSignal): Promise<RuntimeMetadata>;
  diagnostics(signal?: AbortSignal): Promise<RuntimeDiagnostics>;
  metrics(signal?: AbortSignal): Promise<RuntimeMetrics>;
  metricsText(signal?: AbortSignal): Promise<string>;
}>;

export class RuntimeReadError extends Error {
  constructor(
    public readonly code:
      | 'unauthenticated'
      | 'forbidden'
      | 'network'
      | 'timeout'
      | 'protocol'
      | 'limit'
      | 'unavailable',
  ) {
    super(`Runtime: ${code}`);
    this.name = 'RuntimeReadError';
  }
}
