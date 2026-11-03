/**
 * Host —— Leave-confirm Port 实现（composition root 装配）。
 *
 * 把 `@clouddrive/plugin-framework/leave-confirm` 的 `LeaveConfirmPort` 契约接到
 * Host leave-confirm 注册表（leave-confirm.ts）。Plugin 页（reference-resources 等）
 * 经本 Port 注册 dirty source，不 import apps/web。
 */
import type { LeaveConfirmPort } from '@clouddrive/plugin-framework/leave-confirm';

import { registerDirtySource } from './leave-confirm';

/** 创建 Leave-confirm Port（Host composition root 单次调用）。 */
export function createHostLeaveConfirmPort(): LeaveConfirmPort {
  return {
    registerDirtySource: (source) =>
      registerDirtySource({
        pageId: source.pageId,
        message: source.message,
        isDirty: source.isDirty,
        ...(source.isSubmitting ? { isSubmitting: source.isSubmitting } : {}),
      }),
  };
}
