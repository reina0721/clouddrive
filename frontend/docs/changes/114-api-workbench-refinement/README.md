# API 调试工作台第二轮优化

保留现有项目/集合/接口结构和请求执行流程，修复导航边界，调整工作区布局与历史恢复。当前契约见 [API Workbench](../../../surfaces/src/api-workbench/README.md)。

- [研究与根因](research/findings.md)
- [范围](requirements/scope.md)
- [设计决策](design/decisions.md)
- [实施、验证和限制](tasks.md)

## 修改范围

- Host AppShell：折叠导航组居中、保留边框空间，品牌区保持高度。
- Workbench / WorkbenchToolbar：宽屏三栏及项目树收起，普通桌面请求与响应均分，窄屏标签与项目抽屉。
- RequestTabs / ResponseView：编辑器、项目列表及长响应使用局部滚动；移除重复的配置标签上方间距。
- ProjectTree：外部恢复请求后重新派生选中状态，避免点击原接口无响应。
- 私有 Store、History Model / Schema：原始配置与环境引用可选快照；独立历史草稿，保存追加接口，保留旧 workspace v1 与存储 key。
- Plugin i18n：查询参数、请求头、认证、请求体、连接设置、格式化、原始内容、集合运行统一中文；保留 HTTP、JSON、TLS 等专业词。清理已确认无调用方的旧文案，保持原性能预算。

## 关键视觉证据

截图来自实际运行的 Chromium 页面，未更新项目视觉 golden。

| 场景                                  | 截图                                                                 |
| ------------------------------------- | -------------------------------------------------------------------- |
| 1440×900 布局调整前（术语已改）       | [布局前](research/before-1440-false.png)                             |
| 1440×900 请求/响应并排                | [布局后](evidence/after-1440-light.png)                              |
| 1920×1080 三栏                        | [宽屏](evidence/profile-1920-light-expanded.png)                     |
| 深色、蓝色强调、紧凑、折叠导航        | [组合](evidence/profile-1440-dark-collapsed.png)                     |
| 1280×800 大字号与宽松密度             | [大字号](evidence/profile-1280-light-large.png)                      |
| 1024×768 折叠导航与高对比             | [高对比](evidence/profile-1024-dark-high-contrast.png)               |
| 390px 英文、深色、大字号              | [窄屏](evidence/profile-390-dark-english-large.png)                  |
| 长 JSON、脚本与断言结果（页面已滚动） | [响应](evidence/long-json.png)                                       |
| 全局设置实际修改后回到工作台          | [设置联动](evidence/global-settings-live.png)                        |
| 项目树收起/展开                       | [项目树](evidence/project-tree-toggle.png)                           |
| 集合运行与任务结果                    | [集合](evidence/runner-result.png)、[任务](evidence/task-result.png) |
| 历史恢复另存                          | [历史草稿](evidence/history-draft.png)                               |
| 传输错误                              | [错误态](evidence/transport-error.png)                               |
