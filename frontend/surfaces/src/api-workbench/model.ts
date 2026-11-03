/**
 * API Workbench —— Shared Surface Model & Port Contract.
 *
 * Provides a clean abstraction boundary:
 * - Mock Mode: browser fetch + IndexedDB + local in-memory Mock Server routes + tab-session tasks
 * - Backend Mode: backend workspace API + HTTP relay (no CORS restriction) + daemon tasks
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type KeyValueEntry = Readonly<{
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string | undefined;
}>;

export type RequestAuth =
  | Readonly<{ type: 'none' }>
  | Readonly<{ type: 'bearer'; token: string }>
  | Readonly<{ type: 'basic'; username: string; password: string }>
  | Readonly<{ type: 'api-key'; key: string; value: string; in: 'header' | 'query' }>;

export type RequestBody =
  | Readonly<{ type: 'none' }>
  | Readonly<{ type: 'json' | 'text' | 'xml'; content: string }>
  | Readonly<{ type: 'form-urlencoded' | 'form-data'; entries: readonly KeyValueEntry[] }>;

export type RequestDisguise = Readonly<{
  timeoutMs: number;
  userAgent?: string | undefined;
  proxy?: string | undefined;
  fingerprint?: string | undefined;
}>;

export type ExtractorSource = 'body-json' | 'header' | 'status';

export type Extractor = Readonly<{
  id: string;
  variable: string;
  source: ExtractorSource;
  expression: string;
  scope: 'env' | 'global';
}>;

export type ApiRequestDefinition = Readonly<{
  id: string;
  collectionId: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: readonly KeyValueEntry[];
  headers: readonly KeyValueEntry[];
  auth: RequestAuth;
  body: RequestBody;
  disguise: RequestDisguise;
  extractors: readonly Extractor[];
  preScript: string;
  postScript: string;
}>;

export type ApiCollection = Readonly<{
  id: string;
  projectId: string;
  name: string;
}>;

export type ApiProject = Readonly<{
  id: string;
  name: string;
}>;

export type ApiEnvironment = Readonly<{
  id: string;
  name: string;
  variables: readonly KeyValueEntry[];
}>;

export type ExecutedResponse = Readonly<{
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  headers: readonly (readonly [string, string])[];
  body: string;
}>;

export type ExecutionFailureKind =
  'network' | 'cors' | 'timeout' | 'aborted' | 'invalid-url' | 'unsupported';

export type ExecutionFailure = Readonly<{
  kind: ExecutionFailureKind;
  message?: string | undefined;
  details?: string | undefined;
}>;

export type ExecutionResult =
  | Readonly<{ ok: true; response: ExecutedResponse }>
  | Readonly<{ ok: false; failure: ExecutionFailure }>;

export type ResolvedRequest = Readonly<{
  method: HttpMethod;
  url: string;
  headers: Readonly<Record<string, string>>;
  body?: string | undefined;
  timeoutMs: number;
  disguise?: RequestDisguise | undefined;
}>;

export type TestResult = Readonly<{
  title: string;
  passed: boolean;
  error?: string | undefined;
}>;

export type ScriptExecutionResult = Readonly<{
  tests: readonly TestResult[];
  logs: readonly string[];
  setVariables: readonly Readonly<{ key: string; value: string; scope: 'env' | 'global' }>[];
  skipped?: boolean | undefined;
}>;

export type TaskDefinition = Readonly<{
  id: string;
  name: string;
  targetCollectionId: string;
  cronOrInterval: string;
  enabled: boolean;
  lastRun?:
    | Readonly<{
        time: string;
        passed: boolean;
        message: string;
      }>
    | undefined;
}>;

export type RequestHistoryItem = Readonly<{
  id: string;
  requestId: string;
  timestamp: string;
  method: HttpMethod;
  url: string;
  status: number;
  durationMs: number;
  sizeBytes: number;
  /** Original configuration, before variable interpolation. Absent in legacy v1 records. */
  request?: ApiRequestDefinition | undefined;
  environmentId?: string | undefined;
}>;

export type ApiWorkbenchCapabilities = Readonly<{
  mode: 'mock' | 'backend';
  disguise: boolean;
  corsFree: boolean;
  persistentTasks: boolean;
}>;

export type WorkspaceSnapshot = Readonly<{
  version: 1;
  projects: readonly ApiProject[];
  collections: readonly ApiCollection[];
  requests: readonly ApiRequestDefinition[];
  environments: readonly ApiEnvironment[];
  activeEnvironmentId?: string | undefined;
  globals: readonly KeyValueEntry[];
  tasks: readonly TaskDefinition[];
  history: readonly RequestHistoryItem[];
}>;

export type WorkspaceRepository = Readonly<{
  load: () => Promise<WorkspaceSnapshot>;
  save: (snapshot: WorkspaceSnapshot) => Promise<void>;
  clearHistory: () => Promise<void>;
  getUsage: () => Promise<Readonly<{ dbSizeFormatted: string; count: number }>>;
}>;

export type RequestTransport = Readonly<{
  execute: (req: ResolvedRequest, signal?: AbortSignal) => Promise<ExecutionResult>;
}>;

export type TaskScheduler = Readonly<{
  list: () => Promise<readonly TaskDefinition[]>;
  upsert: (task: TaskDefinition) => Promise<void>;
  remove: (id: string) => Promise<void>;
}>;

export type ApiWorkbenchPort = Readonly<{
  capabilities: ApiWorkbenchCapabilities;
  workspace: WorkspaceRepository;
  transport: RequestTransport;
  tasks: TaskScheduler;
  transfer: Readonly<{
    selectWorkspace: () => Promise<string | null>;
    exportWorkspace: (snapshot: WorkspaceSnapshot) => Promise<void>;
    copyResponse: (body: string) => Promise<void>;
  }>;
}>;
