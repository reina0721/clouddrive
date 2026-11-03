/**
 * Core —— 表格数据的纯规则（列布局规整 + CSV 序列化）。
 *
 * 隔离的变化：列显隐/顺序的恢复规则与导出文本格式（RFC 4180）只在这里定义一次，
 * Surface Foundation 的列设置与各业务页的导出共用同一份语义，不各自复制。
 *
 * 当前调用场景：
 * - `normalizeColumnLayout`：users / audit 的列布局 store 校验恢复结果；
 * - `toCsv`：users / audit / ui-elements 的 CSV 导出（浏览器下载适配器只负责落盘）。
 *
 * 约束：不依赖 React / 浏览器 / 网络；输入输出均可序列化。
 */

/** CSV 单元格可接受的值：其余类型由调用方先显式序列化为字符串。 */
export type CsvCell = string | number | boolean | null | undefined;

/** 一行 CSV 数据：key = 列 id（不是列 label，label 只用于表头）。 */
export type CsvRow = Readonly<Record<string, CsvCell>>;

/** CSV 列定义：`id` 绑定行数据，`label` 写入表头。 */
export type CsvColumn = Readonly<{ id: string; label: string }>;

const CSV_LINE_BREAK = '\r\n';
const CSV_QUOTE = '"';

/**
 * RFC 4180 单元格转义：含分隔符、引号、换行或首尾空白的值用双引号包裹，
 * 内部双引号重复一次。值本身不被改写（不做公式前缀、不去空格），数据保真优先。
 */
function quoteCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (text === '') return '';
  const needsQuoting = /[",\r\n]/.test(text) || text.trim() !== text;
  if (!needsQuoting) return text;
  return `${CSV_QUOTE}${text.replaceAll(CSV_QUOTE, `${CSV_QUOTE}${CSV_QUOTE}`)}${CSV_QUOTE}`;
}

/**
 * 结构化数据 → CSV 文本（表头 + 数据行，CRLF 行分隔，末尾保留一个 CRLF）。
 *
 * - 列顺序即 `columns` 顺序（确定性，不受对象 key 顺序影响）；
 * - 表头使用 `columns[].label`；单元格按 `columns[].id` 取行值；
 * - 缺失值（`null` / `undefined` / 行上不存在）输出空单元格；
 * - 无列时返回空字符串（不产生只有换行的文本）。
 */
export function toCsv(rows: readonly CsvRow[], columns: readonly CsvColumn[]): string {
  if (columns.length === 0) return '';
  const lines = [columns.map((column) => quoteCsvCell(column.label)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => quoteCsvCell(row[column.id])).join(','));
  }
  return `${lines.join(CSV_LINE_BREAK)}${CSV_LINE_BREAK}`;
}

/**
 * 规整列布局：去重、丢弃未知列、必选列按 canonical 顺序置首；
 * 保存值为空（首次使用 / 全部无效）时回退 canonical 全列。
 *
 * 语义与"可见列集合"一致：保存序中缺失的 canonical 列 = 用户显式隐藏，不补回。
 */
export function normalizeColumnLayout(
  canonical: readonly string[],
  savedOrder: readonly string[] | undefined,
  mandatory: ReadonlySet<string>,
): readonly string[] {
  if (!savedOrder || savedOrder.length === 0) return [...canonical];
  const known = new Set(canonical);
  // 保存值全部指向已退役/未知列 = 记录损坏或列集重命名：回退 canonical 全列，
  // 而不是让页面只剩必选列。只要命中了任一已知列，就尊重用户的显隐与顺序。
  if (!savedOrder.some((id) => known.has(id))) return [...canonical];
  const head = canonical.filter((id) => mandatory.has(id));
  const kept: string[] = [];
  for (const id of savedOrder) {
    if (!known.has(id) || mandatory.has(id) || kept.includes(id)) continue;
    kept.push(id);
  }
  return [...head, ...kept];
}
