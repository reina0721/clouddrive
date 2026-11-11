'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { CurrentSiteLogo, useSiteProfile } from '@clouddrive/surface/administration/runtime';
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
  const { profile } = useSiteProfile();
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    // 等待抽屉清除背景隔离和恢复焦点，再把焦点交给文件区域。
    const frame = requestAnimationFrame(onFocusFiles);
    return () => cancelAnimationFrame(frame);
  }, [open, onFocusFiles]);
  return (
    <>
      <aside
        className={
          'hidden h-full min-h-0 py-4 md:block md:shrink-0 ' +
          (collapsed ? 'px-1 md:w-20' : 'px-3 md:w-64')
        }
      >
        {children(() => {}, false)}
      </aside>
      <div className="flex shrink-0 items-center gap-2 px-3 py-1 md:hidden">
        <Action size="sm" variant="quiet" onPress={() => setOpen(true)} leadingIcon={<Menu />}>
          {t('files.explorer.navigation')}
        </Action>
        <CurrentSiteLogo
          className="size-5 shrink-0"
          fallback={<Cloud className="size-5 text-brand" />}
        />
        <span className="truncate font-semibold">{profile?.name || t('files.brand')}</span>
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
