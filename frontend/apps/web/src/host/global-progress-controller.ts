import type { useGlobalProgressStore } from './global-progress-state';

/**
 * Global Pending Contract（应用级全局状态转换的稳定入口）。
 *
 * 业务代码只通过 begin() 登记一次全局转换并持有 handle，在转换结束时调用
 * done()/fail()/cancel()；绝不直接控制颜色、duration、百分比等视觉实现。
 * 当前唯一消费者是 Host 导航入口（路由导航）；未来明确的全局任务通过同一契约接入。
 */
export type GlobalPendingHandle = Readonly<{
  /** 转换正常完成。 */
  done: () => void;
  /** 转换失败，立即进入收尾。 */
  fail: () => void;
  /** 转换被取消，立即进入收尾。 */
  cancel: () => void;
}>;

export type GlobalPendingBeginOptions = Readonly<{
  /** 语义标签（诊断用途，不参与视觉）。 */
  label?: string;
}>;

export type GlobalProgressController = Readonly<{
  begin: (options?: GlobalPendingBeginOptions) => GlobalPendingHandle;
}>;

/**
 * createGlobalProgressController 把 Global Progress State 暴露为稳定的
 * Global Pending Contract。Host 在装配点创建一次并注入。
 */
export function createGlobalProgressController(
  store: typeof useGlobalProgressStore,
): GlobalProgressController {
  return {
    begin: (options) => {
      const end = store.getState().begin(options?.label ?? null);
      return {
        done: end,
        fail: end,
        cancel: end,
      };
    },
  };
}
