import {
  adminTaskKinds,
  adminTaskOrigins,
  type AdminTaskQuery,
} from '../../../src/files/admin-tasks';
import { backgroundTaskStatuses } from '../../../src/files/background-tasks';
import { maxInventoryPage } from '../../../src/files/inventory';

export const initialAdminTaskQuery: AdminTaskQuery = {
  ownerId: '',
  nodeId: '',
  taskId: '',
  kind: 'all',
  origin: 'all',
  status: 'all',
  sort: 'created',
  direction: 'desc',
  page: 1,
};

export function readAdminTaskQuery(params: URLSearchParams): AdminTaskQuery {
  const page = params.get('page');
  return {
    ownerId: params.get('ownerId') ?? '',
    nodeId: params.get('nodeId') ?? '',
    taskId: params.get('taskId') ?? '',
    kind: adminTaskKinds.find((value) => value === params.get('kind')) ?? 'all',
    origin: adminTaskOrigins.find((value) => value === params.get('origin')) ?? 'all',
    status: backgroundTaskStatuses.find((value) => value === params.get('status')) ?? 'all',
    sort: params.get('sort') === 'id' ? 'id' : 'created',
    direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
    page: page && /^[1-9]\d*$/.test(page) && Number(page) <= maxInventoryPage ? Number(page) : 1,
  };
}

export function adminTaskQueryHref(query: AdminTaskQuery): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(initialAdminTaskQuery) as (keyof AdminTaskQuery)[]) {
    if (query[key] !== initialAdminTaskQuery[key]) params.set(key, String(query[key]));
  }
  return '/system-tools/tasks' + (params.size ? '?' + params.toString() : '');
}
