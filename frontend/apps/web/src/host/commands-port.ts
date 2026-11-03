/**
 * Host —— Commands Port 实现（composition root 装配）。
 *
 * 统一注册表：命令的按钮入口、命令菜单、快捷键与常用操作引用同一执行函数与可用性
 * （`@clouddrive/plugin-framework/commands` 契约）。页面/组件卸载时注销（不泄漏）；
 * runCommand 校验可用性（不可用不执行并返回原因）。
 */
import type { CommandsPort, CommandDefinition } from '@clouddrive/plugin-framework/commands';

const registry = new Map<string, CommandDefinition>();
const listeners = new Set<() => void>();
/** 缓存的命令列表（useSyncExternalStore getSnapshot 须返回稳定引用）。 */
let cachedList: readonly CommandDefinition[] = [];

function refreshCache(): void {
  cachedList = [...registry.values()];
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** 创建 Commands Port（Host composition root 单次调用）。 */
export function createHostCommandsPort(): CommandsPort {
  return {
    registerCommand: (definition) => {
      registry.set(definition.id, definition);
      refreshCache();
      emit();
      return () => {
        registry.delete(definition.id);
        refreshCache();
        emit();
      };
    },
    listCommands: () => cachedList,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    runCommand: (id) => {
      const command = registry.get(id);
      if (!command) return { ok: false, reason: `unknown command: ${id}` };
      const availability = command.isAvailable();
      if (!availability.available) return { ok: false, reason: availability.reason };
      void command.run();
      return { ok: true };
    },
  };
}

/** 测试辅助：清空注册表与订阅者。 */
export function resetHostCommandsForTest(): void {
  registry.clear();
  cachedList = [];
  listeners.clear();
}
