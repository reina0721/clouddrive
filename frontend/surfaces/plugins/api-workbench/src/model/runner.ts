import type {
  ApiRequestDefinition,
  HttpMethod,
  RequestTransport,
  TestResult,
} from '@clouddrive/surface/api-workbench';
import { executeWorkbenchRequest } from './execute-request';

export type RunnerItemResult = {
  requestId: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  status?: number;
  durationMs: number;
  passed: boolean;
  tests: readonly TestResult[];
  error?: string;
  skipped?: boolean;
};

export type RunnerBatchResult = {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  items: readonly RunnerItemResult[];
};

export async function runCollectionBatch(
  requests: readonly ApiRequestDefinition[],
  initialEnvVars: Record<string, string>,
  initialGlobalVars: Record<string, string>,
  transport: RequestTransport,
  onStep?: (item: RunnerItemResult, index: number, total: number) => void,
): Promise<RunnerBatchResult> {
  const started = Date.now();
  let env = { ...initialEnvVars };
  let globals = { ...initialGlobalVars };
  const items: RunnerItemResult[] = [];
  for (const [index, request] of requests.entries()) {
    const result = await executeWorkbenchRequest(request, env, globals, transport);
    env = result.envVars;
    globals = result.globalVars;
    const base = {
      requestId: request.id,
      requestName: request.name,
      method: request.method,
      url: result.request.url,
    };
    const item: RunnerItemResult =
      result.kind === 'response'
        ? {
            ...base,
            status: result.response.status,
            durationMs: result.response.durationMs,
            passed:
              result.response.status < 400 && result.script.tests.every((test) => test.passed),
            tests: result.script.tests,
          }
        : result.kind === 'skipped'
          ? { ...base, durationMs: 0, passed: true, skipped: true, tests: result.script.tests }
          : {
              ...base,
              durationMs: 0,
              passed: false,
              tests: result.script.tests,
              error: result.failure.message ?? result.failure.kind,
            };
    items.push(item);
    onStep?.(item, index + 1, requests.length);
  }
  return {
    total: requests.length,
    passed: items.filter((item) => item.passed && !item.skipped).length,
    failed: items.filter((item) => !item.passed).length,
    durationMs: Date.now() - started,
    items,
  };
}
