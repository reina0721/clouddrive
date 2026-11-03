# VP-02 Shell、页签与命令增量

原 Task 115。状态：未实施；D-02 待决策。

## 已具备与检查入口

[app-shell](../../../../apps/web/src/shell/app-shell.tsx) 已集成命令搜索和 Ctrl/Cmd+K，包含导航/注册动作；[page-tabs](../../../../apps/web/src/shell/page-tabs.tsx) 已有关闭、关闭其他、全部标签入口及焦点恢复；[recorder](../../../../apps/web/src/shell/use-page-tabs-recorder.ts) 与 [store](../../../../apps/web/src/state/use-page-tabs-store.ts) 已处理恢复。不能重新开发这些基础能力。

## 候选增量与执行步骤

1. 先确定真正需要的布局与页签动作，而非承诺五布局和四视觉皮肤。区分整条 pageTabsPinned 与单个 affix，保留 pageTabsEnabled 默认值、访问顺序和恢复语义。
2. 命令只补所选缺口（例如 route path 搜索或已定义的具体动作），复用 CommandsPort；核对输入框/IME 避让与禁用快捷键，不增加第二份快捷键监听和命令注册表。
3. 布局呈现归 Surface Foundation，Product Group 来自 Host 已解析内容；Foundation 不导入 surfaces/plugins/navigation-groups。导航、离开确认、滚动与全屏平台生命周期归 Host/正式 Port。
4. 若选择 Pin、关闭左右、刷新等，先定义固定项、关闭当前、未保存页面、刷新数据与重挂路由之间的行为；右键菜单及可触达菜单按钮均经 Adapter/HeroUI，触屏与键盘功能对等。

## 排除与风险

不重写 Next Router，不缓存另一套页面树，不把 layout/motion/style 塞入 Plugin Contract。拖拽重排与现行 Surface authority 冲突，本计划不纳入；若后续明确改变该决策，须独立记录依据并同步 authority。

## 后续验收（尚未执行）

- [ ] 所选布局在移动 Drawer、窄屏、超宽屏和长导航下无溢出，保持当前 active ancestor/accordion 策略。
- [ ] 页签操作保持离开确认、关闭策略、固定项保护、恢复和键盘焦点；旧持久化记录兼容。
- [ ] 命令不重复注册，Ctrl/Cmd+K、纯键盘、IME 和快捷键关闭行为保持；只验证新增动作的真实效果。
- [ ] commands/page-tabs/navigation/leave-confirm 及 UI Elements Overlay 对应流程完成回归。

本任务完成还须执行 [公共能力与质量门禁](../design/README.md) 和 [执行协议](../design/execution-protocol.md)；上列清单不替代完整 pnpm check。
