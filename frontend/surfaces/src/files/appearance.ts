import type { CSSProperties } from 'react';

// filesAccentStyle 让私有文件、分享管理和访客页使用同一套现有蓝色语义 Token。
export const filesAccentStyle: CSSProperties = {
  '--color-brand': 'var(--ds-brand)',
  '--color-brand-strong': 'var(--ds-brand-strong)',
  '--color-brand-soft': 'var(--ds-brand-soft)',
  '--color-on-brand': 'var(--ds-on-brand)',
} as CSSProperties;
