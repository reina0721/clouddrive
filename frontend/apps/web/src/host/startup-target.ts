/**
 * Host —— 启动目标解析（SET-005-004）。
 *
 * 首次进入根入口（pathname === '/'）时按序尝试启动目标：
 *   有效的工作恢复目标 → 最近页面 → 指定首页(homeTarget≠'/') → 默认区域首入口 → 当前首页('/')。
 * 直接深链接（pathname ≠ '/'）不被启动偏好重定向（返回 null = 保持当前）。
 * 失效目标（不在当前路由集合 / 即 '/' 自身）跳过。
 *
 * 纯函数（无 React/浏览器依赖），可独立单测。
 */

export type StartTargetContext = Readonly<{
  /** 当前真实 pathname（深链接判断用）。 */
  currentPathname: string;
  /** 工作恢复目标（autoRestoreWorkspace 开且有效时给出）；null = 无。 */
  restoreTarget: string | null;
  /** 最近访问（最近在前）。 */
  recents: ReadonlyArray<Readonly<{ pathname: string }>>;
  /** 导航偏好 homeTarget（'/' = 当前首页）。 */
  homeTarget: string;
  /** 默认区域首入口；null = 无。 */
  defaultAreaFirstEntry: string | null;
  /** 当前有效路由 pathname 集合（失效过滤）。 */
  validPathnames: ReadonlySet<string>;
}>;

/** 是否为有效目标（在有效路由集合内且非根入口自身）。 */
function isValidTarget(pathname: string, ctx: StartTargetContext): boolean {
  if (pathname === '' || pathname === '/') return false;
  return ctx.validPathnames.has(pathname);
}

/**
 * 解析启动目标：返回应导航到的 pathname；null = 保持当前（深链接或全部兜底为 '/'）。
 */
export function resolveStartTarget(ctx: StartTargetContext): string | null {
  // 直接深链接（或非根入口）：不重定向。
  if (ctx.currentPathname !== '/') return null;

  const candidates: ReadonlyArray<string | null> = [
    ctx.restoreTarget,
    ctx.recents[0]?.pathname ?? null,
    ctx.homeTarget,
    ctx.defaultAreaFirstEntry,
  ];
  for (const candidate of candidates) {
    if (candidate && isValidTarget(candidate, ctx)) return candidate;
  }
  // 全部无效 → 当前首页（'/'）。
  return null;
}
