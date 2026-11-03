/**
 * Host —— Workspace Port 实现（composition root 装配）。
 *
 * 把 `@clouddrive/plugin-framework/workspace` 契约接到 Host workspace store：
 * - 页面先 registerPageState 声明白名单/版本；save 按该描述过滤草稿字段（白名单）；
 * - 草稿冲突（另一窗口/时序已有不同草稿）不静默覆盖 → 返回 conflict；
 * - 业务提交成功后页面调用 clearPageState。
 */
import type {
  PageState,
  PageStateDescriptor,
  WorkspacePort,
} from '@clouddrive/plugin-framework/workspace';
import { useWorkspaceStore } from '../state/use-workspace-store';

const descriptors = new Map<string, PageStateDescriptor<string>>();

export function createHostWorkspacePort(): WorkspacePort<string> {
  /** 本 port 实例最近一次成功写入的草稿指纹（pageId -> JSON）：跨窗口冲突判定。 */
  const lastWrittenDraft = new Map<string, string>();
  return {
    registerPageState: (descriptor) => {
      descriptors.set(descriptor.pageId, descriptor);
      return () => {
        descriptors.delete(descriptor.pageId);
      };
    },
    savePageState: (pageId, input) => {
      const descriptor = descriptors.get(pageId);
      const records = useWorkspaceStore.getState().records;
      const existing = records[pageId];
      const inputDraftJson = input.draft ? JSON.stringify(input.draft) : undefined;
      // 草稿冲突：stored 与本实例上次写入的指纹不同（另一窗口/刷新时序已写入不同草稿）
      // 且与本次输入不同 → 不静默覆盖（页面可选择读取后重存）。页面自身顺序 autosave
      // 的 stored 指纹 == lastWritten → 不误报。
      if (
        existing?.draft &&
        inputDraftJson !== undefined &&
        lastWrittenDraft.get(pageId) !== undefined &&
        JSON.stringify(existing.draft) !== lastWrittenDraft.get(pageId) &&
        JSON.stringify(existing.draft) !== inputDraftJson
      ) {
        return { ok: false, conflict: true, reason: '另一窗口已更新草稿，未覆盖' };
      }
      // 白名单过滤草稿字段（页面显式声明允许保存字段）。
      const allowedDraft: Record<string, unknown> = {};
      if (input.draft && descriptor) {
        for (const field of descriptor.draftFields) {
          const value = input.draft[field];
          if (value !== undefined) allowedDraft[field] = value;
        }
      } else if (input.draft) {
        Object.assign(allowedDraft, input.draft);
      }
      const nextRecord: PageState<string> = {
        pageId,
        version: descriptor?.version ?? existing?.version ?? 1,
        ...(input.list ? { list: input.list } : {}),
        ...(Object.keys(allowedDraft).length > 0 ? { draft: allowedDraft } : {}),
      };
      useWorkspaceStore.getState().setRecords({ ...records, [pageId]: nextRecord });
      lastWrittenDraft.set(pageId, JSON.stringify(nextRecord.draft ?? {}));
      return { ok: true };
    },
    restorePageState: (pageId) => {
      const record = useWorkspaceStore.getState().records[pageId];
      return record ?? null;
    },
    clearPageState: (pageId) => {
      useWorkspaceStore.getState().clearPageState(pageId);
      lastWrittenDraft.delete(pageId);
    },
  };
}

/** 测试辅助：清空描述注册表（lastWrittenDraft 为实例级，随实例新建即重置）。 */
export function resetHostWorkspaceForTest(): void {
  descriptors.clear();
}
