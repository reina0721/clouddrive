import assert from 'node:assert/strict';

import {
  getFoundationWorkspaceNameViolation,
  isFoundationDependencyAllowed,
} from './foundation-policy.mjs';
import { isRootCoveredBySources } from './tailwind-source-policy.mjs';

const universal = { layer: 'universal' };
const surfaceFoundation = { layer: 'surface', kind: 'foundation' };
const pluginFramework = { layer: 'surface', kind: 'framework' };
const surface = { layer: 'surface', kind: 'surface' };
const web = { layer: 'host', runtime: 'web' };

assert.equal(isFoundationDependencyAllowed(universal, universal), true);
assert.equal(isFoundationDependencyAllowed(universal, surfaceFoundation), false);
assert.equal(isFoundationDependencyAllowed(surfaceFoundation, universal), true);
assert.equal(isFoundationDependencyAllowed(surfaceFoundation, pluginFramework), true);
assert.equal(isFoundationDependencyAllowed(web, surface), true);
assert.equal(isFoundationDependencyAllowed(web, web), false);
assert.equal(
  getFoundationWorkspaceNameViolation('packages/surface-foundation', surfaceFoundation),
  null,
);
assert.equal(
  getFoundationWorkspaceNameViolation('packages/page-patterns', surfaceFoundation),
  'Surface Foundation 必须位于 packages/surface-foundation',
);
assert.equal(
  getFoundationWorkspaceNameViolation('packages/plugin-framework', pluginFramework),
  null,
);
assert.equal(
  getFoundationWorkspaceNameViolation('packages/plugin-contracts', pluginFramework),
  'Plugin Framework 必须位于 packages/plugin-framework',
);
assert.equal(getFoundationWorkspaceNameViolation('surfaces', surface), null);
assert.equal(
  getFoundationWorkspaceNameViolation('surfaces/product', surface),
  'Product Surface 实现必须以 surfaces 为 workspace 根目录',
);
assert.equal(getFoundationWorkspaceNameViolation('apps/web', web), null);
assert.equal(
  getFoundationWorkspaceNameViolation('apps/product-web', web),
  'Web Host 必须位于 apps/web',
);

console.log('Foundation fixtures passed: 14 cases.');

/* ---- Tailwind source coverage 判定（tailwind-source-policy） ---- */
// 覆盖判定：source 根 == 目标根、或是目标根祖先（子目录被覆盖）
const sources = ['/repo/packages', '/repo/surfaces'];
assert.equal(isRootCoveredBySources('/repo/packages', sources), true); // 精确命中
assert.equal(isRootCoveredBySources('/repo/packages/ui-adapter', sources), true); // 子目录
assert.equal(isRootCoveredBySources('/repo/surfaces', sources), true);
assert.equal(isRootCoveredBySources('/repo/surfaces/plugins/ui-elements', sources), true);
assert.equal(isRootCoveredBySources('/repo/surfaces2', sources), false); // 前缀陷阱
assert.equal(isRootCoveredBySources('/repo/surfaces-extra', sources), false);
assert.equal(isRootCoveredBySources('/repo/apps/web', sources), false); // 未登记 root
assert.equal(isRootCoveredBySources('/repo/packages2', sources), false);
assert.equal(isRootCoveredBySources('/repo', sources), false); // source 不能反向覆盖父目录
console.log('Tailwind source coverage fixtures passed: 8 cases.');
