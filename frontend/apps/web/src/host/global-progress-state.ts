import { createAppStore } from '@clouddrive/state-foundation';

/**
 * 应用级 Global Pending 状态（Host 内模块单例）。
 *
 * 职责：跟踪"全局状态转换"的真实生命周期（开始/进行中/完成/取消/失败），
 * 不包含任何视觉实现细节。生命周期由 Host 导航入口统一提供（begin/end/fail/cancel），
 * Top Progress 组件订阅本 store 做视觉表现。
 *
 * 阶段语义：
 * - idle：没有进行中的全局转换，进度条不渲染。
 * - pending：至少一次全局转换进行中，进度条显示并持续推进。
 * - completing：所有转换已结束，进入"快速补满 → 轻量退出"，随后回 idle。
 *
 * 最小可见周期：每次 begin 都会进入 pending 并最终进入 completing，
 * 即使导航极快也保证 Top Progress 完成一次完整的视觉收尾（由 CSS 动画控制），
 * 不采用"导航太快就完全不显示"的门限策略。
 *
 * 连续导航安全：begin 递增计数、end/fail/cancel 递减计数，只有归零才进入 completing。
 * 超时兜底保证任何异常路径下都不会永久卡住。
 */

/** 一次 begin 的最长存活时间；超过即强制结束，防止完成信号丢失导致永久显示。 */
export const globalProgressTimeoutMs = 15_000;

export type GlobalProgressPhase = 'idle' | 'pending' | 'completing';

type GlobalProgressState = {
  /** 进行中的全局转换计数。 */
  pendingCount: number;
  /** 当前阶段。 */
  phase: GlobalProgressPhase;
  /** 最近一次 begin 的语义标签（当前仅用于诊断，不参与视觉）。 */
  activeLabel: string | null;
  begin: (label?: string | null) => () => void;
  /** 供 Top Progress 在退出动画结束后调用，回到 idle。 */
  exitComplete: () => void;
};

export const useGlobalProgressStore = createAppStore<GlobalProgressState>((set, get) => {
  /** 每个进行中转换的超时定时器 id；结束任意一次 begin 时清理。 */
  const timeoutIds = new Set<ReturnType<typeof setTimeout>>();

  const clearPendingTimeout = (timeoutId: ReturnType<typeof setTimeout>) => {
    timeoutIds.delete(timeoutId);
    clearTimeout(timeoutId);
  };

  /** 归零后统一进入 completing（视觉收尾），随后由 Top Progress 退出动画结束回 idle。 */
  const settleToCompleting = () => {
    const { pendingCount, phase } = get();
    if (pendingCount > 0 || phase === 'completing') return;
    set({ phase: 'completing', activeLabel: null });
  };

  const endPending = () => {
    set((state) => ({ pendingCount: Math.max(0, state.pendingCount - 1) }));
    settleToCompleting();
  };

  return {
    pendingCount: 0,
    phase: 'idle',
    activeLabel: null,

    begin: (label) => {
      set((state) => ({
        pendingCount: state.pendingCount + 1,
        phase: 'pending',
        activeLabel: label ?? state.activeLabel,
      }));

      // 超时兜底：完成信号丢失（拆帧、Suspense 迟到、导航取消）时强制结束本次转换。
      const timeoutId = setTimeout(() => {
        timeoutIds.delete(timeoutId);
        endPending();
      }, globalProgressTimeoutMs);
      timeoutIds.add(timeoutId);

      // 返回结束函数：end/fail/cancel 统一走同一路径，幂等。
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        clearPendingTimeout(timeoutId);
        endPending();
      };
    },

    exitComplete: () => {
      if (get().phase !== 'completing') return;
      set({ phase: 'idle' });
    },
  };
});
