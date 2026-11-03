export type CsvExportPort = Readonly<{
  downloadCsv: (fileName: string, content: string) => Promise<void>;
}>;

/**
 * Browser download adapter（Plugin 私有）：只负责把已序列化的 CSV 文本落盘。
 * 序列化规则（列顺序 / RFC 4180 引号）由 `@clouddrive/core` 的 `toCsv` 提供，
 * 本适配器不改写内容，只补 UTF-8 BOM 以便 Excel 正确识别中文。
 */
export const browserCsvExport: CsvExportPort = {
  downloadCsv(fileName, content) {
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = fileName;
    anchor.href = downloadUrl;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    return Promise.resolve();
  },
};
