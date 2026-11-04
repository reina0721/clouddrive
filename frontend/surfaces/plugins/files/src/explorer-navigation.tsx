'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { Menu, Cloud } from '../../../src/files/icons';

export function ExplorerNavigation({
  children,
  onFocusFiles,
}: {
  children: (onNavigate: () => void) => ReactNode;
  onFocusFiles: () => void;
}) {
  const { t } = useFrontendTranslation();
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) onFocusFiles();
    wasOpen.current = open;
  }, [open, onFocusFiles]);
  return (
    <>
      <aside className="hidden h-screen overflow-y-auto border-r border-border px-4 py-3 md:sticky md:top-0 md:block md:w-60 md:shrink-0">
        {children(() => {})}
      </aside>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 md:hidden">
        <Action size="sm" variant="quiet" onPress={() => setOpen(true)} leadingIcon={<Menu />}>
          {t('files.explorer.navigation')}
        </Action>
        <Cloud className="size-5 text-brand" />
        <span className="truncate font-semibold">{t('files.brand')}</span>
      </div>
      {open ? (
        <DrawerSurface
          placement="left"
          composition="navigation"
          triggerLabel={t('files.explorer.navigation')}
          title={t('files.explorer.navigation')}
          description={t('files.explorer.navigationHint')}
          closeLabel={t('files.close')}
          isOpen
          onOpenChange={setOpen}
        >
          <div className="px-4 py-3">{children(() => setOpen(false))}</div>
        </DrawerSurface>
      ) : null}
    </>
  );
}
