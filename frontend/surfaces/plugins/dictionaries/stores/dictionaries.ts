import { createLocalStorage, createPersistStore } from '@clouddrive/state-foundation';

import {
  createDemoDictionaries,
  isDictionaryCodeAvailable,
  newDictionaryItemId,
  newDictionaryTypeId,
  parseDictionariesPersisted,
  validateDictionaryItemDraft,
  validateDictionaryTypeDraft,
  type DictionariesPersisted,
  type DictionaryItem,
  type DictionaryItemDraft,
  type DictionaryType,
  type DictionaryTypeDraft,
} from '../src/dictionary-model';

/**
 * dictionaries 插件私有 store（surfaces/plugins/dictionaries/stores）。
 *
 * 类型与字典项都是本地演示数据；类型编码唯一，类型/字典项各自带 version 做乐观并发。
 * 字典项变更会刷新所属类型的更新时间（展示语义），但不改变类型 version。
 * 持久化 key：`clouddrive.plugin.dictionaries`。
 */

export const DICTIONARIES_STORAGE_KEY = 'clouddrive.plugin.dictionaries';
export const DICTIONARIES_STORAGE_VERSION = 1;

export type DictionariesFailureCode = 'conflict' | 'readonly' | 'invalid';

export type DictionariesResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; code: DictionariesFailureCode; reason: string }>;

export type DictionariesState = {
  types: readonly DictionaryType[];
  items: readonly DictionaryItem[];
  /** 权限镜像：由页面从 `useProductAccess()` 写入，仅作防御性写入闸门。 */
  writable: boolean;
  setWritable: (writable: boolean) => void;
  createType: (draft: DictionaryTypeDraft) => DictionariesResult;
  updateType: (
    id: string,
    draft: DictionaryTypeDraft,
    expectedVersion: number,
  ) => DictionariesResult;
  removeType: (id: string, expectedVersion: number) => DictionariesResult;
  createItem: (typeId: string, draft: DictionaryItemDraft) => DictionariesResult;
  updateItem: (
    id: string,
    draft: DictionaryItemDraft,
    expectedVersion: number,
  ) => DictionariesResult;
  removeItem: (id: string, expectedVersion: number) => DictionariesResult;
  resetDemo: () => DictionariesResult;
};

const failure = (
  code: DictionariesFailureCode,
  reason: string,
): Readonly<{ ok: false; code: DictionariesFailureCode; reason: string }> => ({
  ok: false,
  code,
  reason,
});

const touchType = (
  types: readonly DictionaryType[],
  typeId: string,
  updatedAt: number,
): readonly DictionaryType[] =>
  types.map((type) => (type.id === typeId ? { ...type, updatedAt } : type));

export const useDictionariesStore = createPersistStore<DictionariesState, DictionariesPersisted>(
  (set, get) => ({
    ...createDemoDictionaries(),
    writable: false,
    setWritable: (writable) => set({ writable }),
    createType: (draft) => {
      if (!get().writable) return failure('readonly', 'permission');
      const validation = validateDictionaryTypeDraft(draft);
      if (!validation.ok) {
        return failure(
          'invalid',
          validation.issues.name ?? validation.issues.code ?? validation.issues.remark ?? 'invalid',
        );
      }
      if (!isDictionaryCodeAvailable(get().types, validation.values.code)) {
        return failure('invalid', 'code-duplicate');
      }
      const type: DictionaryType = {
        id: newDictionaryTypeId(),
        name: validation.values.name,
        code: validation.values.code,
        status: validation.values.status,
        remark: validation.values.remark,
        updatedAt: Date.now(),
        version: 1,
      };
      set({ types: [...get().types, type] });
      return { ok: true };
    },
    updateType: (id, draft, expectedVersion) => {
      if (!get().writable) return failure('readonly', 'permission');
      const current = get().types.find((type) => type.id === id);
      if (current === undefined) return failure('invalid', 'not-found');
      if (current.version !== expectedVersion) return failure('conflict', 'version');
      const validation = validateDictionaryTypeDraft(draft);
      if (!validation.ok) {
        return failure(
          'invalid',
          validation.issues.name ?? validation.issues.code ?? validation.issues.remark ?? 'invalid',
        );
      }
      if (!isDictionaryCodeAvailable(get().types, validation.values.code, id)) {
        return failure('invalid', 'code-duplicate');
      }
      set({
        types: get().types.map((type) =>
          type.id === id
            ? {
                ...type,
                name: validation.values.name,
                code: validation.values.code,
                status: validation.values.status,
                remark: validation.values.remark,
                updatedAt: Date.now(),
                version: type.version + 1,
              }
            : type,
        ),
      });
      return { ok: true };
    },
    removeType: (id, expectedVersion) => {
      if (!get().writable) return failure('readonly', 'permission');
      const current = get().types.find((type) => type.id === id);
      if (current === undefined) return failure('invalid', 'not-found');
      if (current.version !== expectedVersion) return failure('conflict', 'version');
      set({
        types: get().types.filter((type) => type.id !== id),
        items: get().items.filter((item) => item.typeId !== id),
      });
      return { ok: true };
    },
    createItem: (typeId, draft) => {
      if (!get().writable) return failure('readonly', 'permission');
      if (!get().types.some((type) => type.id === typeId)) {
        return failure('invalid', 'type-not-found');
      }
      const validation = validateDictionaryItemDraft(draft);
      if (!validation.ok) {
        return failure(
          'invalid',
          validation.issues.label ??
            validation.issues.value ??
            validation.issues.order ??
            'invalid',
        );
      }
      const item: DictionaryItem = {
        id: newDictionaryItemId(),
        typeId,
        label: validation.values.label,
        value: validation.values.value,
        order: validation.values.order,
        status: validation.values.status,
        tone: validation.values.tone,
        version: 1,
      };
      const now = Date.now();
      set({ items: [...get().items, item], types: touchType(get().types, typeId, now) });
      return { ok: true };
    },
    updateItem: (id, draft, expectedVersion) => {
      if (!get().writable) return failure('readonly', 'permission');
      const current = get().items.find((item) => item.id === id);
      if (current === undefined) return failure('invalid', 'not-found');
      if (current.version !== expectedVersion) return failure('conflict', 'version');
      const validation = validateDictionaryItemDraft(draft);
      if (!validation.ok) {
        return failure(
          'invalid',
          validation.issues.label ??
            validation.issues.value ??
            validation.issues.order ??
            'invalid',
        );
      }
      const now = Date.now();
      set({
        items: get().items.map((item) =>
          item.id === id
            ? {
                ...item,
                label: validation.values.label,
                value: validation.values.value,
                order: validation.values.order,
                status: validation.values.status,
                tone: validation.values.tone,
                version: item.version + 1,
              }
            : item,
        ),
        types: touchType(get().types, current.typeId, now),
      });
      return { ok: true };
    },
    removeItem: (id, expectedVersion) => {
      if (!get().writable) return failure('readonly', 'permission');
      const current = get().items.find((item) => item.id === id);
      if (current === undefined) return failure('invalid', 'not-found');
      if (current.version !== expectedVersion) return failure('conflict', 'version');
      set({
        items: get().items.filter((item) => item.id !== id),
        types: touchType(get().types, current.typeId, Date.now()),
      });
      return { ok: true };
    },
    resetDemo: () => {
      if (!get().writable) return failure('readonly', 'permission');
      set({ ...createDemoDictionaries() });
      return { ok: true };
    },
  }),
  {
    name: DICTIONARIES_STORAGE_KEY,
    version: DICTIONARIES_STORAGE_VERSION,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ types, items }) => ({ types, items }),
    migrate: parseDictionariesPersisted,
    merge: (persisted, current) =>
      persisted === undefined ? current : { ...current, ...parseDictionariesPersisted(persisted) },
  },
);
