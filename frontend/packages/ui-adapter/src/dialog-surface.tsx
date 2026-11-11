import { Button as HeroButton } from '@heroui/react/button';
import { Modal } from '@heroui/react/modal';
import { OverlayTriggerAction } from './overlay-trigger';
import { actionStyles } from './action-styles';
import { useRef, useState, type ReactNode } from 'react';

export type DialogSurfaceProps = Readonly<{
  triggerLabel: string;
  title: string;
  description: string;
  children: ReactNode;
  cancelLabel: string;
  /** 压缩包等连续浏览工作区使用cover，普通确认保持lg。 */
  size?: 'lg' | 'cover';
  /** workspace 为连续阅读保留视口，使用紧凑边距；普通确认保持standard。 */
  layout?: 'standard' | 'workspace';
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
  size = 'lg',
  layout = 'standard',
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
        className="ui-overlay-motion bg-scrim"
      >
        <Modal.Container className="ui-overlay-motion" placement="center" size={size}>
          <Modal.Dialog
            className="ui-overlay-surface ui-dialog-layout w-full"
            {...(layout === 'workspace' ? { style: { height: '100dvh' } } : {})}
          >
            <Modal.Header
              className={
                layout === 'workspace'
                  ? 'shrink-0 border-b border-border px-3 py-3'
                  : 'shrink-0 border-b border-border px-6 py-5'
              }
            >
              <Modal.Heading className="text-lg font-bold text-ink">{title}</Modal.Heading>
              <p
                className={
                  layout === 'workspace'
                    ? 'mt-1 text-xs leading-5 text-ink-muted'
                    : 'mt-1 text-sm leading-6 text-ink-muted'
                }
              >
                {description}
              </p>
            </Modal.Header>
            <Modal.Body
              className={
                layout === 'workspace' ? 'ui-dialog-body px-3 py-3' : 'ui-dialog-body px-6 py-5'
              }
            >
              {children}
            </Modal.Body>
            {failed && failureMessage ? (
              <p className="px-6 pb-4 text-sm font-medium text-danger" role="alert">
                {failureMessage}
              </p>
            ) : null}
            <Modal.Footer
              className={
                layout === 'workspace'
                  ? 'flex shrink-0 flex-wrap justify-end gap-3 border-t border-border px-3 py-2'
                  : 'flex shrink-0 flex-wrap justify-end gap-3 border-t border-border px-6 py-4'
              }
            >
              <Modal.CloseTrigger
                aria-label={cancelLabel}
                className={actionStyles({ variant: 'quiet' }) + ' static w-auto min-w-20'}
                isDisabled={pending}
              >
                {cancelLabel}
              </Modal.CloseTrigger>
              {showConfirm ? (
                <HeroButton
                  className={actionStyles({ variant: 'primary' })}
                  isDisabled={confirmDisabled || pending}
                  aria-busy={pending || undefined}
                  onPress={() => void confirm()}
                >
                  {pending ? <span role="status">{confirmLabel}…</span> : confirmLabel}
                </HeroButton>
              ) : null}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
