import type {
  ApiRequestDefinition,
  ExecutedResponse,
  ExecutionFailure,
  RequestTransport,
  ResolvedRequest,
  ScriptExecutionResult,
} from '@clouddrive/surface/api-workbench';
import { buildResolvedRequest } from './build-request';
import { runExtractors } from './extractors';
import { runScriptSandbox } from '../script/sandbox';

type Context = Readonly<{
  request: ResolvedRequest;
  envVars: Record<string, string>;
  globalVars: Record<string, string>;
  script: ScriptExecutionResult;
}>;
export type RequestOutcome = Context &
  (
    | Readonly<{ kind: 'response'; response: ExecutedResponse }>
    | Readonly<{ kind: 'failure'; failure: ExecutionFailure }>
    | Readonly<{ kind: 'skipped' }>
  );

/** Shared single-request / runner pipeline; no workspace or host state is changed here. */
export async function executeWorkbenchRequest(
  definition: ApiRequestDefinition,
  initialEnv: Record<string, string>,
  initialGlobals: Record<string, string>,
  transport: RequestTransport,
): Promise<RequestOutcome> {
  const envVars = { ...initialEnv };
  const globalVars = { ...initialGlobals };
  let request = buildResolvedRequest(definition, { ...globalVars, ...envVars });
  let script: ScriptExecutionResult = { tests: [], logs: [], setVariables: [] };
  const apply = (variables: ScriptExecutionResult['setVariables']) => {
    for (const variable of variables)
      (variable.scope === 'env' ? envVars : globalVars)[variable.key] = variable.value;
  };
  if (definition.preScript.trim()) {
    const pre = await runScriptSandbox(definition.preScript, {
      request: {
        headers: { ...request.headers },
        body: request.body,
        timeoutMs: request.timeoutMs,
      },
      envVariables: envVars,
      globalVariables: globalVars,
    });
    script = pre;
    apply(pre.setVariables);
    if (pre.skipped) return { kind: 'skipped', request, envVars, globalVars, script };
    if (pre.mutatedRequest)
      request = {
        ...request,
        headers: pre.mutatedRequest.headers,
        body: pre.mutatedRequest.body,
        timeoutMs: pre.mutatedRequest.timeoutMs ?? request.timeoutMs,
      };
  }
  const result = await transport.execute(request);
  if (!result.ok)
    return { kind: 'failure', failure: result.failure, request, envVars, globalVars, script };
  if (definition.postScript.trim()) {
    const post = await runScriptSandbox(definition.postScript, {
      response: result.response,
      envVariables: envVars,
      globalVariables: globalVars,
    });
    apply(post.setVariables);
    script = {
      tests: [...script.tests, ...post.tests],
      logs: [...script.logs, ...post.logs],
      setVariables: [...script.setVariables, ...post.setVariables],
    };
  }
  for (const variable of runExtractors(definition.extractors, result.response))
    (variable.scope === 'env' ? envVars : globalVars)[variable.key] = variable.value;
  return { kind: 'response', response: result.response, request, envVars, globalVars, script };
}
