import { Button as HeroButton } from '@heroui/react/button';
import { Modal } from '@heroui/react/modal';
import { OverlayTriggerAction } from './overlay-trigger';
import { useRef, useState, type ReactNode } from 'react';

export type DialogSurfaceProps = Readonly<{
  triggerLabel: string;
  title: string;
  description: string;
  children: ReactNode;
  cancelLabel: string;
  /**
   * 可选确认动作：缺省时 Dialog 只保留关闭动作（设置面板等不需要二次确认的
   * 普通决策场景），不再强行渲染"确认"语义。
   */
  confirmLabel?: string;
  defaultOpen?: boolean;
  confirmDisabled?: boolean;
  failureMessage?: string;
  onConfirm?: () => void | Promise<void>;
  /**
   * 受控模式：提供 isOpen 时隐藏 trigger，由父级控制开关
   * （工具栏驱动的列设置等命令式面板）。triggerLabel 仍须提供（无障碍命名）。
   */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

export function DialogSurface({
  triggerLabel,
  title,
  description,
  children,
  cancelLabel,
  confirmLabel,
  defaultOpen = false,
  confirmDisabled = false,
  failureMessage,
  onConfirm,
  isOpen,
  onOpenChange,
}: DialogSurfaceProps) {
  const controlled = isOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlled ? isOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const showConfirm = Boolean(onConfirm) && Boolean(confirmLabel);

  const confirm = async () => {
    if (!onConfirm || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onOpenChange={(next) => {
        if (!pendingRef.current) setOpen(next);
      }}
    >
      {controlled ? null : (
        <OverlayTriggerAction onPress={() => setOpen(true)}>{triggerLabel}</OverlayTriggerAction>
      )}
      <Modal.Backdrop
        isDismissable={!pending}
        isKeyboardDismissDisabled={pending}
        className="ui-overlay-motion bg-scrim backdrop-blur-sm"
      >
        <Modal.Container className="ui-overlay-motion" placement="center" size="lg">
          <Modal.Dialog className="ui-overlay-surface ui-dialog-layout w-full">
            <Modal.Header className="shrink-0 border-b border-border px-6 py-5">
              <Modal.Heading className="text-lg font-bold text-ink">{title}</Modal.Heading>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>
            </Modal.Header>
            <Modal.Body className="ui-dialog-body px-6 py-5">{children}</Modal.Body>
            {failed && failureMessage ? (
              <p className="px-6 pb-4 text-sm font-medium text-danger" role="alert">
                {failureMessage}
              </p>
            ) : null}
            <Modal.Footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-border px-6 py-4">
              <Modal.CloseTrigger
                aria-label={cancelLabel}
                className="static inline-flex min-h-control w-auto min-w-20 items-center justify-center rounded-control border border-border bg-surface px-4 text-sm font-semibold leading-none text-ink shadow-sm hover:bg-surface-muted"
                isDisabled={pending}
              >
                {cancelLabel}
              </Modal.CloseTrigger>
              {showConfirm ? (
                <HeroButton
                  className="inline-flex min-h-control items-center justify-center rounded-control bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-strong"
                  isDisabled={confirmDisabled || pending}
                  isPending={pending}
                  onPress={() => void confirm()}
                >
                  {confirmLabel}
                </HeroButton>
              ) : null}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
