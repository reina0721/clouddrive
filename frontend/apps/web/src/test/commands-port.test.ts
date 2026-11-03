import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandDefinition } from '@clouddrive/plugin-framework/commands';

import { createHostCommandsPort, resetHostCommandsForTest } from '../host/commands-port';

function command(overrides: Partial<CommandDefinition> = {}): CommandDefinition {
  return {
    id: 'demo.run',
    label: 'Demo',
    description: 'Run demo',
    scope: 'global',
    isAvailable: () => ({ available: true }),
    run: vi.fn(),
    ...overrides,
  };
}

describe('createHostCommandsPort（Commands Port 实现，SET-006-006）', () => {
  beforeEach(() => {
    resetHostCommandsForTest();
  });

  it('registerCommand/listCommands/注销', () => {
    const port = createHostCommandsPort();
    const unregister = port.registerCommand(command());
    expect(port.listCommands().map((c) => c.id)).toEqual(['demo.run']);
    unregister();
    expect(port.listCommands()).toHaveLength(0);
  });

  it('subscribe 在注册/注销时通知', () => {
    const port = createHostCommandsPort();
    const seen: number[] = [];
    const unsub = port.subscribe(() => seen.push(1));
    const unregister = port.registerCommand(command());
    expect(seen).toHaveLength(1);
    unregister();
    expect(seen).toHaveLength(2);
    unsub();
  });

  it('runCommand 执行 run', () => {
    const port = createHostCommandsPort();
    const run = vi.fn();
    port.registerCommand(command({ run }));
    expect(port.runCommand('demo.run')).toEqual({ ok: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runCommand 未知 id 返回失败', () => {
    const port = createHostCommandsPort();
    const result = port.runCommand('missing');
    expect(result.ok).toBe(false);
  });

  it('runCommand 不可用命令不执行并返回原因', () => {
    const port = createHostCommandsPort();
    const run = vi.fn();
    port.registerCommand(
      command({ run, isAvailable: () => ({ available: false, reason: '仅编辑页可用' }) }),
    );
    const result = port.runCommand('demo.run');
    expect(result).toEqual({ ok: false, reason: '仅编辑页可用' });
    expect(run).not.toHaveBeenCalled();
  });
});
