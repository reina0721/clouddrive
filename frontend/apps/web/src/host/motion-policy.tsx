'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import {
  MotionPolicyContext,
  type MotionCategoryState,
  type MotionMode,
  type MotionPolicyController,
  type MotionPolicyState,
  type MotionScale,
} from '@clouddrive/surface-foundation/motion-policy-context';

const motionSessionKey = 'clouddrive.motion-inspector';
const motionMediaQuery = '(prefers-reduced-motion: reduce)';
const inspectorAvailable = process.env.NODE_ENV !== 'production';
const defaultCategories: MotionCategoryState = {
  screen: true,
  async: true,
  reveal: true,
  swap: true,
  feedback: true,
  media: true,
};
const defaultPolicy: MotionPolicyState = {
  mode: 'system',
  scale: 1,
  categories: defaultCategories,
};

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(motionMediaQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readReducedMotion() {
  return window.matchMedia(motionMediaQuery).matches;
}

function readStoredPolicy(): MotionPolicyState {
  if (!inspectorAvailable || typeof window === 'undefined') return defaultPolicy;
  try {
    const value = window.sessionStorage.getItem(motionSessionKey);
    if (!value) return defaultPolicy;
    const parsed = JSON.parse(value) as Partial<MotionPolicyState>;
    const mode = ['system', 'full', 'reduced', 'off'].includes(parsed.mode ?? '')
      ? (parsed.mode as MotionMode)
      : defaultPolicy.mode;
    const scale = [1, 2, 4].includes(parsed.scale ?? 0)
      ? (parsed.scale as MotionScale)
      : defaultPolicy.scale;
    return {
      mode,
      scale,
      categories: { ...defaultCategories, ...parsed.categories },
    };
  } catch {
    return defaultPolicy;
  }
}

export type MotionUserPreference = 'system' | 'standard' | 'reduced';

/**
 * 用户动效偏好（外观/可访问性 → motion，即时生效并持久化）相对 Motion Inspector
 * （仅开发期 sessionStorage）的优先级：
 * - reduced：用户明确减少动效 → 强制 reduced（Inspector full/standard 不得覆盖）；
 * - standard：用户明确启用标准动效 → 强制 full；
 * - system：跟随 Inspector/OS（prefers-reduced-motion 由 CSS media query 处理，
 *   不把 OS 结果烘焙进 dataset，避免后续 OS 变化被 data-motion-mode='full' 绕过）。
 */
function resolveModeByPreference(
  preference: MotionUserPreference,
  resolvedInspectorMode: Exclude<MotionMode, 'system'>,
): Exclude<MotionMode, 'system'> {
  if (preference === 'reduced') return 'reduced';
  if (preference === 'standard') return 'full';
  return resolvedInspectorMode;
}

/** dataset 写入值：用户显式选择才硬设；system 交给 Inspector/OS（原语义）。 */
function datasetModeByPreference(
  preference: MotionUserPreference,
  inspectorMode: MotionMode,
): string {
  if (preference === 'reduced') return 'reduced';
  if (preference === 'standard') return 'full';
  return inspectorMode;
}

export function MotionPolicyProvider({
  children,
  preference = 'system',
}: Readonly<{ children: ReactNode; preference?: MotionUserPreference }>) {
  const systemReduced = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  );
  const [policy, setPolicy] = useState(readStoredPolicy);
  const resolvedMode = resolveModeByPreference(
    preference,
    policy.mode === 'system' ? (systemReduced ? 'reduced' : 'full') : policy.mode,
  );

  useEffect(() => {
    const html = document.documentElement;
    const datasetMode = datasetModeByPreference(
      preference,
      inspectorAvailable ? policy.mode : 'system',
    );
    html.dataset.motionMode = datasetMode;
    html.style.setProperty('--motion-debug-scale', String(inspectorAvailable ? policy.scale : 1));
    for (const [category, enabled] of Object.entries(policy.categories)) {
      html.dataset[`motion${category[0]?.toUpperCase()}${category.slice(1)}`] = enabled
        ? 'on'
        : 'off';
    }
    if (inspectorAvailable) {
      window.sessionStorage.setItem(motionSessionKey, JSON.stringify(policy));
    }
  }, [policy, preference]);

  const value: MotionPolicyController = {
    ...policy,
    resolvedMode,
    inspectorAvailable,
    setMode: (mode) => setPolicy((current) => ({ ...current, mode })),
    setScale: (scale) => setPolicy((current) => ({ ...current, scale })),
    setCategories: (categories) => setPolicy((current) => ({ ...current, categories })),
  };

  return <MotionPolicyContext value={value}>{children}</MotionPolicyContext>;
}
