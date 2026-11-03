export function isFoundationDependencyAllowed(owner, target) {
  if (owner.layer === 'universal') return target.layer === 'universal';
  if (owner.layer === 'surface') {
    return target.layer === 'universal' || target.layer === 'surface';
  }
  return target.layer === 'universal' || target.layer === 'surface';
}

export function getFoundationWorkspaceNameViolation(workspace, classification) {
  if (classification.layer === 'surface') {
    const kind = classification.kind ?? 'foundation';
    if (kind === 'foundation' && workspace !== 'packages/surface-foundation') {
      return 'Surface Foundation 必须位于 packages/surface-foundation';
    }
    if (kind === 'framework' && workspace !== 'packages/plugin-framework') {
      return 'Plugin Framework 必须位于 packages/plugin-framework';
    }
    if (kind === 'surface' && workspace !== 'surfaces') {
      return 'Product Surface 实现必须以 surfaces 为 workspace 根目录';
    }
  }
  if (classification.layer === 'host' && workspace !== 'apps/web') {
    return 'Web Host 必须位于 apps/web';
  }
  return null;
}
