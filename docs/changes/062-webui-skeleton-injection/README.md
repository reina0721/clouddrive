# 062 WebUI 骨架与注入点设计体系

状态：研究门禁已通过，计划已确认（2026-08-24 用户确认，含决策 1–6 推荐项），实施完成（SKEL-062-001..009 全部通过门禁，证据见 [tasks.md](tasks.md)）。用户确认「当前 WebUI 骨架设计单薄，有必要升级进阶」。

## 背景

当前 WebUI 已有「模块 Binding → 生成 registry → Manifest 投影 → 宿主懒加载」的静态插拔链路，但注入面只有 Route/Navigation/Locale/Mock 四类；骨架分区组件存在却没有类型化注入点；交互元素缺乏统一状态链与动作级权限契约；图标目录硬编码。本变更将其升级为以「骨架 + 注入点」为核心的 Web UI 设计体系，并同步进阶骨架本身。

## 范围

- 五类分区注入点（顶栏操作区、侧边栏辅助区、页头区、标签页栏操作区、底部状态区）+ 既有内容区 Route；
- 动作级权限投影（Manifest zones + SDK `useActionAccess`，服务端判定、前端只控呈现）；
- 统一交互状态链原语（`ActionTrigger`/`BulkActionBar`/`FormSubmitActions`）与 ARIA 对齐；
- 受控图标目录、多级导航缩进 token 化与激活链规范；
- 骨架进阶：页头规范容器、批量操作条、内容容器、页签操作区、底部状态区与 token 扩展；
- 保留静态插拔语义：生成 lazy registry + Manifest 门禁，不引入运行时插件/远程模块/第二套路由授权。

## 明确不做

- 不引入微前端运行时（single-spa/qiankun/Module Federation）、无头组件库、Tailwind/动画库（059/048/056 边界保持）；
- 不建立万能 Contribution / Service Locator / init 注册 / 目录扫描；
- 不改变服务端授权模型（IAM Casbin Core RBAC 仍为授权 authority；前端权限只控呈现）；
- 不新增业务页面、不改既有 Binding 字段语义、不动数据库/config/HTTP 契约/CLI/部署。

## 阅读顺序

1. [研究档案](research/README.md)：R062-001（现状与差距）、R062-002（承载架构与候选对比，结论为保留并演进自研静态插拔机制）
2. [需求规格](requirements.md)：REQ-062-001..010
3. [设计方案](design.md)：zone 模型、权限钩子、交互状态链、导航进阶、骨架进阶、文件影响、待确认决策
4. [任务清单](tasks.md)：SKEL-062-001..009（依赖顺序、完成条件、验证矩阵）

## 待确认决策

确认本计划时需同时确认 design.md 第 10 节的决策 1–6（推荐项）：typed zone facets 模型、Manifest 投影动作权限、自研交互原语 + APG、受控图标目录、限定骨架进阶范围、由既有模块实施真实用例。