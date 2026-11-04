'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useFileNavigation, useFiles } from '../../../src/files/runtime';
import { FilesError } from '../../../src/files/model';
import type { Pin, PinListing, PinTarget } from '../../../src/files/navigation';

export function PinnedLinks({
  refreshKey = 0,
  onNavigate,
}: {
  refreshKey?: number;
  onNavigate?: () => void;
}) {
  const nav = useFileNavigation(),
    files = useFiles(),
    { t } = useFrontendTranslation();
  const [snapshot, setSnapshot] = useState<PinListing>(),
    [failure, setFailure] = useState(''),
    [revision, setRevision] = useState(0),
    [managing, setManaging] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void nav
      .pins(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setSnapshot(value);
          setFailure('');
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
      });
    return () => controller.abort();
  }, [nav, revision, refreshKey, t]);
  const label = (pin: Pin) =>
    pin.name ||
    (pin.targetKind === 'shared'
      ? t('files.navigation.title')
      : pin.targetKind === 'folder' && !pin.targetId
        ? t('files.nav')
        : t('files.navigation.unavailablePin'));
  async function mutate(action: () => Promise<void>) {
    setBusy(true);
    setFailure('');
    try {
      await action();
      setSnapshot(undefined);
      setRevision((value) => value + 1);
    } catch (error) {
      setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 space-y-2 px-3 text-sm" aria-label={t('files.navigation.pins')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink-muted">{t('files.navigation.pins')}</h2>
        <Action size="sm" variant="quiet" onPress={() => setManaging(true)}>
          {t('files.navigation.manage')}
        </Action>
      </div>
      {failure ? (
        <p role="alert" className="text-danger">
          {failure}
          <Action variant="quiet" onPress={() => setRevision((value) => value + 1)}>
            {t('files.refresh')}
          </Action>
        </p>
      ) : null}
      {snapshot?.items.length === 0 ? (
        <p className="text-xs text-ink-muted">{t('files.navigation.emptyPins')}</p>
      ) : null}
      <ul className="space-y-1">
        {snapshot?.items.map((pin) => (
          <li key={pin.id}>
            {pin.available ? (
              <a
                className="block break-words rounded-control px-2 py-2 hover:bg-surface-muted"
                href={nav.pinHref(pin)}
                target={pin.targetKind === 'shortcut' ? '_blank' : undefined}
                rel={pin.targetKind === 'shortcut' ? 'noopener noreferrer' : undefined}
                onClick={(event) => {
                  if (
                    pin.targetKind === 'folder' &&
                    !event.ctrlKey &&
                    !event.metaKey &&
                    !event.shiftKey &&
                    !event.altKey &&
                    event.button === 0
                  ) {
                    event.preventDefault();
                    files.openFolder(pin.targetId);
                    onNavigate?.();
                  }
                }}
              >
                {label(pin)}
                {pin.locked ? ' 🔒' : ''}
              </a>
            ) : (
              <span className="block break-words px-2 py-2 text-ink-muted">
                {label(pin)} · {t('files.navigation.unavailablePin')}
              </span>
            )}
          </li>
        ))}
      </ul>
      {managing ? (
        <DialogSurface
          triggerLabel={t('files.navigation.manage')}
          title={t('files.navigation.manage')}
          description={t('files.navigation.pinHint')}
          cancelLabel={t('files.cancel')}
          confirmLabel={t('files.close')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setManaging(false);
          }}
          confirmDisabled={busy}
          onConfirm={() => {
            setManaging(false);
          }}
        >
          <div className="space-y-3">
            {failure ? (
              <p role="alert" className="text-danger">
                {failure}
              </p>
            ) : null}
            {snapshot?.metadataLimited ? (
              <p role="alert">{t('files.navigation.metadataLimited')}</p>
            ) : null}
            <Action
              variant="secondary"
              disabled={busy}
              onPress={() => setRevision((value) => value + 1)}
            >
              {t('files.refresh')}
            </Action>
            {snapshot?.items.map((pin, index) => (
              <div
                key={pin.id}
                className="flex flex-wrap items-center gap-2 border-b border-border py-3"
              >
                <span className="min-w-0 flex-1 break-words">{label(pin)}</span>
                {(['up', 'down'] as const).map((direction) => (
                  <Action
                    key={direction}
                    size="sm"
                    variant="secondary"
                    disabled={
                      busy ||
                      (direction === 'up' ? index === 0 : index === snapshot.items.length - 1)
                    }
                    onPress={() => {
                      const ids = snapshot.items.map((item) => item.id),
                        target = index + (direction === 'up' ? -1 : 1);
                      [ids[index], ids[target]] = [ids[target]!, ids[index]!];
                      void mutate(() => nav.reorderPins(snapshot, ids));
                    }}
                  >
                    {t(`files.navigation.${direction}`)}
                  </Action>
                ))}
                <Action
                  variant="quiet"
                  size="sm"
                  disabled={busy}
                  onPress={() => {
                    void mutate(() => nav.removePin(snapshot, pin.id));
                  }}
                >
                  {t('files.navigation.unpin')}
                </Action>
              </div>
            ))}
          </div>
        </DialogSurface>
      ) : null}
    </section>
  );
}

export function PinDialog({
  target,
  onClose,
  onChanged,
}: {
  target: PinTarget;
  onClose: () => void;
  onChanged: () => void;
}) {
  const nav = useFileNavigation(),
    { t } = useFrontendTranslation();
  const [snapshot, setSnapshot] = useState<PinListing>(),
    [failure, setFailure] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void nav
      .pins(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setSnapshot(value);
          setFailure('');
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
      });
    return () => controller.abort();
  }, [nav, revision, t]);
  return (
    <DialogSurface
      triggerLabel={t('files.navigation.pin')}
      title={t('files.navigation.pin')}
      description={t('files.navigation.pinHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.navigation.pin')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      confirmDisabled={!snapshot || snapshot.items.length >= snapshot.limit}
      failureMessage={failure}
      onConfirm={async () => {
        if (!snapshot) return;
        setFailure('');
        try {
          await nav.addPin(snapshot, target);
          onChanged();
        } catch (error) {
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
          throw error;
        }
      }}
    >
      <div className="space-y-3">
        {snapshot ? (
          <p>
            {snapshot.items.length} / {snapshot.limit}
          </p>
        ) : null}
        {failure && !snapshot ? (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        ) : null}
        <Action
          variant="secondary"
          onPress={() => {
            setSnapshot(undefined);
            setFailure('');
            setRevision((value) => value + 1);
          }}
        >
          {t('files.refresh')}
        </Action>
      </div>
    </DialogSurface>
  );
}
