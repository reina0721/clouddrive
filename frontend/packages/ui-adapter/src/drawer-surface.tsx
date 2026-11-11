import { Drawer } from '@heroui/react/drawer';
import { OverlayTriggerAction } from './overlay-trigger';
import { useState, type ReactNode } from 'react';

export type DrawerSurfaceProps = Readonly<{
  triggerLabel: string;
  title: string;
  description: string;
  children: ReactNode;
  /** 固定操作区位于滚动内容之外，可通过 form 关联正文中的表单。 */
  footer?: ReactNode;
  busy?: boolean;
  closeLabel: string;
  defaultOpen?: boolean;
  placement?: 'left' | 'right';
  composition?: 'standard' | 'navigation';
  /** 受控模式：提供 isOpen/onOpenChange 时隐藏 trigger，由父级控制开关。 */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

export function DrawerSurface({
  triggerLabel,
  title,
  description,
  children,
  footer,
  busy = false,
  closeLabel,
  defaultOpen = false,
  isOpen,
  onOpenChange,
  placement = 'right',
  composition = 'standard',
}: DrawerSurfaceProps) {
  const controlled = isOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlled ? isOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (busy && !next) return;
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };
  return (
    <Drawer isOpen={open} onOpenChange={setOpen}>
      {controlled ? null : <OverlayTriggerAction>{triggerLabel}</OverlayTriggerAction>}
      <Drawer.Backdrop
        isDismissable={!busy}
        isKeyboardDismissDisabled={busy}
        className="ui-overlay-motion bg-scrim"
      >
        <Drawer.Content className="ui-overlay-motion" placement={placement}>
          <Drawer.Dialog
            className={`ui-overlay-surface relative flex h-full w-full flex-col border-0 rounded-none ${placement === 'left' ? 'rounded-r-panel' : 'rounded-l-panel'} ${composition === 'navigation' ? 'max-w-sm' : 'max-w-lg'}`}
          >
            <Drawer.Header className="shrink-0 px-6 py-5 pr-20">
              <Drawer.Heading
                title={title}
                className="min-w-0 line-clamp-2 break-words text-lg font-bold text-ink sm:line-clamp-none"
              >
                {title}
              </Drawer.Heading>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>
              <Drawer.CloseTrigger
                aria-label={closeLabel}
                isDisabled={busy}
                className="ui-action absolute right-5 top-5 grid size-control min-w-control place-items-center rounded-action border-0 bg-transparent text-xl leading-none text-ink hover:bg-surface-muted"
              >
                <span aria-hidden="true">×</span>
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body
              className={
                composition === 'navigation'
                  ? 'min-h-0 flex-1 overflow-hidden p-0 text-ink'
                  : 'min-h-0 flex-1 overflow-y-auto px-6 py-5 text-ink'
              }
            >
              {children}
            </Drawer.Body>
            {footer ? (
              <Drawer.Footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border px-6 py-4">
                {footer}
              </Drawer.Footer>
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
