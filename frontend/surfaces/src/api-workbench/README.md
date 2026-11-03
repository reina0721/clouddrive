# API Workbench Contract

本模块是当前 Product Surface 的 API 调试能力模型与 Port，对 Host 开放 `@clouddrive/surface/api-workbench`。插件组件和 Store 仍为私有实现，不进入 exports。文档入口：[前端文档](../../../docs/README.md)。

## Runtime responsibilities

- `workspace`：读取和保存 workspace v1，写失败必须拒绝 Promise，不能用只更新内存的成功响应替代耐久保存。
- `transport`：执行已解析请求并返回 HTTP 响应或结构化传输失败。
- `tasks`：任务配置 CRUD；`capabilities.persistentTasks` 只在真实调度服务可用时为 true。
- `transfer`：`selectWorkspace(): Promise<string | null>` 返回所选文件文本或取消；`exportWorkspace(snapshot): Promise<void>` 和 `copyResponse(body): Promise<void>` 表达用户动作，失败拒绝 Promise。DOM、文件、Object URL 与 Clipboard 只在 Host 实现。
- `capabilities` 反映所选实际服务；Runtime 完成 workspace.load 后，UI 可以据此呈现正确模式与禁用原因。

## Ownership and compatibility

工作台插件拥有已保存 Snapshot、按请求 ID 的内存 drafts、面板选择和执行反馈；持久化由 Host repository 执行。新接口保留 v1 结构与存储 key，导入由现有 Schema 校验并经用户确认替换。Task lastRun.time 新记录为 ISO 字符串，旧的已格式化时间仍可展示。切换 Locale 后 UI 文案和数值日期格式由 i18n 提供，用户命名和历史消息作为数据保留。

当前实现与验证历史见 [113](../../../docs/changes/113-api-workbench-ui-ux/README.md)，当前视觉规范见 [UI Element System](../../../docs/ui-element-system.md)。

## History restoration

新历史记录在 v1 中增加可选的 request/environmentId，保留发送前配置和环境引用（不复制环境变量值）。识别出的认证字段和凭据请求头只保留变量引用，不追加明文密钥副本。旧记录没有配置快照时，界面明确仅恢复方法与 URL。

恢复创建独立内存草稿，可从工作区菜单重新选择；保存时追加新接口，保留原接口及其未保存草稿。原集合已删除时使用当前第一个可用集合；没有集合则提示先创建。原环境已删除时清除环境选择并提示。变量值仍取当前环境/全局变量，因此历史恢复不是旧运行结果的完全重放。用户应检查认证、环境与脚本后发送。

布局随工作区可用宽度调整：宽屏提供可收起项目树、请求、响应三栏，普通桌面并排请求/响应并使用项目抽屉，窄屏使用工作区标签。外观继续消费 Host 全局偏好和 Design System profiles，没有工作台独立外观系统。第二轮验证见 [114](../../../docs/changes/114-api-workbench-refinement/README.md)。
