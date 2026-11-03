/**
 * dictionaries —— 业务字典模型（纯模块：无 React / 无 storage / 无副作用）。
 *
 * 字典类型（type）与字典项（item）都是本地演示数据；类型编码唯一，字典项
 * 带语义颜色 tone。引用说明只做文档提示，不建立真实数据联动。
 */

export type DictionaryStatus = 'active' | 'disabled';

/** 仅允许语义 tone，映射到 StatusPill 的语义色。 */
export type DictionaryTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

export type DictionaryType = Readonly<{
  id: string;
  name: string;
  code: string;
  status: DictionaryStatus;
  remark: string;
  updatedAt: number;
  version: number;
}>;

export type DictionaryItem = Readonly<{
  id: string;
  typeId: string;
  label: string;
  value: string;
  order: number;
  status: DictionaryStatus;
  tone: DictionaryTone;
  version: number;
}>;

export const DICTIONARY_NAME_MIN = 2;
export const DICTIONARY_NAME_MAX = 40;
export const DICTIONARY_REMARK_MAX = 200;
export const DICTIONARY_ITEM_LABEL_MAX = 40;
export const DICTIONARY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;
export const DICTIONARY_ORDER_MIN = 0;
export const DICTIONARY_ORDER_MAX = 999;

export const dictionaryTones: readonly DictionaryTone[] = [
  'default',
  'primary',
  'success',
  'warning',
  'danger',
];

export function isDictionaryTone(value: unknown): value is DictionaryTone {
  return dictionaryTones.some((tone) => tone === value);
}

export type DictionaryTypeDraft = Readonly<{
  name: string;
  code: string;
  status: DictionaryStatus;
  remark: string;
}>;

export type DictionaryItemDraft = Readonly<{
  label: string;
  value: string;
  order: string;
  status: DictionaryStatus;
  tone: DictionaryTone;
}>;

export type DictionaryTypeIssues = Readonly<{
  name?: 'name-length';
  code?: 'code-format';
  remark?: 'remark-length';
}>;

export type DictionaryItemIssues = Readonly<{
  label?: 'label-length';
  value?: 'value-length';
  order?: 'order-range';
}>;

export type DictionaryTypeValues = Readonly<{
  name: string;
  code: string;
  status: DictionaryStatus;
  remark: string;
}>;

export type DictionaryItemValues = Readonly<{
  label: string;
  value: string;
  order: number;
  status: DictionaryStatus;
  tone: DictionaryTone;
}>;

export type DictionaryTypeValidation =
  | Readonly<{ ok: true; values: DictionaryTypeValues }>
  | Readonly<{ ok: false; issues: DictionaryTypeIssues }>;

export type DictionaryItemValidation =
  | Readonly<{ ok: true; values: DictionaryItemValues }>
  | Readonly<{ ok: false; issues: DictionaryItemIssues }>;

const DEMO_UPDATED_AT = Date.UTC(2026, 0, 12, 8, 0);

const demoTypes: readonly DictionaryType[] = [
  {
    id: 'dict-user-status',
    name: '用户状态',
    code: 'USER_STATUS',
    status: 'active',
    remark: '用户账号的启用状态，供用户管理与批量停用复用。',
    updatedAt: DEMO_UPDATED_AT,
    version: 1,
  },
  {
    id: 'dict-audit-operation',
    name: '审计操作',
    code: 'AUDIT_OPERATION',
    status: 'active',
    remark: '审计日志记录的操作类型。',
    updatedAt: DEMO_UPDATED_AT - 86_400_000,
    version: 1,
  },
  {
    id: 'dict-notification-category',
    name: '通知分类',
    code: 'NOTIFICATION_CATEGORY',
    status: 'active',
    remark: '通知中心的分类标签。',
    updatedAt: DEMO_UPDATED_AT - 172_800_000,
    version: 1,
  },
  {
    id: 'dict-region',
    name: '地区',
    code: 'REGION',
    status: 'active',
    remark: '业务覆盖的地区划分，用于筛选与统计。',
    updatedAt: DEMO_UPDATED_AT - 259_200_000,
    version: 1,
  },
  {
    id: 'dict-task-priority',
    name: '任务优先级',
    code: 'TASK_PRIORITY',
    status: 'disabled',
    remark: '任务与工单的优先级；当前演示为停用。',
    updatedAt: DEMO_UPDATED_AT - 345_600_000,
    version: 1,
  },
];

const demoItems: readonly DictionaryItem[] = [
  {
    id: 'item-user-status-active',
    typeId: 'dict-user-status',
    label: '启用',
    value: 'active',
    order: 0,
    status: 'active',
    tone: 'success',
    version: 1,
  },
  {
    id: 'item-user-status-disabled',
    typeId: 'dict-user-status',
    label: '停用',
    value: 'disabled',
    order: 1,
    status: 'active',
    tone: 'default',
    version: 1,
  },
  {
    id: 'item-user-status-locked',
    typeId: 'dict-user-status',
    label: '锁定',
    value: 'locked',
    order: 2,
    status: 'active',
    tone: 'warning',
    version: 1,
  },
  {
    id: 'item-audit-sign-in',
    typeId: 'dict-audit-operation',
    label: '登录',
    value: 'sign-in',
    order: 0,
    status: 'active',
    tone: 'primary',
    version: 1,
  },
  {
    id: 'item-audit-create',
    typeId: 'dict-audit-operation',
    label: '创建',
    value: 'create',
    order: 1,
    status: 'active',
    tone: 'success',
    version: 1,
  },
  {
    id: 'item-audit-delete',
    typeId: 'dict-audit-operation',
    label: '删除',
    value: 'delete',
    order: 2,
    status: 'active',
    tone: 'danger',
    version: 1,
  },
  {
    id: 'item-audit-grant',
    typeId: 'dict-audit-operation',
    label: '授权',
    value: 'grant',
    order: 3,
    status: 'active',
    tone: 'warning',
    version: 1,
  },
  {
    id: 'item-notification-system',
    typeId: 'dict-notification-category',
    label: '系统公告',
    value: 'system',
    order: 0,
    status: 'active',
    tone: 'primary',
    version: 1,
  },
  {
    id: 'item-notification-approval',
    typeId: 'dict-notification-category',
    label: '审批提醒',
    value: 'approval',
    order: 1,
    status: 'active',
    tone: 'warning',
    version: 1,
  },
  {
    id: 'item-notification-security',
    typeId: 'dict-notification-category',
    label: '安全告警',
    value: 'security',
    order: 2,
    status: 'active',
    tone: 'danger',
    version: 1,
  },
  {
    id: 'item-region-east',
    typeId: 'dict-region',
    label: '华东',
    value: 'east',
    order: 0,
    status: 'active',
    tone: 'default',
    version: 1,
  },
  {
    id: 'item-region-south',
    typeId: 'dict-region',
    label: '华南',
    value: 'south',
    order: 1,
    status: 'active',
    tone: 'default',
    version: 1,
  },
  {
    id: 'item-region-north',
    typeId: 'dict-region',
    label: '华北',
    value: 'north',
    order: 2,
    status: 'active',
    tone: 'default',
    version: 1,
  },
  {
    id: 'item-region-southwest',
    typeId: 'dict-region',
    label: '西南',
    value: 'southwest',
    order: 3,
    status: 'active',
    tone: 'default',
    version: 1,
  },
  {
    id: 'item-task-priority-low',
    typeId: 'dict-task-priority',
    label: '低',
    value: 'low',
    order: 0,
    status: 'active',
    tone: 'default',
    version: 1,
  },
  {
    id: 'item-task-priority-medium',
    typeId: 'dict-task-priority',
    label: '中',
    value: 'medium',
    order: 1,
    status: 'active',
    tone: 'primary',
    version: 1,
  },
  {
    id: 'item-task-priority-high',
    typeId: 'dict-task-priority',
    label: '高',
    value: 'high',
    order: 2,
    status: 'active',
    tone: 'warning',
    version: 1,
  },
  {
    id: 'item-task-priority-urgent',
    typeId: 'dict-task-priority',
    label: '紧急',
    value: 'urgent',
    order: 3,
    status: 'active',
    tone: 'danger',
    version: 1,
  },
];

/** 返回一份可重新播种的演示字典数据。 */
export function createDemoDictionaries(): Readonly<{
  types: readonly DictionaryType[];
  items: readonly DictionaryItem[];
}> {
  return {
    types: demoTypes.map((type) => ({ ...type })),
    items: demoItems.map((item) => ({ ...item })),
  };
}

export function newDictionaryTypeId(): string {
  return `dict-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newDictionaryItemId(): string {
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 编码是否可用（大小写敏感；编码规则本身只允许大写）。 */
export function isDictionaryCodeAvailable(
  types: readonly DictionaryType[],
  code: string,
  excludeId?: string,
): boolean {
  const normalized = code.trim();
  return !types.some((type) => type.id !== excludeId && type.code === normalized);
}

export function validateDictionaryTypeDraft(draft: DictionaryTypeDraft): DictionaryTypeValidation {
  const issues: { name?: 'name-length'; code?: 'code-format'; remark?: 'remark-length' } = {};
  const name = draft.name.trim();
  const code = draft.code.trim();
  const remark = draft.remark.trim();
  if (name.length < DICTIONARY_NAME_MIN || name.length > DICTIONARY_NAME_MAX) {
    issues.name = 'name-length';
  }
  if (!DICTIONARY_CODE_PATTERN.test(code)) issues.code = 'code-format';
  if (remark.length > DICTIONARY_REMARK_MAX) issues.remark = 'remark-length';
  if (issues.name !== undefined || issues.code !== undefined || issues.remark !== undefined) {
    return { ok: false, issues };
  }
  return { ok: true, values: { name, code, status: draft.status, remark } };
}

export function validateDictionaryItemDraft(draft: DictionaryItemDraft): DictionaryItemValidation {
  const issues: { label?: 'label-length'; value?: 'value-length'; order?: 'order-range' } = {};
  const label = draft.label.trim();
  const value = draft.value.trim();
  const orderText = draft.order.trim();
  if (label.length === 0 || label.length > DICTIONARY_ITEM_LABEL_MAX) {
    issues.label = 'label-length';
  }
  if (value.length === 0 || value.length > DICTIONARY_ITEM_LABEL_MAX) {
    issues.value = 'value-length';
  }
  let order = 0;
  if (orderText.length === 0) {
    issues.order = 'order-range';
  } else {
    const parsed = Number(orderText);
    if (
      !/^\d+$/.test(orderText) ||
      !Number.isInteger(parsed) ||
      parsed < DICTIONARY_ORDER_MIN ||
      parsed > DICTIONARY_ORDER_MAX
    ) {
      issues.order = 'order-range';
    } else {
      order = parsed;
    }
  }
  if (issues.label !== undefined || issues.value !== undefined || issues.order !== undefined) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    values: { label, value, order, status: draft.status, tone: draft.tone },
  };
}

/** 排序后的字典项（order → label）。 */
export function sortDictionaryItems(items: readonly DictionaryItem[]): readonly DictionaryItem[] {
  return [...items].sort(
    (left, right) => left.order - right.order || left.label.localeCompare(right.label),
  );
}

/**
 * 引用说明（仅文档）：已知会消费该编码的产品界面。返回 i18n key 后缀；
 * 未登记的编码返回 null，页面显示通用提示。
 */
export const dictionaryConsumerKeys: Readonly<Record<string, string>> = {
  USER_STATUS: 'userStatus',
  AUDIT_OPERATION: 'auditOperation',
  NOTIFICATION_CATEGORY: 'notificationCategory',
  REGION: 'region',
  TASK_PRIORITY: 'taskPriority',
};

export function dictionaryConsumerKey(code: string): string | null {
  return dictionaryConsumerKeys[code] ?? null;
}

/** 持久化读模型。 */
export type DictionariesPersisted = Readonly<{
  types: readonly DictionaryType[];
  items: readonly DictionaryItem[];
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (raw: unknown, label: string): string => {
  if (typeof raw !== 'string') throw new Error(`dictionaries: ${label}记录损坏`);
  return raw;
};

/** 校验持久化记录；损坏 → 抛错（由 hydration lifecycle 上报，不静默覆盖）。 */
export function parseDictionariesPersisted(value: unknown): DictionariesPersisted {
  if (!isRecord(value) || !Array.isArray(value['types']) || !Array.isArray(value['items'])) {
    throw new Error('dictionaries: 字典记录损坏');
  }
  const types: DictionaryType[] = [];
  const typeIds = new Set<string>();
  const codes = new Set<string>();
  for (const raw of value['types']) {
    if (!isRecord(raw)) throw new Error('dictionaries: 字典类型记录损坏');
    const id = readString(raw['id'], '字典类型 id');
    if (id.trim().length === 0 || typeIds.has(id))
      throw new Error('dictionaries: 字典类型 id 重复');
    typeIds.add(id);
    const name = readString(raw['name'], '字典类型名称');
    if (name.trim().length < DICTIONARY_NAME_MIN || name.trim().length > DICTIONARY_NAME_MAX) {
      throw new Error('dictionaries: 字典类型名称记录损坏');
    }
    const code = readString(raw['code'], '字典编码');
    if (!DICTIONARY_CODE_PATTERN.test(code) || codes.has(code)) {
      throw new Error('dictionaries: 字典编码记录损坏');
    }
    codes.add(code);
    const status = raw['status'];
    if (status !== 'active' && status !== 'disabled') {
      throw new Error('dictionaries: 字典类型状态记录损坏');
    }
    const remark = readString(raw['remark'], '字典备注');
    if (remark.length > DICTIONARY_REMARK_MAX) {
      throw new Error('dictionaries: 字典备注记录损坏');
    }
    const updatedAt = raw['updatedAt'];
    if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
      throw new Error('dictionaries: 字典更新时间记录损坏');
    }
    const version = raw['version'];
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      throw new Error('dictionaries: 字典类型版本记录损坏');
    }
    types.push({ id, name, code, status, remark, updatedAt, version });
  }

  const items: DictionaryItem[] = [];
  const itemIds = new Set<string>();
  for (const raw of value['items']) {
    if (!isRecord(raw)) throw new Error('dictionaries: 字典项记录损坏');
    const id = readString(raw['id'], '字典项 id');
    if (id.trim().length === 0 || itemIds.has(id)) throw new Error('dictionaries: 字典项 id 重复');
    itemIds.add(id);
    const typeId = readString(raw['typeId'], '字典项类型');
    if (!typeIds.has(typeId)) throw new Error('dictionaries: 字典项类型引用损坏');
    const label = readString(raw['label'], '字典项标签');
    if (label.trim().length === 0 || label.trim().length > DICTIONARY_ITEM_LABEL_MAX) {
      throw new Error('dictionaries: 字典项标签记录损坏');
    }
    const itemValue = readString(raw['value'], '字典项值');
    if (itemValue.trim().length === 0 || itemValue.trim().length > DICTIONARY_ITEM_LABEL_MAX) {
      throw new Error('dictionaries: 字典项值记录损坏');
    }
    const order = raw['order'];
    if (
      typeof order !== 'number' ||
      !Number.isInteger(order) ||
      order < DICTIONARY_ORDER_MIN ||
      order > DICTIONARY_ORDER_MAX
    ) {
      throw new Error('dictionaries: 字典项排序记录损坏');
    }
    const status = raw['status'];
    if (status !== 'active' && status !== 'disabled') {
      throw new Error('dictionaries: 字典项状态记录损坏');
    }
    const tone = raw['tone'];
    if (!isDictionaryTone(tone)) {
      throw new Error('dictionaries: 字典项颜色记录损坏');
    }
    const version = raw['version'];
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      throw new Error('dictionaries: 字典项版本记录损坏');
    }
    items.push({
      id,
      typeId,
      label,
      value: itemValue,
      order,
      status,
      tone,
      version,
    });
  }

  return { types, items };
}
