# 实施设计

## Composition

Page/PageHeader 保持同源；Panel 使用 outlined。工具栏将环境、模式、变量管理和工作区传输集中；baseUrl 预览放到 URL 附近。主从布局通过 CSS 容器查询；需要改变组件编排的 56rem 阈值由 `ui-adapter/container-layout` 的 Browser Adapter 测量。复用既有 Browser Adapter 生命周期，保留 Tailwind 现有 --container-4xl/7xl 变量（值未改变）以避免未使用变量被裁剪；没有创建业务视觉 Token。公共 Element 默认值、HeroUI anatomy 和原有消费者不改变。

参数、Header、Body form 与变量复用插件内 KeyValueEditor；固定启用/删除的空间，字段按容器从单列、双列到紧凑行变化。树选择、Tab、Overlay、Focus 与 Keyboard 继续由现有 Adapter 管理。

## Draft and durable state

插件 state-foundation Store 分开保存已确认 Snapshot 和按请求 ID 的内存 drafts。Dirty 与已保存定义比较；准备保存不改变 Dirty。写入串行执行，成功后合并 Snapshot；较早保存确认不覆盖更晚输入。变量编辑独立草稿，显式提交后合并，不重置请求。加载失败不以演示数据覆盖坏数据，存储失败不更新缓存。

## Execution and runtime

executeWorkbenchRequest 统一构建、前脚本、传输、后脚本、提取器及变量传播；单次、Runner、任务消费同一执行链。HTTP 成败规则保持现状，断言另行显示。执行结果关联请求 ID，导入替换使旧执行失效。变量写入只合并执行改变的 key，避免覆盖同时发生的无关编辑。

文件与 Clipboard 生命周期位于 Web Host transfer，实现 Surface Port 的 selectWorkspace/exportWorkspace/copyResponse。Runtime 能力读取实际已加载服务。Mock 只提供配置存储，不伪装调度；真实任务结果按 ISO 时间记录，显示经 i18n formatter。数据仍为 workspace v1。

## Evidence

新增 draft/ack race、全局变量合并、删除归属、调度校验、共享执行、存储错误与容器清理测试；浏览器验证图像、几何、状态、Axe、键盘及焦点。视觉证据不自动登记为回归金图，不提高任何 diff 阈值。
