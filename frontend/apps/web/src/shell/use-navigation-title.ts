'use client';

import { useMemo } from 'react';
import { flattenNavigationLeaves } from '@clouddrive/core';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { combinedShellNavigationGroups } from './navigation';

/** Relabel persisted entrances from current IA without changing entity URLs or stored records. */
export function useNavigationTitle() {
  const { t } = useFrontendTranslation();
  const labels = useMemo(
    () =>
      new Map(
        flattenNavigationLeaves(combinedShellNavigationGroups.flatMap((group) => group.items)).map(
          ({ leaf }) => [leaf.href, t(leaf.labelKey)],
        ),
      ),
    [t],
  );
  return (href: string, fallback: string): string => labels.get(href) ?? fallback;
}
