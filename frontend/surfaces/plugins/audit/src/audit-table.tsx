'use client';
import {
  DataTable,
  type DataColumn,
  type DataTableDensity,
  type DataTableSelection,
} from '@clouddrive/ui-adapter/data-display';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type { AuditRecord } from '@clouddrive/surface/identity/runtime';

export function AuditTable({
  columns,
  rows,
  density,
  selection,
}: Readonly<{
  columns: readonly DataColumn<AuditRecord>[];
  rows: readonly AuditRecord[];
  density?: DataTableDensity;
  selection?: DataTableSelection;
}>) {
  const { t } = useFrontendTranslation();
  return (
    <DataTable
      label={t('audit.nav')}
      columns={columns}
      rows={rows}
      emptyContent={<p className="p-5 text-ink-muted">{t('audit.empty')}</p>}
      {...(density ? { density } : {})}
      {...(selection ? { selection } : {})}
    />
  );
}
