'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cloud, Menu } from '../../../src/files/icons';

export function ExplorerNavigation({
  children,
  collapsed = false,
  onFocusFiles,
}: {
  children: (onNavigate: () => void, mobile: boolean) => ReactNode;
  collapsed?: boolean;
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
      <aside
        className={
          'hidden h-full overflow-y-auto py-2 md:block md:shrink-0 ' +
          (collapsed ? 'px-1 md:w-20' : 'px-3 md:w-60')
        }
      >
        {children(() => {}, false)}
      </aside>
      <div className="flex shrink-0 items-center gap-2 px-3 py-1 md:hidden">
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
          <div className="flex h-full flex-col px-3 py-2">
            {children(() => setOpen(false), true)}
          </div>
        </DrawerSurface>
      ) : null}
    </>
  );
}
