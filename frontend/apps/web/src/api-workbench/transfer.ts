import type { ApiWorkbenchPort } from '@clouddrive/surface/api-workbench';

/** Browser objects and file lifecycles stay in the Web Host. */
export const browserWorkspaceTransfer: ApiWorkbenchPort['transfer'] = {
  copyResponse: (body) => navigator.clipboard.writeText(body),
  exportWorkspace: (snapshot) =>
    Promise.resolve().then(() => {
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `api-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    }),
  selectWorkspace: () =>
    new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('cancel', () => resolve(null), { once: true });
      input.addEventListener(
        'change',
        () => {
          const file = input.files?.[0];
          if (!file) resolve(null);
          else void file.text().then(resolve, reject);
        },
        { once: true },
      );
      input.click();
    }),
};
