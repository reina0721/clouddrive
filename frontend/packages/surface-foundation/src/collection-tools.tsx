import { useState, type ReactNode } from 'react';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';

import { Toolbar } from './layout';

/**
 * 表格生产力工具（产品中立，文案全部由调用方提供）。
 *
 * - `ColumnSettingsDialog`：列显隐 + 顺序（↑/↓ 可键盘操作）+ 重置；
 * - `DensityToggle`：三档行密度（compact / standard / comfortable）；
 * - `ExportMenu`：导出动作菜单（CSV 等由调用方提供动作与文案）；
 * - `CollectionToolbar`：把上面三者组合进正式 `Toolbar`，供 Collection / 业务页复用。
 */

export type ColumnSettingsColumn = Readonly<{
  id: string;
  label: string;
  /** 必选列：不可隐藏、固定在首位。 */
  mandatory?: boolean;
}>;

/** 列设置文案（所有用户可见文本由业务层经 i18n 传入）。 */
export type ColumnSettingsText = Readonly<{
  title: string;
  description: string;
  /** 必选列说明（如"始终显示"）。 */
  mandatory: string;
  /** 重置为默认列。 */
  reset: string;
  /** 关闭对话框。 */
  close: string;
  moveUp: (columnLabel: string) => string;
  moveDown: (columnLabel: string) => string;
}>;

export type ColumnSettingsDialogProps = Readonly<{
  columns: readonly ColumnSettingsColumn[];
  /** 当前可见列顺序（缺失的列 = 隐藏）。 */
  visibleOrder: readonly string[];
  onChange: (visibleOrder: readonly string[]) => void;
  onReset: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  text: ColumnSettingsText;
}>;

export function ColumnSettingsDialog({
  columns,
  visibleOrder,
  onChange,
  onReset,
  isOpen,
  onOpenChange,
  text,
}: ColumnSettingsDialogProps) {
  const move = (id: string, delta: -1 | 1) => {
    const index = visibleOrder.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= visibleOrder.length) return;
    const next = [...visibleOrder];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    onChange(next);
  };
  return (
    <DialogSurface
      cancelLabel={text.close}
      description={text.description}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={text.title}
      triggerLabel={text.title}
    >
      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <Action size="sm" variant="quiet" onPress={onReset}>
            {text.reset}
          </Action>
        </div>
        <ul aria-label={text.title} className="flex flex-col gap-1">
          {columns.map((column) => {
            const visible = visibleOrder.includes(column.id);
            const index = visibleOrder.indexOf(column.id);
            const mandatory = Boolean(column.mandatory);
            const canMoveUp = !mandatory && visible && index > 0;
            const canMoveDown =
              !mandatory && visible && index >= 0 && index < visibleOrder.length - 1;
            return (
              <li
                className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-2"
                key={column.id}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CheckboxField
                    checked={visible || mandatory}
                    disabled={mandatory}
                    label={column.label}
                    onCheckedChange={(checked) => {
                      if (mandatory) return;
                      onChange(
                        checked
                          ? [...visibleOrder, column.id]
                          : visibleOrder.filter((id) => id !== column.id),
                      );
                    }}
                  />
                  {mandatory ? (
                    <span className="text-xs text-ink-muted">{text.mandatory}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <IconAction
                    label={text.moveUp(column.label)}
                    size="sm"
                    {...(canMoveUp ? { onPress: () => move(column.id, -1) } : { disabled: true })}
                  >
                    <span aria-hidden="true">↑</span>
                  </IconAction>
                  <IconAction
                    label={text.moveDown(column.label)}
                    size="sm"
                    {...(canMoveDown ? { onPress: () => move(column.id, 1) } : { disabled: true })}
                  >
                    <span aria-hidden="true">↓</span>
                  </IconAction>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </DialogSurface>
  );
}

const DENSITY_LEVELS = ['compact', 'standard', 'comfortable'] as const;
export type DensityLevel = (typeof DENSITY_LEVELS)[number];

function isDensityLevel(value: string): value is DensityLevel {
  return (DENSITY_LEVELS as readonly string[]).includes(value);
}

export type DensityToggleProps = Readonly<{
  /** 控件可访问名称（如"表格密度"）。 */
  label: string;
  value: DensityLevel;
  labels: Readonly<Record<DensityLevel, string>>;
  onChange: (value: DensityLevel) => void;
  disabled?: boolean;
}>;

/** 三档密度：工具条内联 Select（HeroUI 负责 Popup/Selection/Keyboard）。 */
export function DensityToggle({ label, value, labels, onChange, disabled }: DensityToggleProps) {
  return (
    <SelectField
      presentation="toolbar"
      disabled={disabled ?? false}
      label={label}
      options={DENSITY_LEVELS.map((level) => ({ value: level, label: labels[level] }))}
      value={value}
      onValueChange={(next) => {
        if (isDensityLevel(next)) onChange(next);
      }}
    />
  );
}

export type ExportMenuItem = Readonly<{
  id: string;
  label: string;
  onSelect: () => void;
}>;

export type ExportMenuProps = Readonly<{
  /** Trigger 可见文本。 */
  label: string;
  /** Menu 与 Trigger 的可访问名称。 */
  menuLabel: string;
  items: readonly ExportMenuItem[];
  icon?: ReactNode;
}>;

/** 导出菜单：复用 MenuButton（HeroUI Dropdown 负责 Overlay/Focus/Keyboard）。 */
export function ExportMenu({ label, menuLabel, items, icon }: ExportMenuProps) {
  return (
    <MenuButton
      ariaLabel={menuLabel}
      items={items.map((item) => ({ id: item.id, label: item.label }))}
      label={
        <>
          {icon ? (
            <span
              aria-hidden="true"
              className="grid size-icon-sm shrink-0 place-items-center text-current"
            >
              {icon}
            </span>
          ) : null}
          <span>{label}</span>
        </>
      }
      triggerSize="sm"
      onAction={(id) => items.find((item) => item.id === id)?.onSelect()}
    />
  );
}

export type ColumnSettingsTriggerProps = Omit<
  ColumnSettingsDialogProps,
  'isOpen' | 'onOpenChange'
> &
  Readonly<{ triggerLabel: string; icon?: ReactNode }>;

export type CollectionToolbarProps = Readonly<{
  /** Toolbar 的可访问名称（如"表格工具栏"）。 */
  label: string;
  /** 页面自定义主区内容（搜索、说明等）。 */
  children?: ReactNode;
  density?: DensityToggleProps;
  columnSettings?: ColumnSettingsTriggerProps;
  exportMenu?: ExportMenuProps;
}>;

/**
 * CollectionToolbar —— 集合页统一工具条：组合 Toolbar + 列设置 + 密度 + 导出。
 * 对话框由工具条自己管理开关；业务只用声明数据与动作。
 */
export function CollectionToolbar({
  label,
  children,
  density,
  columnSettings,
  exportMenu,
}: CollectionToolbarProps) {
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  return (
    <>
      <Toolbar
        label={label}
        primary={children ?? null}
        secondary={
          <>
            {density ? <DensityToggle {...density} /> : null}
            {columnSettings ? (
              <Action
                size="sm"
                variant="secondary"
                {...(columnSettings.icon ? { leadingIcon: columnSettings.icon } : {})}
                onPress={() => setColumnSettingsOpen(true)}
              >
                {columnSettings.triggerLabel}
              </Action>
            ) : null}
            {exportMenu ? <ExportMenu {...exportMenu} /> : null}
          </>
        }
      />
      {columnSettings ? (
        <ColumnSettingsDialog
          columns={columnSettings.columns}
          isOpen={columnSettingsOpen}
          onOpenChange={setColumnSettingsOpen}
          onChange={columnSettings.onChange}
          onReset={columnSettings.onReset}
          text={columnSettings.text}
          visibleOrder={columnSettings.visibleOrder}
        />
      ) : null}
    </>
  );
}
