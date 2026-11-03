import { useFrontendTranslation } from '@clouddrive/i18n';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { CheckboxField } from '@clouddrive/ui-adapter/form-field';

export function ColumnSettingsDialog({
  columns,
  orderedIds,
  mandatoryColumns,
  onVisibleOrderChange,
  onMove,
  isOpen,
  onOpenChange,
}: Readonly<{
  columns: readonly { id: string; label: string }[];
  orderedIds: readonly string[];
  mandatoryColumns: ReadonlySet<string>;
  onVisibleOrderChange: (ids: readonly string[]) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const { t } = useFrontendTranslation();
  return (
    <ConfirmDialog
      cancelLabel={t('reference.cancel')}
      confirmLabel={t('reference.confirm')}
      description={t('reference.columnSettingsDescription')}
      failureMessage={t('reference.exportFailure')}
      impact={
        <div className="flex flex-col gap-1">
          {columns.map((column) => {
            const visible = orderedIds.includes(column.id);
            const mandatory = mandatoryColumns.has(column.id);
            const idx = orderedIds.indexOf(column.id);
            return (
              <div
                className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-2"
                key={column.id}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <CheckboxField
                    checked={visible}
                    disabled={mandatory}
                    label={column.label}
                    onCheckedChange={() => {
                      const next = visible
                        ? orderedIds.filter((id) => id !== column.id)
                        : [...orderedIds, column.id];
                      onVisibleOrderChange(next);
                    }}
                  />
                  {mandatory ? (
                    <span className="text-xs text-ink-muted">{t('reference.columnMandatory')}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1">
                  <button
                    aria-label={t('reference.columnMoveLeft', { column: column.label })}
                    className="grid size-7 place-items-center rounded-control border border-border bg-surface text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
                    disabled={!visible || idx <= 0}
                    onClick={() => onMove(column.id, -1)}
                    type="button"
                  >
                    ←
                  </button>
                  <button
                    aria-label={t('reference.columnMoveRight', { column: column.label })}
                    className="grid size-7 place-items-center rounded-control border border-border bg-surface text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
                    disabled={!visible || idx < 0 || idx >= orderedIds.length - 1}
                    onClick={() => onMove(column.id, 1)}
                    type="button"
                  >
                    →
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      }
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onConfirm={() => onOpenChange(false)}
      title={t('reference.columnSettingsTitle')}
      triggerLabel=""
    />
  );
}
