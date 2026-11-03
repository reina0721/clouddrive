/**
 * tailwind-source-policy —— Tailwind v4 source coverage 判定的纯函数（可测、无副作用）。
 *
 * 供 check-tailwind-sources.mjs（架构门禁）与 check-foundation-fixtures.mjs（自测）共用，
 * 避免 gate 主体脚本的副作用在 import 时被执行。
 */

import { relative, resolve, sep } from 'node:path';

/** root 是否被任一 source 覆盖：source 是 root 自身或 root 的祖先目录。 */
export function isRootCoveredBySources(root, sourceRoots) {
  const normalized = resolve(root);
  return sourceRoots.some((source) => {
    const sourcePath = resolve(source);
    const rel = relative(sourcePath, normalized);
    return rel === '' || (!rel.startsWith(`..${sep}`) && !rel.startsWith('..'));
  });
}
