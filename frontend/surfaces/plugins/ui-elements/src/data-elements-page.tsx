'use client';

import { Action } from '@clouddrive/ui-adapter/action';
import {
  AreaChart,
  BarChart,
  DonutChart,
  Sparkline,
  type ChartSegment,
  type ChartSeries,
} from '@clouddrive/ui-adapter/charts';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import { Badge } from '@clouddrive/ui-adapter/feedback';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { ToggleGroup } from '@clouddrive/ui-adapter/toggle-group';
import type { DataColumn } from '@clouddrive/ui-adapter/data-display';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFrontendTranslation, formatNumber } from '@clouddrive/i18n';
import { Section } from '@clouddrive/surface-foundation/layout';
import {
  CollectionToolbar,
  type ColumnSettingsText,
  type DensityLevel,
} from '@clouddrive/surface-foundation/collection-tools';
import { toCsv, type CsvColumn } from '@clouddrive/core';
import { usePluginLocale } from '@clouddrive/plugin-framework/plugin';
import { ComponentPreview } from './component-preview';
import { UiElementsFamilyPage } from './family-page';
import { browserCsvExport } from './browser-csv-export';

type UiElementsDataRow = Readonly<{
  id: string;
  element: string;
  owner: string;
  status: string;
  tone: 'success' | 'warning' | 'info';
}>;

type UiElementsTreeRow = UiElementsDataRow & Readonly<{ children?: readonly UiElementsTreeRow[] }>;

type CsvDemoRow = Readonly<{ id: string; element: string; owner: string; note: string }>;

export function DataElementsPage() {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const searchParams = useSearchParams();
  const { locale } = usePluginLocale();
  const [columnWidths, setColumnWidths] = useState<Readonly<Record<string, number>>>({});
  const [selectedTableId, setSelectedTableId] = useState('UI-001');
  const [selectedTableIds, setSelectedTableIds] = useState<readonly string[]>([]);
  const [tableMode, setTableMode] = useState<'single' | 'multiple' | 'empty'>(
    searchParams.get('data') === 'empty' ? 'empty' : 'single',
  );
  const [tableSort, setTableSort] = useState<{
    columnId: string;
    direction: 'ascending' | 'descending';
  }>({ columnId: 'element', direction: 'descending' });
  const tableRows: readonly UiElementsDataRow[] = [
    {
      id: 'UI-001',
      element: t('uiElements.dataTableRows.tokens'),
      owner: t('uiElements.dataTableOwners.foundation'),
      status: t('uiElements.dataTableStatus.ready'),
      tone: 'success',
    },
    {
      id: 'UI-002',
      element: t('uiElements.dataTableRows.formControl'),
      owner: t('uiElements.dataTableOwners.interaction'),
      status: t('uiElements.dataTableStatus.review'),
      tone: 'warning',
    },
    {
      id: 'UI-003',
      element: t('uiElements.dataTableRows.overlaySurface'),
      owner: t('uiElements.dataTableOwners.composition'),
      status: t('uiElements.dataTableStatus.verified'),
      tone: 'info',
    },
  ];
  const tableColumns: readonly DataColumn<UiElementsDataRow>[] = [
    {
      id: 'element',
      label: t('uiElements.dataTableColumns.element'),
      rowHeader: true,
      sortable: true,
      render: (row) => (
        <div className="min-w-40">
          <p className="font-semibold text-ink">{row.element}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{row.id}</p>
        </div>
      ),
    },
    {
      id: 'owner',
      label: t('uiElements.dataTableColumns.owner'),
      sortable: true,
      render: (row) => row.owner,
    },
    {
      id: 'status',
      label: t('uiElements.dataTableColumns.status'),
      render: (row) => <StatusPill tone={row.tone}>{row.status}</StatusPill>,
    },
  ];
  const visibleTableColumns = tableColumns;
  const visibleTableRows = [...tableRows].sort((left, right) => {
    const leftValue = String(left[tableSort.columnId as keyof UiElementsDataRow]);
    const rightValue = String(right[tableSort.columnId as keyof UiElementsDataRow]);
    const result = leftValue.localeCompare(rightValue, locale);
    return tableSort.direction === 'ascending' ? result : -result;
  });

  // 生产力示例使用独立演示数据（不与治理表行标题重名，页面级可访问定位保持唯一）。
  const productivityRows: readonly UiElementsDataRow[] = [
    {
      id: 'PT-001',
      element: t('uiElements.dataDemoRows.tokens'),
      owner: t('uiElements.dataTableOwners.foundation'),
      status: t('uiElements.dataTableStatus.ready'),
      tone: 'success',
    },
    {
      id: 'PT-002',
      element: t('uiElements.dataDemoRows.primitives'),
      owner: t('uiElements.dataTableOwners.interaction'),
      status: t('uiElements.dataTableStatus.review'),
      tone: 'warning',
    },
    {
      id: 'PT-003',
      element: t('uiElements.dataDemoRows.overlays'),
      owner: t('uiElements.dataTableOwners.composition'),
      status: t('uiElements.dataTableStatus.verified'),
      tone: 'info',
    },
  ];
  const csvDemoRows: readonly CsvDemoRow[] = [
    {
      id: productivityRows[0]!.id,
      element: productivityRows[0]!.element,
      owner: productivityRows[0]!.owner,
      note: t('uiElements.dataCsvNotes.first'),
    },
    {
      id: productivityRows[1]!.id,
      element: productivityRows[1]!.element,
      owner: productivityRows[1]!.owner,
      note: t('uiElements.dataCsvNotes.second'),
    },
    {
      id: productivityRows[2]!.id,
      element: productivityRows[2]!.element,
      owner: productivityRows[2]!.owner,
      note: t('uiElements.dataCsvNotes.third'),
    },
  ];

  // 固定列示例：列数超过容器宽度时，首列 sticky 并保持行标题可见。
  const pinnedColumns: readonly DataColumn<UiElementsDataRow>[] = [
    tableColumns[0]!,
    {
      id: 'note',
      label: t('uiElements.dataTableColumns.note'),
      render: (row) => <span className="whitespace-nowrap">{row.id}</span>,
    },
    tableColumns[1]!,
    {
      id: 'updated',
      label: t('uiElements.dataTableColumns.updated'),
      render: () => <span className="whitespace-nowrap">{t('uiElements.dataDemoUpdated')}</span>,
    },
    tableColumns[2]!,
  ];

  // 树形行示例：rows 保持扁平（顶层），childrenOf 派生层级；aria-expanded 由 DataTable 维护。
  const treeRows: readonly UiElementsTreeRow[] = [
    {
      ...productivityRows[0]!,
      children: [
        {
          id: 'PT-001-A',
          element: t('uiElements.dataTreeChildren.color'),
          owner: t('uiElements.dataTableOwners.foundation'),
          status: t('uiElements.dataTableStatus.ready'),
          tone: 'success',
        },
        {
          id: 'PT-001-B',
          element: t('uiElements.dataTreeChildren.spacing'),
          owner: t('uiElements.dataTableOwners.foundation'),
          status: t('uiElements.dataTableStatus.verified'),
          tone: 'info',
        },
      ],
    },
    {
      ...productivityRows[1]!,
      children: [
        {
          id: 'PT-002-A',
          element: t('uiElements.dataTreeChildren.input'),
          owner: t('uiElements.dataTableOwners.interaction'),
          status: t('uiElements.dataTableStatus.review'),
          tone: 'warning',
        },
      ],
    },
    productivityRows[2]!,
  ];
  const [expandedTreeIds, setExpandedTreeIds] = useState<ReadonlySet<string>>(new Set());

  // 列设置 / 密度 / CSV 导出示例：与业务页使用同一套 CollectionToolbar 组合。
  const toolbarColumns: readonly {
    id: string;
    label: string;
    mandatory?: boolean;
    render: (row: CsvDemoRow) => ReactNode;
  }[] = [
    {
      id: 'element',
      label: t('uiElements.dataTableColumns.element'),
      mandatory: true,
      render: (row) => row.element,
    },
    {
      id: 'owner',
      label: t('uiElements.dataTableColumns.owner'),
      render: (row) => row.owner,
    },
    {
      id: 'note',
      label: t('uiElements.dataTableColumns.note'),
      render: (row) => <span className="whitespace-nowrap">{row.note}</span>,
    },
  ];
  const [visibleOrder, setVisibleOrder] = useState<readonly string[]>(['element', 'owner', 'note']);
  const [toolbarDensity, setToolbarDensity] = useState<DensityLevel>('standard');
  const columnSettingsText: ColumnSettingsText = {
    title: t('uiElements.dataColumnSettingsTitle'),
    description: t('uiElements.dataColumnSettingsDescription'),
    mandatory: t('uiElements.dataColumnMandatory'),
    reset: t('uiElements.dataColumnReset'),
    close: t('uiElements.dataColumnClose'),
    moveUp: (columnLabel) => t('uiElements.dataColumnMoveUp', { column: columnLabel }),
    moveDown: (columnLabel) => t('uiElements.dataColumnMoveDown', { column: columnLabel }),
  };
  const visibleToolbarColumns = visibleOrder.flatMap((id) => {
    const column = toolbarColumns.find((item) => item.id === id);
    return column
      ? [
          {
            id: column.id,
            label: column.label,
            ...(column.id === 'element' ? { rowHeader: true } : {}),
            render: (row: CsvDemoRow) => column.render(row),
          } satisfies DataColumn<CsvDemoRow>,
        ]
      : [];
  });
  const exportDemoCsv = async () => {
    try {
      const csvColumns: readonly CsvColumn[] = visibleToolbarColumns.map((column) => ({
        id: column.id,
        label: column.label,
      }));
      const rows = csvDemoRows.map((row) => ({
        element: row.element,
        owner: row.owner,
        note: row.note,
      }));
      await browserCsvExport.downloadCsv('ui-elements-table.csv', toCsv(rows, csvColumns));
      notify({
        title: t('uiElements.dataExportSuccess', { count: csvDemoRows.length }),
        tone: 'success',
      });
    } catch {
      notify({ title: t('uiElements.dataExportFailure'), tone: 'danger' });
    }
  };

  // Charts Showcase：与 /analytics 使用同一套 chart primitives 与语义 token。
  const chartFormat = (value: number) => formatNumber(locale, value);
  const chartVisits: readonly ChartSeries[] = [
    {
      id: 'visits',
      label: t('uiElements.charts.areaSeriesVisits'),
      points: [0, 1, 2, 3, 4, 5, 6].map((x) => ({
        x,
        y: [420, 780, 640, 960, 880, 1230, 1080][x]!,
      })),
    },
    {
      id: 'downloads',
      label: t('uiElements.charts.areaSeriesDownloads'),
      points: [0, 1, 2, 3, 4, 5, 6].map((x) => ({ x, y: [120, 240, 200, 320, 300, 420, 380][x]! })),
    },
  ];
  const chartSources: readonly ChartSegment[] = [
    { id: 'direct', label: t('uiElements.charts.donutDirect'), value: 48 },
    { id: 'search', label: t('uiElements.charts.donutSearch'), value: 34 },
    { id: 'referral', label: t('uiElements.charts.donutReferral'), value: 18 },
  ];
  const chartPages: readonly ChartSegment[] = [
    { id: 'docs', label: t('uiElements.charts.barDocs'), value: 520 },
    { id: 'settings', label: t('uiElements.charts.barSettings'), value: 410 },
    { id: 'analytics', label: t('uiElements.charts.barAnalytics'), value: 360 },
    { id: 'workspace', label: t('uiElements.charts.barWorkspace'), value: 280 },
  ];
  const sparklineValues = [18, 24, 21, 32, 28, 36, 33, 41, 38, 46];

  return (
    <UiElementsFamilyPage
      familyId="data"
      title={t('uiElements.dataDisplayTitle')}
      description={t('uiElements.dataDisplayDescription')}
    >
      {({ density }) => (
        <>
          <Section
            id="data"
            title={t('uiElements.dataDisplayTitle')}
            description={t('uiElements.dataDisplayDescription')}
          >
            <div className="p-5">
              <ComponentPreview
                fullWidth
                name="DataTable"
                description={t('uiElements.catalog.dataTableDescription')}
                states={[
                  'Display',
                  'Sort',
                  'Single / multiple selection',
                  'Row header',
                  'Empty',
                  'Density',
                  'Overflow',
                ]}
              >
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <ToggleGroup
                    label={t('uiElements.catalog.tableMode')}
                    options={[
                      { id: 'single', label: t('uiElements.catalog.singleSelection') },
                      { id: 'multiple', label: t('uiElements.catalog.multipleSelection') },
                      { id: 'empty', label: t('uiElements.dataTableShowEmpty') },
                    ]}
                    selectedIds={[tableMode]}
                    onSelectionChange={(ids) => {
                      const mode = ids[0];
                      if (mode === 'single' || mode === 'multiple' || mode === 'empty')
                        setTableMode(mode);
                    }}
                    selectionMode="single"
                    size="sm"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">
                      {density} · {visibleTableColumns.length} columns
                    </Badge>
                    <Action
                      size="sm"
                      variant="secondary"
                      onPress={() => setTableMode(tableMode === 'empty' ? 'single' : 'empty')}
                    >
                      {tableMode === 'empty'
                        ? t('uiElements.dataTableRestoreRows')
                        : t('uiElements.dataTableShowEmpty')}
                    </Action>
                  </div>
                </div>
                <div className="mt-4">
                  <DataTable
                    label={t('uiElements.dataTableLabel')}
                    columns={visibleTableColumns}
                    columnWidths={columnWidths}
                    onColumnWidthsChange={setColumnWidths}
                    density={density}
                    emptyContent={t('uiElements.dataTableEmpty')}
                    rows={tableMode === 'empty' ? [] : visibleTableRows}
                    selection={
                      tableMode === 'multiple'
                        ? {
                            mode: 'multiple',
                            selectedIds: selectedTableIds,
                            onSelectionChange: setSelectedTableIds,
                          }
                        : {
                            ...(tableMode === 'empty' ? {} : { selectedId: selectedTableId }),
                            onSelectionChange: setSelectedTableId,
                          }
                    }
                    sort={{
                      ...tableSort,
                      onSortChange: (columnId, direction) => setTableSort({ columnId, direction }),
                    }}
                  />
                </div>
              </ComponentPreview>
            </div>
          </Section>
          <Section
            id="data-productivity"
            title={t('uiElements.dataProductivityTitle')}
            description={t('uiElements.dataProductivityDescription')}
          >
            <div className="grid gap-4 p-5 lg:grid-cols-2">
              <ComponentPreview
                name="DataTable · Pinned columns"
                description={t('uiElements.dataPinnedDescription')}
                states={['Display', 'Overflow', 'Boundary', 'Density']}
              >
                <DataTable
                  density="compact"
                  label={t('uiElements.dataPinnedTableLabel')}
                  columns={pinnedColumns}
                  emptyContent={t('uiElements.dataTableEmpty')}
                  pinnedColumnIds={['element']}
                  rows={productivityRows}
                />
              </ComponentPreview>
              <ComponentPreview
                name="DataTable · Tree rows"
                description={t('uiElements.dataTreeDescription')}
                states={['Tree rows', 'Expanded', 'Collapsed', 'Keyboard']}
              >
                <DataTable
                  label={t('uiElements.dataTreeTableLabel')}
                  columns={tableColumns}
                  emptyContent={t('uiElements.dataTableEmpty')}
                  rows={treeRows}
                  tree={{
                    expandedIds: expandedTreeIds,
                    onExpandedChange: setExpandedTreeIds,
                    childrenOf: (row) => row.children ?? [],
                    expandLabel: (row) => t('uiElements.dataTreeExpand', { name: row.element }),
                    collapseLabel: (row) => t('uiElements.dataTreeCollapse', { name: row.element }),
                  }}
                />
              </ComponentPreview>
              <ComponentPreview
                embedded
                fullWidth
                name="CollectionToolbar · Column settings / Density / CSV"
                description={t('uiElements.dataToolbarDescription')}
                states={['Column settings', 'Density', 'CSV export', 'Keyboard']}
              >
                <div className="flex flex-col gap-4">
                  <CollectionToolbar
                    label={t('uiElements.dataToolbarLabel')}
                    columnSettings={{
                      triggerLabel: t('uiElements.dataColumnSettings'),
                      columns: toolbarColumns.map((column) => ({
                        id: column.id,
                        label: column.label,
                        mandatory: Boolean(column.mandatory),
                      })),
                      visibleOrder,
                      onChange: setVisibleOrder,
                      onReset: () => setVisibleOrder(['element', 'owner', 'note']),
                      text: columnSettingsText,
                    }}
                    density={{
                      label: t('uiElements.dataDensity'),
                      value: toolbarDensity,
                      labels: {
                        compact: t('uiElements.dataDensityCompact'),
                        standard: t('uiElements.dataDensityStandard'),
                        comfortable: t('uiElements.dataDensityComfortable'),
                      },
                      onChange: setToolbarDensity,
                    }}
                    exportMenu={{
                      label: t('uiElements.dataExport'),
                      menuLabel: t('uiElements.dataExportMenu'),
                      items: [
                        {
                          id: 'csv',
                          label: t('uiElements.dataExportCsv', { count: csvDemoRows.length }),
                          onSelect: () => void exportDemoCsv(),
                        },
                      ],
                    }}
                  >
                    <p className="text-sm text-ink-muted">{t('uiElements.dataToolbarHint')}</p>
                  </CollectionToolbar>
                  <DataTable
                    density={toolbarDensity}
                    label={t('uiElements.dataToolbarTableLabel')}
                    columns={visibleToolbarColumns}
                    emptyContent={t('uiElements.dataTableEmpty')}
                    rows={csvDemoRows}
                  />
                </div>
              </ComponentPreview>
            </div>
          </Section>

          <Section
            description={t('uiElements.charts.description')}
            id="charts"
            title={t('uiElements.charts.title')}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <ComponentPreview
                description={t('uiElements.charts.description')}
                name="AreaChart"
                states={['Theme', 'Responsive', 'Keyboard', 'Accessible summary']}
              >
                <AreaChart
                  formatValue={chartFormat}
                  label={t('uiElements.charts.areaLabel')}
                  series={chartVisits}
                />
              </ComponentPreview>
              <ComponentPreview
                description={t('uiElements.charts.description')}
                name="DonutChart"
                states={['Theme', 'Responsive', 'Keyboard', 'Accessible summary']}
              >
                <DonutChart
                  formatValue={chartFormat}
                  label={t('uiElements.charts.donutLabel')}
                  segments={chartSources}
                />
              </ComponentPreview>
              <ComponentPreview
                description={t('uiElements.charts.description')}
                name="BarChart"
                states={['Theme', 'Responsive', 'Keyboard', 'Accessible summary']}
              >
                <BarChart
                  formatValue={chartFormat}
                  items={chartPages}
                  label={t('uiElements.charts.barLabel')}
                />
              </ComponentPreview>
              <ComponentPreview
                description={t('uiElements.charts.description')}
                name="Sparkline"
                states={['Theme', 'Responsive', 'Keyboard', 'Accessible summary']}
              >
                <div className="grid min-w-0 gap-2">
                  <Sparkline
                    formatValue={chartFormat}
                    label={t('uiElements.charts.sparklineLabel')}
                    tone="brand"
                    values={sparklineValues}
                  />
                  <span className="text-sm text-ink-muted">
                    {t('uiElements.charts.sparklineLabel')}
                  </span>
                </div>
              </ComponentPreview>
            </div>
            <p className="text-sm text-ink-muted">{t('uiElements.charts.accessibilityNote')}</p>
          </Section>
        </>
      )}
    </UiElementsFamilyPage>
  );
}
