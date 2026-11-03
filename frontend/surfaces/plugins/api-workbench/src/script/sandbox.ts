import type {
  ExecutedResponse,
  ScriptExecutionResult,
  TestResult,
} from '@clouddrive/surface/api-workbench';
import { createExpectation } from '../model/assertions';
import {
  base64Decode,
  base64Encode,
  hmacSha256,
  md5,
  sha256,
  timestamp,
  uuid,
} from '../model/crypto';

export type SandboxContext = {
  request?:
    | {
        headers: Record<string, string>;
        body?: string | undefined;
        skipped?: boolean | undefined;
        timeoutMs?: number | undefined;
      }
    | undefined;
  response?: ExecutedResponse | undefined;
  envVariables: Record<string, string>;
  globalVariables: Record<string, string>;
};

export async function runScriptSandbox(
  code: string,
  context: SandboxContext,
): Promise<ScriptExecutionResult & { mutatedRequest?: SandboxContext['request'] }> {
  if (!code || !code.trim()) {
    return {
      tests: [],
      logs: [],
      setVariables: [],
    };
  }

  const tests: TestResult[] = [];
  const logs: string[] = [];
  const setVariables: { key: string; value: string; scope: 'env' | 'global' }[] = [];
  let skipped = false;

  const currentRequest = context.request
    ? {
        headers: { ...context.request.headers },
        body: context.request.body,
        timeoutMs: context.request.timeoutMs,
      }
    : undefined;

  const toapi = {
    request: {
      setHeader(key: string, value: string) {
        if (currentRequest) {
          currentRequest.headers[key] = value;
        }
      },
      setBody(body: string) {
        if (currentRequest) {
          currentRequest.body = body;
        }
      },
      skip() {
        skipped = true;
      },
    },

    response: context.response
      ? {
          status: context.response.status,
          statusText: context.response.statusText,
          durationMs: context.response.durationMs,
          sizeBytes: context.response.sizeBytes,
          headers: Object.fromEntries(context.response.headers),
          body: context.response.body,
        }
      : undefined,

    vars: {
      get(key: string) {
        return context.envVariables[key] ?? context.globalVariables[key];
      },
      set(key: string, value: string) {
        setVariables.push({ key, value: String(value), scope: 'env' });
      },
    },

    env: {
      get(key: string) {
        return context.envVariables[key];
      },
      set(key: string, value: string) {
        setVariables.push({ key, value: String(value), scope: 'env' });
      },
    },

    globals: {
      get(key: string) {
        return context.globalVariables[key];
      },
      set(key: string, value: string) {
        setVariables.push({ key, value: String(value), scope: 'global' });
      },
    },

    fake: {
      ua(userAgent: string) {
        if (currentRequest) {
          currentRequest.headers['User-Agent'] = userAgent;
        }
      },
      header(key: string, value: string) {
        if (currentRequest) {
          currentRequest.headers[key] = value;
        }
      },
      proxy(proxyUrl?: string) {
        if (proxyUrl) {
          logs.push(`[toapi.fake.proxy] Mock notice: proxy ${proxyUrl} requires backend relay`);
        } else {
          logs.push('[toapi.fake.proxy] Mock notice: proxy requires backend relay');
        }
      },
      timeout(ms: number) {
        if (currentRequest) {
          currentRequest.timeoutMs = ms;
        }
      },
    },

    test(title: string, fn: () => void | Promise<void>) {
      try {
        const result = fn();
        if (result instanceof Promise) {
          result
            .then(() => tests.push({ title, passed: true }))
            .catch((err: unknown) =>
              tests.push({
                title,
                passed: false,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
        } else {
          tests.push({ title, passed: true });
        }
      } catch (err) {
        tests.push({
          title,
          passed: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },

    expect: createExpectation,
    md5,
    sha256,
    hmacSha256,
    base64Encode,
    base64Decode,
    uuid,
    timestamp,
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  };

  const formatArg = (a: unknown): string => {
    if (typeof a === 'string') return a;
    if (typeof a === 'number' || typeof a === 'boolean') return String(a);
    return JSON.stringify(a);
  };

  const sandboxConsole = {
    log: (...args: unknown[]) => logs.push(args.map(formatArg).join(' ')),
    warn: (...args: unknown[]) => logs.push('[WARN] ' + args.map(formatArg).join(' ')),
    error: (...args: unknown[]) => logs.push('[ERROR] ' + args.map(formatArg).join(' ')),
  };

  try {
    type ScriptRunner = (toapiContext: unknown, consoleContext: unknown) => Promise<void>;
    const asyncProto = Object.getPrototypeOf(async () => {}) as unknown as {
      readonly constructor: new (...args: string[]) => ScriptRunner;
    };
    const runner = new asyncProto.constructor('toapi', 'console', code);
    await runner(toapi, sandboxConsole);
  } catch (err) {
    tests.push({
      title: 'Script Execution Error',
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    tests,
    logs,
    setVariables,
    skipped,
    mutatedRequest: currentRequest,
  };
}
