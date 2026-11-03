import { createLocalStorage, createPersistStore } from '@clouddrive/state-foundation';

import {
  createDemoDepartments,
  departmentDeleteBlocker,
  newDepartmentId,
  parseDepartmentsPersisted,
  validateDepartmentDraft,
  type DepartmentDraft,
  type DepartmentNode,
  type DepartmentsPersisted,
  type DepartmentIssues,
} from '../src/department-model';

/**
 * departments 插件私有 store（surfaces/plugins/departments/stores）。
 *
 * 本地演示业务数据（无后端）；每个节点带 version 做乐观并发，删除前检查下级与
 * 成员数量。持久化 key：`clouddrive.plugin.departments`。
 */

export const DEPARTMENTS_STORAGE_KEY = 'clouddrive.plugin.departments';
export const DEPARTMENTS_STORAGE_VERSION = 1;

export type DepartmentsFailureCode = 'conflict' | 'readonly' | 'invalid';

export type DepartmentsResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; code: DepartmentsFailureCode; reason: string }>;

export type DepartmentsState = {
  nodes: readonly DepartmentNode[];
  /** 权限镜像：由页面从 `useProductAccess()` 写入，仅作防御性写入闸门。 */
  writable: boolean;
  setWritable: (writable: boolean) => void;
  create: (draft: DepartmentDraft) => DepartmentsResult;
  update: (id: string, draft: DepartmentDraft, expectedVersion: number) => DepartmentsResult;
  remove: (id: string, expectedVersion: number) => DepartmentsResult;
  resetDemo: () => DepartmentsResult;
};

const failure = (
  code: DepartmentsFailureCode,
  reason: string,
): Readonly<{ ok: false; code: DepartmentsFailureCode; reason: string }> => ({
  ok: false,
  code,
  reason,
});

const firstIssue = (issues: DepartmentIssues): string =>
  issues.name ?? issues.leader ?? issues.remark ?? issues.parent ?? 'invalid';

const nextSiblingOrder = (nodes: readonly DepartmentNode[], parentId: string | null): number => {
  const siblings = nodes.filter((node) => node.parentId === parentId);
  return siblings.reduce((max, node) => Math.max(max, node.order), -1) + 1;
};

export const useDepartmentsStore = createPersistStore<DepartmentsState, DepartmentsPersisted>(
  (set, get) => ({
    nodes: createDemoDepartments(),
    writable: false,
    setWritable: (writable) => set({ writable }),
    create: (draft) => {
      if (!get().writable) return failure('readonly', 'permission');
      const validation = validateDepartmentDraft(get().nodes, null, draft);
      if (!validation.ok) return failure('invalid', firstIssue(validation.issues));
      const node: DepartmentNode = {
        id: newDepartmentId(),
        parentId: validation.values.parentId,
        name: validation.values.name,
        leader: validation.values.leader,
        memberCount: 0,
        status: validation.values.status,
        remark: validation.values.remark,
        createdAt: Date.now(),
        order: nextSiblingOrder(get().nodes, validation.values.parentId),
        version: 1,
      };
      set({ nodes: [...get().nodes, node] });
      return { ok: true };
    },
    update: (id, draft, expectedVersion) => {
      if (!get().writable) return failure('readonly', 'permission');
      const current = get().nodes.find((node) => node.id === id);
      if (current === undefined) return failure('invalid', 'not-found');
      if (current.version !== expectedVersion) return failure('conflict', 'version');
      const validation = validateDepartmentDraft(get().nodes, id, draft);
      if (!validation.ok) return failure('invalid', firstIssue(validation.issues));
      const parentChanged = validation.values.parentId !== current.parentId;
      const order = parentChanged
        ? nextSiblingOrder(get().nodes, validation.values.parentId)
        : current.order;
      set({
        nodes: get().nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                parentId: validation.values.parentId,
                name: validation.values.name,
                leader: validation.values.leader,
                status: validation.values.status,
                remark: validation.values.remark,
                order,
                version: node.version + 1,
              }
            : node,
        ),
      });
      return { ok: true };
    },
    remove: (id, expectedVersion) => {
      if (!get().writable) return failure('readonly', 'permission');
      const current = get().nodes.find((node) => node.id === id);
      if (current === undefined) return failure('invalid', 'not-found');
      if (current.version !== expectedVersion) return failure('conflict', 'version');
      const blocker = departmentDeleteBlocker(get().nodes, id);
      if (blocker !== null) return failure('invalid', blocker);
      set({ nodes: get().nodes.filter((node) => node.id !== id) });
      return { ok: true };
    },
    resetDemo: () => {
      if (!get().writable) return failure('readonly', 'permission');
      set({ nodes: createDemoDepartments() });
      return { ok: true };
    },
  }),
  {
    name: DEPARTMENTS_STORAGE_KEY,
    version: DEPARTMENTS_STORAGE_VERSION,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ nodes }) => ({ nodes }),
    migrate: parseDepartmentsPersisted,
    merge: (persisted, current) =>
      persisted === undefined ? current : { ...current, ...parseDepartmentsPersisted(persisted) },
  },
);
