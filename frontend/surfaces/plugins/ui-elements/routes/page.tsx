'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoadingSurface } from '@clouddrive/surface-foundation/states-operations';

/**
 * /ui-elements 根路径：重定向到默认子级 actions-selection（Next 原生 replace）。
 * 不依赖 Host 导航进度事务层（navigation-lifecycle），保持 Plugin 自足。
 */
export default function UiElementsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    void router.replace('/ui-elements/actions-selection');
  }, [router]);
  return <PageLoadingSurface kind="catalog" label="UI Elements 正在加载" />;
}
