import { createAppStore } from '@clouddrive/state-foundation';
import type {
  ApiRequestDefinition,
  ExecutedResponse,
  ExecutionFailure,
  ScriptExecutionResult,
  TaskDefinition,
  WorkspaceSnapshot,
} from '@clouddrive/surface/api-workbench';
import type { RunnerBatchResult } from '../src/model/runner';

export type RightTab = 'response' | 'runner' | 'tasks';
export type RequestTab =
  'params' | 'headers' | 'auth' | 'disguise' | 'body' | 'extractors' | 'scripts';
export type ResponseSubtab = 'pretty' | 'raw' | 'headers' | 'history';
export type WorkspaceView = 'request' | RightTab;

const sameRequest = (left: ApiRequestDefinition, right: ApiRequestDefinition | undefined) =>
  JSON.stringify(left) === JSON.stringify(right);

export type WorkbenchStoreState = {
  snapshot: WorkspaceSnapshot | null;
  drafts: Readonly<Record<string, ApiRequestDefinition>>;
  historyDraftIds: readonly string[];
  restoreHistoryDraft: (request: ApiRequestDefinition) => void;
  activeWorkspaceView: WorkspaceView;
  setActiveWorkspaceView: (view: WorkspaceView) => void;
  selectedRequestId: string | null;
  activeRightTab: RightTab;
  activeRequestTab: RequestTab;
  activeResponseSubtab: ResponseSubtab;
  draftRequest: ApiRequestDefinition | null;
  isDraftDirty: boolean;
  lastResponse: ExecutedResponse | null;
  lastFailure: ExecutionFailure | null;
  lastScriptResult: ScriptExecutionResult | null;
  isExecuting: boolean;
  runningTaskId: string | null;
  unsavedTaskRun: TaskDefinition | null;
  setUnsavedTaskRun: (task: TaskDefinition | null) => void;
  setRunningTaskId: (id: string | null) => void;
  selectedCollectionIdForRunner: string | null;
  runnerState: {
    isRunning: boolean;
    currentProgress: number;
    total: number;
    result: RunnerBatchResult | null;
    error: boolean;
  };

  // Actions
  setSnapshot: (snapshot: WorkspaceSnapshot, replace?: boolean) => void;
  selectRequest: (id: string) => void;
  updateDraft: (patch: Partial<ApiRequestDefinition>) => void;
  setActiveRightTab: (tab: RightTab) => void;
  setActiveRequestTab: (tab: RequestTab) => void;
  setActiveResponseSubtab: (tab: ResponseSubtab) => void;
  setExecuting: (isExecuting: boolean) => void;
  setExecutionResult: (res: {
    requestId: string;
    response?: ExecutedResponse;
    failure?: ExecutionFailure;
    script?: ScriptExecutionResult;
  }) => void;
  setSelectedCollectionIdForRunner: (colId: string | null) => void;
  setRunnerState: (patch: Partial<WorkbenchStoreState['runnerState']>) => void;

  // Domain Actions (pure snapshot modifiers)
  prepareDraftSave: () => WorkspaceSnapshot | null;
};

export const useWorkbenchStore = createAppStore<WorkbenchStoreState>((set, get) => ({
  snapshot: null,
  drafts: {},
  historyDraftIds: [],
  restoreHistoryDraft: (request) =>
    set((state) => ({
      drafts: { ...state.drafts, [request.id]: request },
      historyDraftIds: [...state.historyDraftIds, request.id],
      selectedRequestId: request.id,
      draftRequest: request,
      isDraftDirty: true,
      activeWorkspaceView: 'request',
      lastResponse: null,
      lastFailure: null,
      lastScriptResult: null,
    })),
  activeWorkspaceView: 'request',
  setActiveWorkspaceView: (view) =>
    set({ activeWorkspaceView: view, ...(view === 'request' ? {} : { activeRightTab: view }) }),
  selectedRequestId: null,
  activeRightTab: 'response',
  activeRequestTab: 'params',
  activeResponseSubtab: 'pretty',
  draftRequest: null,
  isDraftDirty: false,
  lastResponse: null,
  lastFailure: null,
  lastScriptResult: null,
  isExecuting: false,
  runningTaskId: null,
  unsavedTaskRun: null,
  setUnsavedTaskRun: (unsavedTaskRun) => set({ unsavedTaskRun }),
  setRunningTaskId: (runningTaskId) => set({ runningTaskId }),
  selectedCollectionIdForRunner: null,
  runnerState: {
    isRunning: false,
    currentProgress: 0,
    total: 0,
    result: null,
    error: false,
  },

  setSnapshot: (snapshot, replace = false) => {
    const state = get();
    const drafts = replace
      ? {}
      : Object.fromEntries(
          Object.entries(state.drafts).filter(
            ([id, draft]) =>
              (state.historyDraftIds.includes(id) && !snapshot.requests.some((r) => r.id === id)) ||
              snapshot.requests.some((r) => r.id === id && !sameRequest(draft, r)),
          ),
        );
    const selectedRequestId =
      (!replace && state.historyDraftIds.includes(state.selectedRequestId ?? '')) ||
      snapshot.requests.some((r) => r.id === state.selectedRequestId)
        ? state.selectedRequestId
        : (snapshot.requests[0]?.id ?? null);
    const saved = snapshot.requests.find((r) => r.id === selectedRequestId);
    const draftRequest = selectedRequestId ? (drafts[selectedRequestId] ?? saved ?? null) : null;
    set({
      snapshot,
      historyDraftIds: replace
        ? []
        : state.historyDraftIds.filter((id) => !snapshot.requests.some((r) => r.id === id)),
      unsavedTaskRun:
        !replace && snapshot.tasks.some((task) => task.id === state.unsavedTaskRun?.id)
          ? state.unsavedTaskRun
          : null,
      drafts,
      selectedRequestId,
      draftRequest,
      isDraftDirty: Boolean(draftRequest && !sameRequest(draftRequest, saved)),
      selectedCollectionIdForRunner: snapshot.collections.some(
        (c) => c.id === state.selectedCollectionIdForRunner,
      )
        ? state.selectedCollectionIdForRunner
        : (snapshot.collections[0]?.id ?? null),
      ...(replace || selectedRequestId !== state.selectedRequestId
        ? {
            lastResponse: null,
            lastFailure: null,
            lastScriptResult: null,
            activeWorkspaceView: 'request' as const,
          }
        : {}),
    });
  },
  selectRequest: (id) => {
    const state = get();
    if (id === state.selectedRequestId) return;
    const saved = state.snapshot?.requests.find((r) => r.id === id);
    const draftRequest = state.drafts[id] ?? saved;
    if (!draftRequest) return;
    set({
      selectedRequestId: id,
      draftRequest,
      isDraftDirty: !sameRequest(draftRequest, saved),
      lastResponse: null,
      lastFailure: null,
      lastScriptResult: null,
      activeWorkspaceView: 'request',
    });
  },
  updateDraft: (patch) => {
    const state = get();
    if (!state.draftRequest) return;
    const draftRequest = { ...state.draftRequest, ...patch };
    const isDraftDirty = !sameRequest(
      draftRequest,
      state.snapshot?.requests.find((r) => r.id === draftRequest.id),
    );
    const drafts = { ...state.drafts };
    if (isDraftDirty) drafts[draftRequest.id] = draftRequest;
    else delete drafts[draftRequest.id];
    set({ draftRequest, drafts, isDraftDirty });
  },
  // Preparing a save never marks the draft saved. The caller commits after durable success.
  prepareDraftSave: () => {
    const { snapshot, draftRequest } = get();
    if (!snapshot || !draftRequest) return null;
    return {
      ...snapshot,
      requests: snapshot.requests.some((r) => r.id === draftRequest.id)
        ? snapshot.requests.map((r) => (r.id === draftRequest.id ? draftRequest : r))
        : [...snapshot.requests, draftRequest],
    };
  },
  setActiveRightTab: (activeRightTab) =>
    set({ activeRightTab, activeWorkspaceView: activeRightTab }),
  setActiveRequestTab: (activeRequestTab) => set({ activeRequestTab }),
  setActiveResponseSubtab: (activeResponseSubtab) => set({ activeResponseSubtab }),
  setExecuting: (isExecuting) =>
    set({
      isExecuting,
      ...(isExecuting
        ? {
            activeRightTab: 'response' as const,
            activeWorkspaceView: 'response' as const,
            lastResponse: null,
            lastFailure: null,
            lastScriptResult: null,
          }
        : {}),
    }),
  setExecutionResult: ({ requestId, response, failure, script }) => {
    set({
      isExecuting: false,
      ...(get().selectedRequestId === requestId
        ? {
            lastResponse: response ?? null,
            lastFailure: failure ?? null,
            lastScriptResult: script ?? null,
            activeRightTab: 'response' as const,
            activeWorkspaceView: 'response' as const,
            activeResponseSubtab: response ? ('pretty' as const) : ('raw' as const),
          }
        : {}),
    });
  },
  setSelectedCollectionIdForRunner: (selectedCollectionIdForRunner) =>
    set({ selectedCollectionIdForRunner }),
  setRunnerState: (patch) => set((state) => ({ runnerState: { ...state.runnerState, ...patch } })),
}));
