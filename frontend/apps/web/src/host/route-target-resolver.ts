'use client';

import { generatedSurfaceRegistry } from '@clouddrive/surface/generated/composition';
import { resolveRouteTarget, type RouteTarget } from '@clouddrive/plugin-framework';

/**
 * Host Route Target Resolver —— 唯一解析 Route Target → href 的地方。
 *
 * Host 在 Root Provider 中一次性创建该 resolver，并注入 HostNavigationPortProvider；
 * Plugin 不手写 URL，也不自行解析 Route Target。校验失败保持失败语义（抛错）。
 */
export const routeTargetResolver = {
  resolveHref: (target: RouteTarget): string => {
    const result = resolveRouteTarget(generatedSurfaceRegistry, target);
    if (result.diagnostics.length > 0) {
      const detail = result.diagnostics
        .map((diagnostic) => `[${diagnostic.code}] ${diagnostic.message}`)
        .join('; ');
      throw new Error(`Route Target 解析失败: ${detail}`);
    }
    return result.href;
  },
} as const;
