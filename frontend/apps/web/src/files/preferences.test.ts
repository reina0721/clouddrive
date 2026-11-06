import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultFilePreferences,
  changeFileView,
  resolveFileView,
  filePreferencesSchema,
  filePreferenceSnapshotSchema,
  FilesError,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';
import { createFilePreferences } from './preferences';

describe('真实文件偏好边界', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  const setup = () => {
    const call = vi.fn<ReturnType<typeof createJsonClient>>();
    let current = true;
    const port = createFilePreferences(call, 'owner', () => {
      if (!current) throw new FilesError('canceled');
    });
    return {
      call,
      port,
      expire: () => {
        current = false;
      },
    };
  };
  it('本机读取、写入及关闭同步不请求网络', async () => {
    const { call, port } = setup();
    const snapshot = await port.loadPreferences();
    snapshot.configuration.folderClick = 'select';
    await port.savePreferences(snapshot);
    expect((await port.loadPreferences()).configuration.folderClick).toBe('select');
    expect(call).not.toHaveBeenCalled();
  });
  it('旧偏好成功落盘后才删除旧键，保存失败保留旧值', async () => {
    const { port } = setup();
    const old = { ...defaultFilePreferences().defaults, view: 'list' };
    localStorage.setItem('clouddrive.files.view.v1.owner', JSON.stringify(old));
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await expect(port.loadPreferences()).rejects.toThrow(FilesError);
    expect(localStorage.getItem('clouddrive.files.view.v1.owner')).not.toBeNull();
    set.mockRestore();
    expect((await port.loadPreferences()).configuration.defaults.view).toBe('list');
    expect(localStorage.getItem('clouddrive.files.view.v1.owner')).toBeNull();
  });
  it('开启同步先读revision，再发布当前设置；关闭后不写远端', async () => {
    const { call, port } = setup();
    const snapshot = await port.loadPreferences();
    const remote = { ...defaultFilePreferences(), revision: 7 };
    call
      .mockResolvedValueOnce(remote)
      .mockResolvedValueOnce({ ...snapshot.configuration, revision: 8 });
    const saved = await port.savePreferences({ ...snapshot, sync: true });
    expect(call.mock.calls[1]?.[1]?.body).toMatchObject({ revision: 7 });
    expect(saved.configuration.revision).toBe(8);
    await port.savePreferences({ ...saved, sync: false });
    expect(call).toHaveBeenCalledTimes(2);
  });
  it('显式采用服务器设置不发布本机草稿', async () => {
    const { call, port } = setup();
    call.mockResolvedValue({ ...defaultFilePreferences(), revision: 3, folderClick: 'select' });
    const loaded = await port.loadPreferences(undefined, 'server');
    expect(loaded).toMatchObject({
      sync: true,
      configuration: { revision: 3, folderClick: 'select' },
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
  it('同步失败和冲突不上报成功，不隐藏回退、不自动覆盖', async () => {
    const { call, port } = setup();
    const saved = { sync: true, configuration: { ...defaultFilePreferences(), revision: 4 } };
    localStorage.setItem('clouddrive.files.view.v2.owner', JSON.stringify(saved));
    const conflict = new FilesError('conflict');
    call.mockRejectedValue(conflict);
    await expect(port.loadPreferences()).rejects.toBe(conflict);
    await expect(port.savePreferences(saved)).rejects.toBe(conflict);
    expect(call).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem('clouddrive.files.view.v2.owner')!)).toEqual(saved);
  });
  it('账号在服务器响应前失效时不落盘', async () => {
    const { call, port, expire } = setup();
    call.mockImplementation(() => {
      expire();
      return Promise.resolve(defaultFilePreferences());
    });
    await expect(port.loadPreferences(undefined, 'server')).rejects.toThrow(FilesError);
    expect(
      filePreferenceSnapshotSchema.parse(
        JSON.parse(localStorage.getItem('clouddrive.files.view.v2.owner')!),
      ).sync,
    ).toBe(false);
  });
  it('目录、根和全局回退分离，关闭记忆不会删除覆盖', () => {
    let document = { ...defaultFilePreferences(), rememberFolders: true };
    document = changeFileView(document, { ...document.defaults, view: 'list' }, '');
    expect(resolveFileView(document, '').view).toBe('list');
    expect(resolveFileView(document, 'd8f01c7d-7726-4f4c-978b-340f0b41a913').view).toBe('grid');
    expect(resolveFileView({ ...document, rememberFolders: false }, '').view).toBe('grid');
    expect(document.folders).toHaveLength(1);
  });
  it('拒绝重复目录、非法ID、超限集合和重复列', () => {
    const document = defaultFilePreferences();
    const folder = { parentId: '', view: document.defaults };
    expect(
      filePreferencesSchema.safeParse({ ...document, folders: [folder, folder] }).success,
    ).toBe(false);
    expect(
      filePreferencesSchema.safeParse({
        ...document,
        folders: [{ ...folder, parentId: '../other' }],
      }).success,
    ).toBe(false);
    expect(
      filePreferencesSchema.safeParse({ ...document, folders: Array(201).fill(folder) }).success,
    ).toBe(false);
    expect(
      filePreferencesSchema.safeParse({
        ...document,
        defaults: { ...document.defaults, columns: ['size', 'size'] },
      }).success,
    ).toBe(false);
  });
});
