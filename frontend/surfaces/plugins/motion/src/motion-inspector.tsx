'use client';

import { ToggleGroup } from '@clouddrive/ui-adapter/toggle-group';

import {
  useMotionPolicy,
  type MotionCategory,
  type MotionMode,
  type MotionScale,
} from '@clouddrive/surface-foundation/motion-policy-context';

const modes: readonly MotionMode[] = ['system', 'full', 'reduced', 'off'];
const scales: readonly MotionScale[] = [1, 2, 4];
const categories: readonly MotionCategory[] = [
  'screen',
  'async',
  'reveal',
  'swap',
  'feedback',
  'media',
];

/** MotionInspector 只在 development 暴露运行期策略覆盖，不进入业务组件 props。 */
export function MotionInspector() {
  const policy = useMotionPolicy();
  if (!policy.inspectorAvailable) return null;

  return (
    <div className="grid gap-5" data-testid="motion-inspector">
      <ToggleGroup
        label="Motion mode"
        options={modes.map((mode) => ({ id: mode, label: mode }))}
        selectedIds={[policy.mode]}
        selectionMode="single"
        onSelectionChange={(selected) => {
          const mode = selected[0] as MotionMode | undefined;
          if (mode) policy.setMode(mode);
        }}
      />
      <ToggleGroup
        label="Slow motion"
        options={scales.map((scale) => ({ id: String(scale), label: `${scale}×` }))}
        selectedIds={[String(policy.scale)]}
        selectionMode="single"
        onSelectionChange={(selected) => {
          const scale = Number(selected[0]) as MotionScale;
          if (scales.includes(scale)) policy.setScale(scale);
        }}
      />
      <ToggleGroup
        label="Motion categories"
        description="关闭某类只影响对应 recipe，不改变业务状态。"
        options={categories.map((category) => ({ id: category, label: category }))}
        selectedIds={categories.filter((category) => policy.categories[category])}
        selectionMode="multiple"
        onSelectionChange={(selected) => {
          const selectedSet = new Set(selected);
          policy.setCategories(
            Object.fromEntries(
              categories.map((category) => [category, selectedSet.has(category)]),
            ) as Record<MotionCategory, boolean>,
          );
        }}
      />
    </div>
  );
}
