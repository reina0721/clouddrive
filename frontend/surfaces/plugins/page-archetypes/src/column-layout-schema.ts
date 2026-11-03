import type { ColumnLayoutPersisted } from '../stores/column-layout';
const invalid = (): never => {
  throw new Error('column-layout: 记录损坏');
};
/** Validate both current records and v1 migrations at the untrusted storage boundary. */
export function parseColumnLayoutPersisted(value: unknown): ColumnLayoutPersisted {
  if (
    !value ||
    typeof value !== 'object' ||
    !('layouts' in value) ||
    !value.layouts ||
    typeof value.layouts !== 'object' ||
    Array.isArray(value.layouts)
  )
    return invalid();
  const layouts: Record<string, ColumnLayoutPersisted['layouts'][string]> = {};
  for (const [pageId, entry] of Object.entries(value.layouts)) {
    const row: unknown = entry;
    if (
      !row ||
      typeof row !== 'object' ||
      !('visibleOrder' in row) ||
      !Array.isArray(row.visibleOrder)
    )
      return invalid();
    const visibleOrder = row.visibleOrder.map((id: unknown) =>
      typeof id === 'string' ? id : invalid(),
    );
    const widths: Record<string, number> = {};
    if ('widths' in row && row.widths !== undefined) {
      if (!row.widths || typeof row.widths !== 'object' || Array.isArray(row.widths))
        return invalid();
      for (const [id, raw] of Object.entries(row.widths)) {
        const width: unknown = raw;
        if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return invalid();
        widths[id] = width;
      }
    }
    let sort: { columnId: string; direction: 'ascending' | 'descending' } | undefined;
    if ('sort' in row && row.sort !== undefined) {
      const candidate = row.sort;
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        !('columnId' in candidate) ||
        typeof candidate.columnId !== 'string' ||
        !('direction' in candidate) ||
        (candidate.direction !== 'ascending' && candidate.direction !== 'descending')
      )
        return invalid();
      sort = { columnId: candidate.columnId, direction: candidate.direction };
    }
    if (
      'customVisibility' in row &&
      row.customVisibility !== undefined &&
      typeof row.customVisibility !== 'boolean'
    )
      return invalid();
    layouts[pageId] = {
      visibleOrder: [...new Set(visibleOrder)],
      customVisibility:
        'customVisibility' in row && typeof row.customVisibility === 'boolean'
          ? row.customVisibility
          : true,
      ...('widths' in row ? { widths } : {}),
      ...(sort ? { sort } : {}),
    };
  }
  return { layouts };
}
