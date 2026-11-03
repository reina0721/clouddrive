'use client';

import { useSettingsShell } from '../../src/settings-context';
import { NavigationSection } from '../../src/category-sections';

/**
 * 分类区段页（/settings 内页 Shell 的右侧内容）。侧边栏/搜索/PageHeader 由
 * routes/layout.tsx 持久化壳提供——本页只渲染分类区段，切换分类不重挂载壳。
 */
export default function SettingsPageContent() {
  const ctx = useSettingsShell();
  return <NavigationSection ctx={ctx} />;
}
