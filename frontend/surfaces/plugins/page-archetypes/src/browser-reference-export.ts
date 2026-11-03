export type ReferenceExportPort = Readonly<{
  exportTextFile: (fileName: string, content: string) => Promise<void>;
}>;

export const browserReferenceExport: ReferenceExportPort = {
  exportTextFile(fileName, content) {
    const downloadUrl = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.download = fileName;
    anchor.href = downloadUrl;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    return Promise.resolve();
  },
};
