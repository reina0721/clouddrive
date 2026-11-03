# 047 Admin WebUI 产品化与模块化装配闭环

状态：已停止继续实施。已提交代码仍是当前实现事实，但未完成目标与后续检查点由 [048 全栈业务模块化 WebUI 重构](../048-full-stack-webui-modules/README.md) 的新方案取代；不得继续沿 047 扩张宿主核心。

> 2026-08-21 方向调整：用户指出“业务模块页面仍需修改 WebUI 核心”违反模块化目标，并要求建立前后端分离但保持完整业务模块的整体方案。047 已完成提交作为历史证据保留，不回写为已完成；未完成视觉验收、宿主闭环和 Auth/Ops 后续产品化全部停止，等待 048 计划确认后的单轨迁移。

## 范围

本变更在 042–046 已建立的 WebUI Contract、Auth Session、Ops 页面、本地启动与安全修复之上继续演进，不创建第二套模块、权限、路由注册或后台架构。建设顺序以 Admin WebUI 宿主本体为先：先闭合 Shell、导航、路由承载、i18n、主题、状态和公共交互，再让现有真实模块迁入稳定契约；不以堆叠示例页面制造完成感。

本轮准备闭合四类缺口：

- 先让生成的页面与语言 registry 真正驱动宿主路由、菜单和页面承载，删除宿主对具体模块的集中硬编码；
- 建立统一、可复用的后台 Shell、设计 Token、页面容器、导航、状态、反馈、表格与表单模式；
- 用 `Available / Degraded / Unavailable / Not Implemented` 如实表达能力，不用模拟成功填补后端缺口；
- 把 SoybeanAdmin 的实际视觉观察纳入每个公共模块、重要交互和页面阶段的动态验收流程，但不复制其源码、品牌、Demo 或 Vue 架构。

非文档实施分成两个有依赖关系的里程碑：首次在完成宿主本体的同时，只把已有 Auth/Ops 页面迁回模块 owner 并做保持真实流程可运行的最小适配；宿主门禁通过后，才单独产品化这些真实页面。Todo 继续不提供 WebUI Binding；当前变更不新增示例模块、组件演示路由、用户/角色/菜单 CRUD 或尚无真实管理用例的业务页面。

## 阅读顺序

1. [研究档案](research/README.md)
2. [需求规格](requirements.md)
3. [设计方案](design.md)
4. [任务清单](tasks.md)

## 当前结论

- 现有 `internal/webui -> internal/composition -> manifest/codegen -> webui/` 方向正确，可以增量闭合，无需引入动态插件、Module Federation 或另一套权限模型。
- 当前生成 registry 只被用于 revision 校验，宿主仍直接 import Auth/Ops 页面并手写 `<Route>`；模块目录中的页面文件反向 re-export 宿主页，尚未满足“模块拥有页面、宿主只承载”。
- 当前模块 locale 已声明并已接入生成/装入路径，但还没有把 i18n 提升为可强制执行的公共规范；模块页面仍存在用户可见的硬编码文案，错误码映射仍可能直接返回中文文本。
- 当前 `available/preview` 把交付成熟度与运行可用性混在一起，无法准确表达目标四态。
- 当前 CSS 和页面是基础原型，已安装的 HeroUI 尚未实际使用；E2E、桌面/移动视觉基线和逐阶段参考对照仍缺失。
- 本轮已实际观察 SoybeanAdmin 工作台 Shell、用户列表与筛选、新增 Drawer、403 状态页和主题 Drawer；这些只形成当前阶段证据，不能替代实施时对每个新目标的再次观察。
- SoybeanAdmin 官方把精简核心框架与 example 示例内容分轨；047 只借鉴成熟后台本体，不复制 example 菜单和演示能力。

用户已明确要求把 i18n 调整为业务模块必须遵守的 WebUI 规范契约，并确认修订后的 047 方案。当前已实施 Binding locale 必需校验、宿主公开翻译 hook、host/module locale 资源、error code -> message ID 和静态架构扫描。首次确认只覆盖布局与骨架，检查点 D 仍需后续独立确认。
