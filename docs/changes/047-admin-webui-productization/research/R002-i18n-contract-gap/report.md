# R002 i18n 强制契约缺口复核

## 1. 研究问题与证据

本轮计划调整的关键问题不是重新选择 i18n 技术，而是确认当前实现是否已经具备可执行的模块规范。证据来自当前工作树源码与既有 R001 研究；没有在本轮修改源码或启动外部服务。

## 2. 已确认事实

- Auth 与 Ops Binding 已声明 `Language + Namespace + SourcePath` locale，Composition 生成器已经输出 locale registry，并校验资源文件存在、JSON 是字符串 map 且非空。这证明模块资源所有权和构建期聚合方向可复用。
- `webui/src/i18n.ts` 当前由宿主初始化单一 i18next 实例，但 host 文案仍以内联对象存在，尚未形成“所有用户可见文案都来自可审计资源”的统一门禁。
- `internal/module/auth/binding/webui/web/SetupPage.tsx` 直接 import `useTranslation`，没有使用项目自己的窄翻译 hook；页面还直接包含标题说明、字段标签、提示、按钮等用户文案。
- 同一文件中的 `setupErrorMessages` 将 `cors_origin_denied` 等后端错误码直接映射为中文展示文本，`setupErrorMessage` 也在错误未知时直接返回中文。这使错误码与语言资源耦合，无法由模块 locale 或语言选择统一控制。
- 仅凭运行期 i18next 单实例，无法阻止后续模块复制上述模式；必须把 Binding 约束、公开翻译契约、message ID 规则和静态架构扫描一起纳入验收。

## 3. 研究结论与计划影响

### 事实

当前已有 locale registry 和单实例基础设施，但尚未实现强制 i18n 规范；用户指出的 `setupErrorMessages` 是可复核的直接违约点。

### 推断

最小且不破坏既有模块边界的收敛路径是：模块继续拥有 locale；Composition 继续聚合；宿主继续持有唯一实例；新增项目公开的 `useWebUITranslation(namespace)`；错误码只映射 message ID；Contract/codegen 验证 locale 完整性；静态测试拒绝模块生产 Web 源码中的用户可见硬编码和直接 singleton 依赖。这个调整不需要新增第二套模块注册或权限体系，但会改变原计划的前端公开契约、模块页面迁移和测试门禁。

### 局限

当前还没有确定最终 hook 的完整 TypeScript 类型、host locale 文件路径、硬编码扫描器的精确语法白名单，也没有把 Auth/Ops 全部文案迁移完成。这些属于实施细节，必须在调整后的计划获确认后实现和验证，不能在本轮把目标设计写成已完成事实。
