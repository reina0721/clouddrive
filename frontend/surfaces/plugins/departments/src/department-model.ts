/**
 * departments —— 部门树模型（纯模块：无 React / 无 storage / 无副作用）。
 *
 * 部门是本地演示业务数据（无后端）；树固定最多三级。所有写入都由 store 用
 * per-node version 做乐观并发，并在删除时检查下级部门与成员数量。
 */

export type DepartmentStatus = 'active' | 'disabled';

export type DepartmentNode = Readonly<{
  id: string;
  parentId: string | null;
  name: string;
  leader: string;
  memberCount: number;
  status: DepartmentStatus;
  remark: string;
  createdAt: number;
  /** 同层展示顺序（注册/创建时确定）。 */
  order: number;
  version: number;
}>;

export type DepartmentTreeRow = DepartmentNode &
  Readonly<{
    depth: number;
    childCount: number;
  }>;

export const DEPARTMENT_NAME_MIN = 2;
export const DEPARTMENT_NAME_MAX = 40;
export const DEPARTMENT_LEADER_MAX = 40;
export const DEPARTMENT_REMARK_MAX = 200;
export const DEPARTMENT_MAX_DEPTH = 3;

export type DepartmentDraft = Readonly<{
  name: string;
  leader: string;
  remark: string;
  status: DepartmentStatus;
  /** '' 表示顶级部门。 */
  parentId: string;
}>;

export type DepartmentIssues = Readonly<{
  name?: 'name-length';
  leader?: 'leader-length';
  remark?: 'remark-length';
  parent?: 'parent-invalid' | 'parent-depth';
}>;

export type DepartmentValues = Readonly<{
  name: string;
  leader: string;
  remark: string;
  status: DepartmentStatus;
  parentId: string | null;
}>;

export type DepartmentValidation =
  | Readonly<{ ok: true; values: DepartmentValues }>
  | Readonly<{ ok: false; issues: DepartmentIssues }>;

const DEMO_CREATED_AT = Date.UTC(2025, 0, 6, 9, 30);

const demoNodes: readonly DepartmentNode[] = [
  {
    id: 'dept-hq',
    parentId: null,
    name: '集团总部',
    leader: '陈立',
    memberCount: 186,
    status: 'active',
    remark: '集团战略、共享职能与跨部门协同。',
    createdAt: DEMO_CREATED_AT,
    order: 0,
    version: 1,
  },
  {
    id: 'dept-tech',
    parentId: 'dept-hq',
    name: '技术中心',
    leader: '林岚',
    memberCount: 78,
    status: 'active',
    remark: '负责平台架构、研发效能与质量保障。',
    createdAt: DEMO_CREATED_AT,
    order: 0,
    version: 1,
  },
  {
    id: 'dept-platform',
    parentId: 'dept-tech',
    name: '平台研发部',
    leader: '周雨',
    memberCount: 26,
    status: 'active',
    remark: '基础平台、数据服务与开发者工具。',
    createdAt: DEMO_CREATED_AT,
    order: 0,
    version: 1,
  },
  {
    id: 'dept-app',
    parentId: 'dept-tech',
    name: '应用研发部',
    leader: '赵铭',
    memberCount: 24,
    status: 'active',
    remark: '业务应用与终端交付。',
    createdAt: DEMO_CREATED_AT,
    order: 1,
    version: 1,
  },
  {
    id: 'dept-quality',
    parentId: 'dept-tech',
    name: '质量管理部',
    leader: '孙悦',
    memberCount: 12,
    status: 'active',
    remark: '质量门禁、发布验证与缺陷治理。',
    createdAt: DEMO_CREATED_AT,
    order: 2,
    version: 1,
  },
  {
    id: 'dept-lab',
    parentId: 'dept-tech',
    name: '创新实验室',
    leader: '顾言',
    memberCount: 0,
    status: 'disabled',
    remark: '预研项目孵化，成员尚未到位。',
    createdAt: DEMO_CREATED_AT,
    order: 3,
    version: 1,
  },
  {
    id: 'dept-design',
    parentId: 'dept-hq',
    name: '产品设计中心',
    leader: '苏禾',
    memberCount: 22,
    status: 'active',
    remark: '产品规划、体验设计与设计系统。',
    createdAt: DEMO_CREATED_AT,
    order: 1,
    version: 1,
  },
  {
    id: 'dept-product',
    parentId: 'dept-design',
    name: '产品管理部',
    leader: '何清',
    memberCount: 9,
    status: 'active',
    remark: '产品路线图与需求优先级。',
    createdAt: DEMO_CREATED_AT,
    order: 0,
    version: 1,
  },
  {
    id: 'dept-ux',
    parentId: 'dept-design',
    name: '用户体验部',
    leader: '叶澄',
    memberCount: 8,
    status: 'active',
    remark: '交互、视觉与可用性研究。',
    createdAt: DEMO_CREATED_AT,
    order: 1,
    version: 1,
  },
  {
    id: 'dept-marketing',
    parentId: 'dept-hq',
    name: '市场运营中心',
    leader: '方远',
    memberCount: 42,
    status: 'active',
    remark: '品牌、增长与客户运营。',
    createdAt: DEMO_CREATED_AT,
    order: 2,
    version: 1,
  },
  {
    id: 'dept-promotion',
    parentId: 'dept-marketing',
    name: '市场推广部',
    leader: '罗晴',
    memberCount: 18,
    status: 'active',
    remark: '渠道投放与活动运营。',
    createdAt: DEMO_CREATED_AT,
    order: 0,
    version: 1,
  },
  {
    id: 'dept-success',
    parentId: 'dept-marketing',
    name: '客户成功部',
    leader: '秦朗',
    memberCount: 14,
    status: 'active',
    remark: '客户续约、支持与满意度。',
    createdAt: DEMO_CREATED_AT,
    order: 1,
    version: 1,
  },
  {
    id: 'dept-finance',
    parentId: 'dept-hq',
    name: '财务与行政部',
    leader: '许宁',
    memberCount: 28,
    status: 'active',
    remark: '预算、核算与行政支持。',
    createdAt: DEMO_CREATED_AT,
    order: 3,
    version: 1,
  },
  {
    id: 'dept-accounting',
    parentId: 'dept-finance',
    name: '财务核算组',
    leader: '程雪',
    memberCount: 10,
    status: 'active',
    remark: '账务核算与费用审核。',
    createdAt: DEMO_CREATED_AT,
    order: 0,
    version: 1,
  },
  {
    id: 'dept-hr',
    parentId: 'dept-finance',
    name: '人力资源组',
    leader: '唐瑾',
    memberCount: 11,
    status: 'active',
    remark: '招聘、绩效与员工关系。',
    createdAt: DEMO_CREATED_AT,
    order: 1,
    version: 1,
  },
  {
    id: 'dept-legal',
    parentId: 'dept-hq',
    name: '法务合规部',
    leader: '魏然',
    memberCount: 6,
    status: 'active',
    remark: '合同审查、合规与风险控制。',
    createdAt: DEMO_CREATED_AT,
    order: 4,
    version: 1,
  },
];

/** 返回一份可重新播种的演示部门数据（恢复演示数据 / 首次 hydration 使用）。 */
export function createDemoDepartments(): readonly DepartmentNode[] {
  return demoNodes.map((node) => ({ ...node }));
}

/** 新建部门 id（本地演示数据，保持稳定前缀便于识别）。 */
export function newDepartmentId(): string {
  return `dept-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const indexNodes = (nodes: readonly DepartmentNode[]) =>
  new Map(nodes.map((node) => [node.id, node]));

/** 计算节点深度（根 = 0）；父链损坏/成环返回 -1。 */
export function departmentDepth(nodes: readonly DepartmentNode[], id: string): number {
  const index = indexNodes(nodes);
  const visited = new Set<string>();
  let depth = 0;
  let current = index.get(id);
  while (current !== undefined) {
    if (visited.has(current.id)) return -1;
    visited.add(current.id);
    const parentId = current.parentId;
    if (parentId === null) return depth;
    const parent = index.get(parentId);
    if (parent === undefined) return -1;
    depth += 1;
    current = parent;
  }
  return -1;
}

/** 全部下级 id（不含自身）。 */
export function departmentDescendantIds(
  nodes: readonly DepartmentNode[],
  id: string,
): ReadonlySet<string> {
  const result = new Set<string>();
  const queue = nodes.filter((node) => node.parentId === id).map((node) => node.id);
  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined || result.has(next)) continue;
    result.add(next);
    for (const node of nodes) {
      if (node.parentId === next) queue.push(node.id);
    }
  }
  return result;
}

const subtreeHeight = (nodes: readonly DepartmentNode[], id: string): number => {
  const byParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const list = byParent.get(node.parentId) ?? [];
    list.push(node.id);
    byParent.set(node.parentId, list);
  }
  let height = 0;
  const queue: { id: string; depth: number }[] = [{ id, depth: 0 }];
  const visited = new Set<string>([id]);
  while (queue.length > 0) {
    const item = queue.shift();
    if (item === undefined) continue;
    height = Math.max(height, item.depth);
    for (const child of byParent.get(item.id) ?? []) {
      if (visited.has(child)) continue;
      visited.add(child);
      queue.push({ id: child, depth: item.depth + 1 });
    }
  }
  return height;
};

/** 上级部门路径（用于选项描述，帮助区分重名部门）。 */
export function departmentPath(nodes: readonly DepartmentNode[], id: string): string {
  const index = indexNodes(nodes);
  const names: string[] = [];
  const visited = new Set<string>();
  let current = index.get(id);
  while (current !== undefined && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId === null ? undefined : index.get(current.parentId);
  }
  return names.join(' / ');
}

export type DepartmentParentOption = Readonly<{
  id: string;
  name: string;
  description: string;
}>;

/**
 * 可选的上级部门：排除自身与全部下级，并排除会导致超过三级的节点。
 * 创建时 subjectId 为 null（新部门没有子树）。
 */
export function departmentParentOptions(
  nodes: readonly DepartmentNode[],
  subjectId: string | null,
): readonly DepartmentParentOption[] {
  const excluded = new Set<string>();
  if (subjectId !== null) {
    excluded.add(subjectId);
    for (const id of departmentDescendantIds(nodes, subjectId)) excluded.add(id);
  }
  const height = subjectId === null ? 0 : subtreeHeight(nodes, subjectId);
  const maxParentDepth = DEPARTMENT_MAX_DEPTH - 2 - height;
  return nodes
    .filter((node) => !excluded.has(node.id))
    .filter((node) => departmentDepth(nodes, node.id) <= maxParentDepth)
    .sort(
      (left, right) =>
        departmentPath(nodes, left.id).localeCompare(departmentPath(nodes, right.id)) ||
        left.name.localeCompare(right.name),
    )
    .map((node) => ({
      id: node.id,
      name: node.name,
      description: departmentPath(nodes, node.id),
    }));
}

/** 展示用树（深度优先，固定三级上限之外的脏数据仍按原层级输出）。 */
export function buildDepartmentRows(
  nodes: readonly DepartmentNode[],
): readonly DepartmentTreeRow[] {
  const byParent = new Map<string, DepartmentNode[]>();
  const ids = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    const key = node.parentId !== null && ids.has(node.parentId) ? node.parentId : '';
    const list = byParent.get(key) ?? [];
    list.push(node);
    byParent.set(key, list);
  }
  const sortSiblings = (items: DepartmentNode[]) =>
    items.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  for (const siblings of byParent.values()) sortSiblings(siblings);

  const rows: DepartmentTreeRow[] = [];
  const visited = new Set<string>();
  const visit = (node: DepartmentNode, depth: number) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    rows.push({ ...node, depth, childCount: (byParent.get(node.id) ?? []).length });
    for (const child of byParent.get(node.id) ?? []) visit(child, depth + 1);
  };
  for (const root of byParent.get('') ?? []) visit(root, 0);
  return rows;
}

export type DepartmentVisibilityOptions = Readonly<{
  query: string;
  collapsedIds: ReadonlySet<string>;
}>;

/**
 * 表格可见行：搜索按名称过滤并保留祖先；无搜索时按折叠祖先隐藏。
 */
export function selectVisibleDepartmentRows(
  rows: readonly DepartmentTreeRow[],
  options: DepartmentVisibilityOptions,
): readonly DepartmentTreeRow[] {
  const query = options.query.trim().toLocaleLowerCase();
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (query.length > 0) {
    const included = new Set<string>();
    for (const row of rows) {
      if (!row.name.toLocaleLowerCase().includes(query)) continue;
      let cursor: DepartmentTreeRow | undefined = row;
      while (cursor !== undefined && !included.has(cursor.id)) {
        included.add(cursor.id);
        cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
      }
    }
    return rows.filter((row) => included.has(row.id));
  }
  const hidden = new Map<string, boolean>();
  const hiddenByCollapse = (row: DepartmentTreeRow): boolean => {
    const cached = hidden.get(row.id);
    if (cached !== undefined) return cached;
    let cursor = row.parentId === null ? undefined : byId.get(row.parentId);
    let collapsed = false;
    while (cursor !== undefined) {
      if (options.collapsedIds.has(cursor.id)) {
        collapsed = true;
        break;
      }
      cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
    }
    hidden.set(row.id, collapsed);
    return collapsed;
  };
  return rows.filter((row) => !hiddenByCollapse(row));
}

/** 删除阻塞原因（无原因 = 可删除）。 */
export function departmentDeleteBlocker(
  nodes: readonly DepartmentNode[],
  id: string,
): 'has-children' | 'has-members' | null {
  if (nodes.some((node) => node.parentId === id)) return 'has-children';
  const node = nodes.find((item) => item.id === id);
  if (node === undefined) return null;
  return node.memberCount > 0 ? 'has-members' : null;
}

/** 统一校验：字段 + 上级部门（存在性/成环/层级）。 */
export function validateDepartmentDraft(
  nodes: readonly DepartmentNode[],
  subjectId: string | null,
  draft: DepartmentDraft,
): DepartmentValidation {
  const issues: {
    name?: 'name-length';
    leader?: 'leader-length';
    remark?: 'remark-length';
    parent?: 'parent-invalid' | 'parent-depth';
  } = {};
  const name = draft.name.trim();
  const leader = draft.leader.trim();
  const remark = draft.remark.trim();

  if (name.length < DEPARTMENT_NAME_MIN || name.length > DEPARTMENT_NAME_MAX) {
    issues.name = 'name-length';
  }
  if (leader.length === 0 || leader.length > DEPARTMENT_LEADER_MAX) {
    issues.leader = 'leader-length';
  }
  if (remark.length > DEPARTMENT_REMARK_MAX) issues.remark = 'remark-length';

  const parentId = draft.parentId === '' ? null : draft.parentId;
  if (parentId !== null) {
    const parent = nodes.find((node) => node.id === parentId);
    if (parent === undefined) {
      issues.parent = 'parent-invalid';
    } else if (subjectId !== null) {
      if (parentId === subjectId || departmentDescendantIds(nodes, subjectId).has(parentId)) {
        issues.parent = 'parent-invalid';
      }
    }
    if (issues.parent === undefined) {
      const height = subjectId === null ? 0 : subtreeHeight(nodes, subjectId);
      const parentDepth = departmentDepth(nodes, parentId);
      if (parentDepth < 0 || parentDepth + 1 + height > DEPARTMENT_MAX_DEPTH - 1) {
        issues.parent = 'parent-depth';
      }
    }
  }

  if (
    issues.name !== undefined ||
    issues.leader !== undefined ||
    issues.remark !== undefined ||
    issues.parent !== undefined
  ) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    values: { name, leader, remark, status: draft.status, parentId },
  };
}

/** 持久化读模型。 */
export type DepartmentsPersisted = Readonly<{ nodes: readonly DepartmentNode[] }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (raw: unknown, label: string): string => {
  if (typeof raw !== 'string') throw new Error(`departments: ${label}记录损坏`);
  return raw;
};

/**
 * 校验持久化记录：损坏 / 父子引用断裂 / 成环 / 超过三级 → 抛错（不静默回退）。
 */
export function parseDepartmentsPersisted(value: unknown): DepartmentsPersisted {
  if (!isRecord(value) || !Array.isArray(value['nodes'])) {
    throw new Error('departments: 部门记录损坏');
  }
  const nodes: DepartmentNode[] = [];
  const ids = new Set<string>();
  for (const raw of value['nodes']) {
    if (!isRecord(raw)) throw new Error('departments: 部门记录损坏');
    const id = readString(raw['id'], '部门 id');
    if (id.trim().length === 0 || ids.has(id)) throw new Error('departments: 部门 id 重复');
    ids.add(id);
    const parentIdRaw = raw['parentId'];
    if (parentIdRaw !== null && typeof parentIdRaw !== 'string') {
      throw new Error('departments: 上级部门记录损坏');
    }
    const name = readString(raw['name'], '部门名称');
    if (name.trim().length < DEPARTMENT_NAME_MIN || name.trim().length > DEPARTMENT_NAME_MAX) {
      throw new Error('departments: 部门名称记录损坏');
    }
    const leader = readString(raw['leader'], '负责人');
    if (leader.trim().length === 0 || leader.trim().length > DEPARTMENT_LEADER_MAX) {
      throw new Error('departments: 负责人记录损坏');
    }
    const memberCount = raw['memberCount'];
    if (typeof memberCount !== 'number' || !Number.isInteger(memberCount) || memberCount < 0) {
      throw new Error('departments: 成员数记录损坏');
    }
    const status = raw['status'];
    if (status !== 'active' && status !== 'disabled') {
      throw new Error('departments: 部门状态记录损坏');
    }
    const remark = readString(raw['remark'], '备注');
    if (remark.length > DEPARTMENT_REMARK_MAX) {
      throw new Error('departments: 部门备注记录损坏');
    }
    const createdAt = raw['createdAt'];
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
      throw new Error('departments: 创建时间记录损坏');
    }
    const order = raw['order'];
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      throw new Error('departments: 排序记录损坏');
    }
    const version = raw['version'];
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      throw new Error('departments: 版本记录损坏');
    }
    nodes.push({
      id,
      parentId: parentIdRaw,
      name,
      leader,
      memberCount,
      status,
      remark,
      createdAt,
      order,
      version,
    });
  }

  const index = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    if (node.parentId === null) continue;
    if (!index.has(node.parentId)) throw new Error('departments: 上级部门引用损坏');
  }
  for (const node of nodes) {
    if (departmentDepth(nodes, node.id) < 0) throw new Error('departments: 部门层级成环');
    if (departmentDepth(nodes, node.id) > DEPARTMENT_MAX_DEPTH - 1) {
      throw new Error('departments: 部门层级超过三级');
    }
  }
  return { nodes };
}
