import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialWorkspaceSnapshot,
  createMockApiWorkbenchService,
} from '../api-workbench/mock-service';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem('clouddrive.api-workbench.workspace.v1');
});

describe('Workbench durable storage', () => {
  it('propagates quota failures and retains the last successfully saved snapshot', async () => {
    const port = createMockApiWorkbenchService();
    const initial = createInitialWorkspaceSnapshot();
    await port.workspace.save(initial);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    await expect(port.workspace.save({ ...initial, projects: [] })).rejects.toThrow(
      'Quota exceeded',
    );
    expect((await port.workspace.load()).projects).toEqual(initial.projects);
  });
  it('does not overwrite invalid persisted user data with demo data', async () => {
    localStorage.setItem('clouddrive.api-workbench.workspace.v1', 'invalid JSON');
    await expect(createMockApiWorkbenchService().workspace.load()).rejects.toThrow();
    expect(localStorage.getItem('clouddrive.api-workbench.workspace.v1')).toBe('invalid JSON');
  });
});
