export type CsvExportPort = Readonly<{
  downloadCsv: (fileName: string, content: string) => Promise<void>;
}>;

/**
 * Browser download adapter（Plugin 私有）：只落盘已序列化的 CSV 文本。
 * 序列化由 `@clouddrive/core` 的 `toCsv` 负责；此处仅补 UTF-8 BOM。
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
