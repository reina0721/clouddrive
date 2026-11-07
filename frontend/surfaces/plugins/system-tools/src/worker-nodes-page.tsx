'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstant } from '@clouddrive/i18n/format';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { formatFileBytes } from '../../../src/files/format';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import type { WorkerNode } from '../../../src/files/worker-nodes';
import type { Preferences } from '../../../src/preferences-model';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';

const zh = {
  description: '查看主机的文件任务职责、已接入的下载节点和通信状态。',
  local: '主机',
  nodes: 'BitTorrent 下载节点',
  empty: '当前部署尚未配置 BitTorrent 下载节点。',
  enabled: '已启用',
  disabled: '已关闭',
  dispatch: '任务分派',
  concurrency: '任务并发上限',
  reservation: '暂存预算',
  check: '检查连接',
  checking: '正在检查节点连接…',
  available: '连接正常',
  incompatible: '节点未通过兼容性检查。',
  failed: '无法完成节点连接检查。',
  version: 'aria2 版本',
  checked: '检查时间',
  download: '下载速率',
  upload: '上传速率',
  active: '进行中',
  waiting: '等待',
  stopped: '已停止',
  tasks: '查看关联任务',
  global: '统计包含此 aria2 实例的全部任务。',
  kinds: {
    zip: '创建 ZIP',
    extract: '解压',
    http: 'HTTP 离线下载',
    'trash-expiry': '回收站到期扫描',
    'blob-reclaim': '定时 Blob 回收',
  },
};
const en: typeof zh = {
  description: 'Inspect local file tasks, configured download nodes and node connectivity.',
  local: 'Local host',
  nodes: 'BitTorrent download nodes',
  empty: 'This deployment has no configured BitTorrent download nodes.',
  enabled: 'Enabled',
  disabled: 'Disabled',
  dispatch: 'Task dispatch',
  concurrency: 'Concurrent task limit',
  reservation: 'Staging budget',
  check: 'Check connection',
  checking: 'Checking the node connection…',
  available: 'Connected',
  incompatible: 'The node did not pass the compatibility check.',
  failed: 'The node connection check could not be completed.',
  version: 'aria2 version',
  checked: 'Checked at',
  download: 'Download speed',
  upload: 'Upload speed',
  active: 'Active',
  waiting: 'Waiting',
  stopped: 'Stopped',
  tasks: 'View associated tasks',
  global: 'Statistics include all tasks in this aria2 instance.',
  kinds: {
    zip: 'Create ZIP',
    extract: 'Extract archives',
    http: 'HTTP offline download',
    'trash-expiry': 'Trash expiry scan',
    'blob-reclaim': 'Scheduled Blob reclamation',
  },
};

function NodeFields({ fields }: { fields: readonly (readonly [string, string | number])[] }) {
  return (
    <dl className="space-y-2 text-sm">
      {fields.map(([name, value]) => (
        <div className="flex flex-wrap justify-between gap-2" key={name}>
          <dt className="text-ink-muted">{name}</dt>
          <dd className="break-all font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NodeCheck({ id, labels }: { id: string; labels: typeof zh }) {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  const check = useCatalogRequest(
    useCallback((signal) => files.checkWorkerNode(id, signal), [files, id]),
  );
  if (!check.result) return <p role="status">{labels.checking}</p>;
  if ('error' in check.result) {
    const error = check.result.error;
    const message =
      error instanceof FilesError && error.code === 'invalid' ? labels.incompatible : labels.failed;
    return (
      <div className="space-y-2">
        <p role="alert">{message}</p>
        <Action variant="secondary" onPress={check.refresh}>
          {t('administration.retry')}
        </Action>
      </div>
    );
  }
  const result = check.result.value;
  return (
    <div className="space-y-2">
      <p role="status" className="font-medium">
        {labels.available}
      </p>
      <NodeFields
        fields={[
          [labels.version, result.version],
          [labels.checked, formatInstant(locale, region, result.checkedAt)],
          [labels.download, formatFileBytes(result.downloadBytesPerSecond) + '/s'],
          [labels.upload, formatFileBytes(result.uploadBytesPerSecond) + '/s'],
          [labels.active, result.active],
          [labels.waiting, result.waiting],
          [labels.stopped, result.stopped],
        ]}
      />
      <p className="text-sm text-ink-muted">{labels.global}</p>
      <Action variant="secondary" onPress={check.refresh}>
        {labels.check}
      </Action>
    </div>
  );
}

function WorkerCard({
  node,
  labels,
  canReadTasks,
}: {
  node: WorkerNode;
  labels: typeof zh;
  canReadTasks: boolean;
}) {
  const [checking, setChecking] = useState(false);
  return (
    <Panel aria-label={node.name} className="min-w-0 space-y-4 p-4" appearance="outlined">
      <header>
        <h2 className="break-all font-semibold">{node.name}</h2>
        <p className="text-sm text-ink-muted">{labels.nodes}</p>
        <p className="break-all text-sm text-ink-muted">{node.id}</p>
      </header>
      <NodeFields
        fields={[
          [labels.dispatch, node.dispatchEnabled ? labels.enabled : labels.disabled],
          [labels.concurrency, node.concurrency],
          [labels.reservation, formatFileBytes(node.reservedBytes)],
        ]}
      />
      {checking ? (
        <NodeCheck id={node.id} labels={labels} />
      ) : (
        <Action variant="secondary" onPress={() => setChecking(true)}>
          {labels.check}
        </Action>
      )}
      {canReadTasks ? (
        <div>
          <Link
            className="text-sm font-medium text-brand underline"
            href={'/system-tools/tasks?nodeId=' + encodeURIComponent(node.id)}
          >
            {labels.tasks}
          </Link>
        </div>
      ) : null}
    </Panel>
  );
}

export function WorkerNodesPage() {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const state = useCatalogRequest(useCallback((signal) => files.listWorkerNodes(signal), [files]));
  const catalog = state.result && 'value' in state.result ? state.result.value : undefined;
  return (
    <Page>
      <PageHeader
        title={t('systemTools.nav.nodes')}
        description={labels.description}
        actions={
          <Action variant="secondary" onPress={state.refresh}>
            {t('files.refresh')}
          </Action>
        }
      />
      {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
      {state.result && 'error' in state.result ? (
        <CatalogFailure error={state.result.error} retry={state.refresh} />
      ) : null}
      {catalog ? (
        <div className="space-y-4">
          <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Panel
              aria-label={labels.local}
              className="min-w-0 space-y-2 p-4"
              appearance="outlined"
            >
              <h2 className="font-semibold">{labels.local}</h2>
              <NodeFields
                fields={catalog.local.map(({ kind, enabled }) => [
                  labels.kinds[kind],
                  enabled ? labels.enabled : labels.disabled,
                ])}
              />
            </Panel>
            {catalog.nodes.map((node) => (
              <WorkerCard
                key={node.id}
                node={node}
                labels={labels}
                canReadTasks={catalog.canReadTasks}
              />
            ))}
          </div>
          {catalog.nodes.length === 0 ? (
            <p className="text-sm text-ink-muted">{labels.empty}</p>
          ) : null}
        </div>
      ) : null}
    </Page>
  );
}
