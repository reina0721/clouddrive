'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import {
  safeParseWorkspaceSnapshot,
  useApiWorkbenchPort,
  type KeyValueEntry,
  type WorkspaceSnapshot,
} from '@clouddrive/surface/api-workbench';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { TabsView, type TabsViewItem } from '@clouddrive/ui-adapter/data-display';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { ConfirmDialog, DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { useContainerBreakpoint } from '@clouddrive/ui-adapter/container-layout';
import { AlertCircle, Send } from 'lucide-react';
import { resolveVariableMap } from '../model/interpolate';
import { historyRequestSnapshot } from '../model/history';
import { executeWorkbenchRequest } from '../model/execute-request';
import {
  createRequest,
  mergeExecutionVariables,
  removeWorkspaceEntity,
} from '../model/workspace-actions';
import { useWorkbenchStore } from '../../stores/workbench';
import { EnvironmentDrawer, type EnvironmentSection } from './environment-drawer';
import { ProjectTree } from './project-tree';
import { RequestBar } from './request-bar';
import { RequestTabs } from './request-tabs';
import { ResponseView } from './response-view';
import { RunnerView } from './runner-view';
import { WorkbenchToolbar } from './status-bar';
import { TasksView } from './tasks-view';
import { useWorkbenchFormat } from './use-workbench-format';
const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const emptyEntries: readonly KeyValueEntry[] = [];

export function Workbench() {
  const { t } = useFrontendTranslation();
  const format = useWorkbenchFormat();
  const port = useApiWorkbenchPort();
  const feedback = useFeedback();
  const { ref: workspaceRef, matches: expanded } = useContainerBreakpoint('4xl');
  const { ref: treeWidthRef, matches: wide } = useContainerBreakpoint('7xl');
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const treeVisible = wide && !treeCollapsed;
  const snapshot = useWorkbenchStore((state) => state.snapshot);
  const setSnapshot = useWorkbenchStore((state) => state.setSnapshot);
  const draftRequest = useWorkbenchStore((state) => state.draftRequest);
  const drafts = useWorkbenchStore((state) => state.drafts);
  const historyDraftIds = useWorkbenchStore((state) => state.historyDraftIds);
  const dirty = useWorkbenchStore((state) => state.isDraftDirty);
  const unsavedTaskRun = useWorkbenchStore((state) => state.unsavedTaskRun);
  const selectedRequestId = useWorkbenchStore((state) => state.selectedRequestId);
  const updateDraft = useWorkbenchStore((state) => state.updateDraft);
  const selectRequest = useWorkbenchStore((state) => state.selectRequest);
  const activeRightTab = useWorkbenchStore((state) => state.activeRightTab);
  const setActiveRightTab = useWorkbenchStore((state) => state.setActiveRightTab);
  const workspaceView = useWorkbenchStore((state) => state.activeWorkspaceView);
  const setWorkspaceView = useWorkbenchStore((state) => state.setActiveWorkspaceView);
  const lastResponse = useWorkbenchStore((state) => state.lastResponse);
  const lastFailure = useWorkbenchStore((state) => state.lastFailure);
  const lastScriptResult = useWorkbenchStore((state) => state.lastScriptResult);
  const isExecuting = useWorkbenchStore((state) => state.isExecuting);
  const setExecuting = useWorkbenchStore((state) => state.setExecuting);
  const setExecutionResult = useWorkbenchStore((state) => state.setExecutionResult);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [dbUsage, setDbUsage] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [writeCount, setWriteCount] = useState(0);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const executionGeneration = useRef(0);
  const [error, setError] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [envSection, setEnvSection] = useState<EnvironmentSection | null>(null);
  const [importCandidate, setImportCandidate] = useState<WorkspaceSnapshot | null>(null);
  const [pickingImport, setPickingImport] = useState(false);
  useRegisterDirtySource({
    pageId: 'api-workbench',
    isDirty: () => Object.keys(drafts).length > 0 || Boolean(unsavedTaskRun),
    isSubmitting: () => isSaving,
    message: () => t('apiWorkbench.workspace.dirtyLeave'),
  });

  useEffect(() => {
    let active = true;
    void port.workspace
      .load()
      .then((loaded) => {
        if (!active) return;
        setSnapshot(loaded, true);
        setLoadState('ready');
        void port.workspace
          .getUsage()
          .then((usage) => {
            if (active) setDbUsage(usage.dbSizeFormatted);
          })
          .catch(() => {
            if (active) setDbUsage(null);
          });
      })
      .catch(() => {
        if (active) setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [port, setSnapshot, loadAttempt]);

  const commit = async (
    change: (current: WorkspaceSnapshot) => WorkspaceSnapshot,
    replace = false,
  ) => {
    setWriteCount((count) => count + 1);
    const operation = writeQueue.current.then(async () => {
      const current = useWorkbenchStore.getState().snapshot;
      if (!current) throw new Error('Workspace unavailable');
      const next = change(current);
      if (port.capabilities.persistentTasks) {
        for (const task of current.tasks)
          if (!next.tasks.some((item) => item.id === task.id)) await port.tasks.remove(task.id);
        for (const task of next.tasks)
          if (
            JSON.stringify(task) !==
            JSON.stringify(current.tasks.find((item) => item.id === task.id))
          )
            await port.tasks.upsert(task);
      }
      await port.workspace.save(next);
      setSnapshot(next, replace);
      void port.workspace
        .getUsage()
        .then((usage) => setDbUsage(usage.dbSizeFormatted))
        .catch(() => setDbUsage(null));
    });
    writeQueue.current = operation.catch(() => undefined);
    try {
      await operation;
      setError(false);
    } catch (failure) {
      setError(true);
      throw failure;
    } finally {
      setWriteCount((count) => count - 1);
    }
  };
  const reportSaveFailure = () =>
    feedback.notify({ title: t('apiWorkbench.feedback.saveFailed'), tone: 'danger' });
  const save = async () => {
    const state = useWorkbenchStore.getState();
    const candidate = state.prepareDraftSave();
    const request = candidate?.requests.find((item) => item.id === state.selectedRequestId);
    if (!request || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await commit((current) => ({
        ...current,
        requests: current.requests.some((item) => item.id === request.id)
          ? current.requests.map((item) => (item.id === request.id ? request : item))
          : [...current.requests, request],
      }));
      feedback.notify({ title: t('apiWorkbench.feedback.saved'), tone: 'success' });
    } catch {
      reportSaveFailure();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const activeEnv = snapshot?.environments.find((env) => env.id === snapshot.activeEnvironmentId);
  const envVars = activeEnv?.variables ?? emptyEntries;
  const globalVars = snapshot?.globals ?? emptyEntries;
  const envMap = resolveVariableMap(envVars, []);
  const globalMap = resolveVariableMap([], globalVars);

  const send = async () => {
    const state = useWorkbenchStore.getState();
    const request = state.draftRequest;
    if (!request || !request.url.trim() || state.isExecuting) return;
    const generation = executionGeneration.current;
    setExecuting(true);
    try {
      const result = await executeWorkbenchRequest(request, envMap, globalMap, port.transport);
      if (executionGeneration.current !== generation) return;
      setExecutionResult({
        requestId: request.id,
        ...(result.kind === 'response'
          ? { response: result.response }
          : result.kind === 'failure'
            ? { failure: result.failure }
            : {}),
        script: result.script,
      });
      await commit((current) => ({
        ...current,
        environments: current.environments.map((env) =>
          env.id === activeEnv?.id
            ? { ...env, variables: mergeExecutionVariables(env.variables, envMap, result.envVars) }
            : env,
        ),
        globals: mergeExecutionVariables(current.globals, globalMap, result.globalVars),
        history:
          result.kind === 'response'
            ? [
                {
                  id: newId('history'),
                  requestId: request.id,
                  request: historyRequestSnapshot(request),
                  environmentId: activeEnv?.id,
                  timestamp: new Date().toISOString(),
                  method: result.request.method,
                  url: result.request.url,
                  status: result.response.status,
                  durationMs: result.response.durationMs,
                  sizeBytes: result.response.sizeBytes,
                },
                ...current.history,
              ].slice(0, 50)
            : current.history,
      })).catch(() => reportSaveFailure());
    } catch {
      setExecutionResult({
        requestId: request.id,
        failure: { kind: 'unsupported', message: t('apiWorkbench.feedback.executionFailed') },
      });
    } finally {
      setExecuting(false);
    }
  };
  const pickImport = async () => {
    setPickingImport(true);
    try {
      const text = await port.transfer.selectWorkspace();
      if (text === null) return;
      const parsed: unknown = JSON.parse(text);
      const result = safeParseWorkspaceSnapshot(parsed);
      if (!result.success) throw new Error('Invalid workspace');
      setImportCandidate(result.data);
    } catch {
      feedback.notify({ title: t('apiWorkbench.feedback.importFailed'), tone: 'danger' });
    } finally {
      setPickingImport(false);
    }
  };
  const projectTree = (
    <ProjectTree
      projects={snapshot?.projects ?? []}
      collections={snapshot?.collections ?? []}
      requests={snapshot?.requests ?? []}
      selectedRequestId={selectedRequestId}
      onSelectRequest={(id) => {
        selectRequest(id);
        setProjectsOpen(false);
      }}
      onCreateProject={async (name) => {
        const project = { id: newId('project'), name };
        await commit((current) => ({ ...current, projects: [...current.projects, project] }));
      }}
      onCreateCollection={async (projectId, name) => {
        const collection = { id: newId('collection'), projectId, name };
        await commit((current) => ({
          ...current,
          collections: [...current.collections, collection],
        }));
      }}
      onCreateRequest={async (collectionId, name) => {
        const request = createRequest(newId('request'), collectionId, name);
        await commit((current) => ({ ...current, requests: [...current.requests, request] }));
        selectRequest(request.id);
        setProjectsOpen(false);
      }}
      onDelete={async (kind, id) => {
        await commit((current) => removeWorkspaceEntity(current, kind, id));
      }}
    />
  );
  const editor = draftRequest ? (
    <div className="grid min-w-0 gap-4">
      {historyDraftIds.includes(draftRequest.id) && (
        <p
          role="status"
          className="rounded-control border border-border bg-surface-inset p-3 text-sm text-ink-muted"
        >
          {t('apiWorkbench.response.historyHint')}
        </p>
      )}
      <RequestBar
        key={draftRequest.id}
        request={draftRequest}
        isExecuting={isExecuting}
        isSaving={isSaving}
        isDirty={dirty}
        baseUrl={envMap['baseUrl'] ?? globalMap['baseUrl'] ?? ''}
        onChange={updateDraft}
        onSend={() => void send()}
        onSave={() => void save()}
      />
      <RequestTabs key={`tabs-${draftRequest.id}`} request={draftRequest} onChange={updateDraft} />
    </div>
  ) : (
    <StateSurface
      compact
      state="empty"
      icon={<Send className="size-5" />}
      title={t('apiWorkbench.workspace.chooseRequest')}
      description={t('apiWorkbench.workspace.chooseRequestHint')}
      {...(!treeVisible
        ? {
            actionLabel: t('apiWorkbench.workspace.navigation'),
            onAction: () => setProjectsOpen(true),
          }
        : {})}
    />
  );
  const response = (
    <ResponseView
      response={lastResponse}
      failure={lastFailure}
      scriptResult={lastScriptResult}
      isExecuting={isExecuting}
      history={snapshot?.history ?? []}
      onClearHistory={async () => {
        await commit((current) => ({ ...current, history: [] }));
      }}
      onRestoreHistory={async (item) => {
        const current = useWorkbenchStore.getState().snapshot;
        const collectionId =
          current?.collections.find((collection) => collection.id === item.request?.collectionId)
            ?.id ?? current?.collections[0]?.id;
        if (!collectionId) {
          feedback.notify({
            title: t('apiWorkbench.response.restoreNeedsCollection'),
            tone: 'warning',
          });
          return;
        }
        const environmentId = current?.environments.find(
          (env) => env.id === item.environmentId,
        )?.id;
        await commit((snapshot) => ({ ...snapshot, activeEnvironmentId: environmentId }));
        useWorkbenchStore.getState().restoreHistoryDraft({
          ...(item.request ?? {
            ...createRequest('', collectionId, ''),
            method: item.method,
            url: item.url,
          }),
          id: newId('restored'),
          collectionId,
          name: [t('apiWorkbench.response.history'), item.request?.name ?? item.url].join(' · '),
        });
        if (item.environmentId && !environmentId)
          feedback.notify({
            title: t('apiWorkbench.response.environmentMissing'),
            tone: 'warning',
          });
      }}
    />
  );
  const runner = (
    <RunnerView
      collections={snapshot?.collections ?? []}
      requests={snapshot?.requests ?? []}
      transport={port.transport}
      envVars={envMap}
      globalVars={globalMap}
    />
  );
  const tasks = (
    <TasksView
      collections={snapshot?.collections ?? []}
      requests={snapshot?.requests ?? []}
      tasks={snapshot?.tasks ?? []}
      envVars={envMap}
      globalVars={globalMap}
      onTasksChange={async (nextTasks) => {
        await commit((current) => ({ ...current, tasks: nextTasks }));
      }}
    />
  );
  const rightItems: readonly TabsViewItem[] = [
    { id: 'response', label: t('apiWorkbench.views.response'), content: response },
    { id: 'runner', label: t('apiWorkbench.views.runner'), content: runner },
    { id: 'tasks', label: t('apiWorkbench.views.tasks'), content: tasks },
  ];
  return (
    <div
      ref={(node) => {
        workspaceRef.current = node;
        treeWidthRef.current = node;
      }}
      className="@container/workbench min-w-0"
      data-workbench-layout={expanded ? 'expanded' : 'compact'}
    >
      {loadState === 'loading' ? (
        <div className="grid min-w-0 gap-4" aria-label={t('apiWorkbench.workspace.loading')}>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : loadState === 'error' ? (
        <StateSurface
          state="error"
          icon={<AlertCircle className="size-5" />}
          title={t('apiWorkbench.workspace.loadFailed')}
          description={t('apiWorkbench.workspace.loadFailedHint')}
          actionLabel={t('apiWorkbench.common.retry')}
          onAction={() => {
            setLoadState('loading');
            setLoadAttempt((attempt) => attempt + 1);
          }}
        />
      ) : (
        <Panel
          aria-label={t('apiWorkbench.page.title')}
          appearance="outlined"
          className="min-w-0 overflow-hidden"
        >
          <WorkbenchToolbar
            environments={snapshot?.environments ?? []}
            activeEnvironmentId={snapshot?.activeEnvironmentId}
            dbUsage={dbUsage}
            projectsVisible={treeVisible}
            mode={port.capabilities.mode}
            pending={writeCount > 0 || pickingImport}
            hasDrafts={Object.keys(drafts).length > 0}
            historyDrafts={Object.values(drafts).filter((request) =>
              historyDraftIds.includes(request.id),
            )}
            onSelectHistoryDraft={selectRequest}
            onSelectEnvironment={(id) => {
              void commit((current) => ({ ...current, activeEnvironmentId: id })).catch(() =>
                reportSaveFailure(),
              );
            }}
            onOpenProjects={() => {
              if (treeVisible) setTreeCollapsed(true);
              else if (wide) setTreeCollapsed(false);
              else setProjectsOpen(true);
            }}
            onOpenEnvironments={() => setEnvSection('envs')}
            onOpenGlobals={() => setEnvSection('globals')}
            onImport={() => void pickImport()}
            onExport={() => {
              const current = useWorkbenchStore.getState().snapshot;
              if (current)
                void port.transfer
                  .exportWorkspace(current)
                  .then(() =>
                    feedback.notify({
                      title: t('apiWorkbench.feedback.exported'),
                      tone: 'success',
                    }),
                  )
                  .catch(() =>
                    feedback.notify({
                      title: t('apiWorkbench.feedback.exportFailed'),
                      tone: 'danger',
                    }),
                  );
            }}
          />
          {error && (
            <div className="p-4">
              <AlertBanner
                tone="danger"
                announcement="urgent"
                icon={<AlertCircle className="size-5" />}
                title={t('apiWorkbench.feedback.saveFailed')}
                description={t('apiWorkbench.common.failed')}
                dismissLabel={t('apiWorkbench.common.close')}
                onDismiss={() => setError(false)}
              />
            </div>
          )}
          {expanded ? (
            <div className="flex min-w-0">
              {treeVisible && (
                <div className="w-64 min-w-0 shrink-0 border-r border-border p-4">
                  <div className="max-h-160 overflow-y-auto">{projectTree}</div>
                </div>
              )}
              <div className="grid min-w-0 flex-1 grid-cols-2 items-start">
                <div className="min-w-0 p-4">{editor}</div>
                <div className="min-w-0 self-stretch border-l border-border p-4">
                  <TabsView
                    label={t('apiWorkbench.workspace.view')}
                    items={rightItems}
                    selectedId={activeRightTab}
                    onSelectionChange={(id) => {
                      if (id === 'response' || id === 'runner' || id === 'tasks')
                        setActiveRightTab(id);
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-0 p-4">
              <TabsView
                label={t('apiWorkbench.workspace.view')}
                items={[
                  { id: 'request', label: t('apiWorkbench.workspace.request'), content: editor },
                  ...rightItems,
                ]}
                selectedId={workspaceView}
                onSelectionChange={(id) => {
                  if (id === 'request' || id === 'response' || id === 'runner' || id === 'tasks')
                    setWorkspaceView(id);
                }}
              />
            </div>
          )}
          {expanded && dbUsage && (
            <footer className="border-t border-border px-4 py-3 text-xs text-ink-muted">
              {t('apiWorkbench.workspace.storage', { size: dbUsage })}
            </footer>
          )}
        </Panel>
      )}
      {!treeVisible && (
        <DrawerSurface
          isOpen={projectsOpen}
          onOpenChange={setProjectsOpen}
          triggerLabel={t('apiWorkbench.workspace.navigation')}
          title={t('apiWorkbench.workspace.navigation')}
          description={t('apiWorkbench.workspace.navigationHint')}
          closeLabel={t('apiWorkbench.common.close')}
          placement="left"
          composition="navigation"
        >
          <div className="p-4">{projectTree}</div>
        </DrawerSurface>
      )}

      {envSection && (
        <EnvironmentDrawer
          key={envSection}
          section={envSection}
          environments={snapshot?.environments ?? []}
          globals={snapshot?.globals ?? []}
          activeEnvironmentId={snapshot?.activeEnvironmentId}
          onClose={() => setEnvSection(null)}
          onSave={async (environments, globals) => {
            await commit((current) => ({
              ...current,
              environments,
              globals,
              activeEnvironmentId: environments.some(
                (env) => env.id === current.activeEnvironmentId,
              )
                ? current.activeEnvironmentId
                : environments[0]?.id,
            }));
            setEnvSection(null);
            feedback.notify({ title: t('apiWorkbench.feedback.saved'), tone: 'success' });
          }}
        />
      )}
      <ConfirmDialog
        isOpen={importCandidate !== null}
        onOpenChange={(open) => {
          if (!open) setImportCandidate(null);
        }}
        triggerLabel={t('apiWorkbench.workspace.importTitle')}
        title={t('apiWorkbench.workspace.importTitle')}
        description={t('apiWorkbench.workspace.importDescription')}
        impact={t('apiWorkbench.workspace.importSummary', {
          projects: format.count(importCandidate?.projects.length ?? 0),
          collections: format.count(importCandidate?.collections.length ?? 0),
          requests: format.count(importCandidate?.requests.length ?? 0),
        })}
        cancelLabel={t('apiWorkbench.common.cancel')}
        confirmLabel={t('apiWorkbench.workspace.importConfirm')}
        failureMessage={t('apiWorkbench.feedback.saveFailed')}
        onConfirm={async () => {
          if (importCandidate) {
            executionGeneration.current += 1;
            await commit(() => importCandidate, true);
          }
          setImportCandidate(null);
          feedback.notify({ title: t('apiWorkbench.sidebar.importSuccess'), tone: 'success' });
        }}
      />
    </div>
  );
}
