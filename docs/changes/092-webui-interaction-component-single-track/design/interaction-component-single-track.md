# 交互组件单轨设计

## 接口与边界

- `Field` 只承载字符串文本字段；SearchInput 保留现有 props 和防抖行为，内部改用 SearchField。
- 新增 NumberField、DateField、DateTimeField、FilePicker、RadioGroup、SegmentedControl、Tabs 与 Disclosure 窄契约。
- FilterBarField 改为 `text | date | datetime | select | switch` 判别联合，移除 `input + inputType`。
- TreeView、DataTable 等业务复合契约保持不变，内部迁移 RAC Tree/Checkbox。
- 页面与 Shell只导入 `@webui/sdk/ui`；HeroUI/RAC 导入集中在 UI 实现层。

## 迁移映射

- SearchInput/FilterBar/日期字段/上传：SearchField、TextField、DatePicker/DateField、FileTrigger。
- 普通/图标/选择动作：Button、IconButton、ToggleButton/RadioGroup。
- ThemeDrawer/Language：Tabs + RadioGroup/ToggleButtonGroup。
- RouteSearch/OpenAPI Palette：ComboBox/ListBox；Tree/响应头：Tree/Disclosure。
- DataTable：RAC Checkbox，header 使用 indeterminate。

## 门禁

architecture lint 扫描宿主和模块生产 TSX：禁止直接交互标签、手写复合交互 role、模块直连 `@heroui/react` 或 `react-aria-components`。规则使用正反 fixture 验证；成熟组件内部生成 DOM 不属于扫描范围。

## 数据与失败语义

日期和日期时间在 UI 边界与现有 `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` 字符串双向转换，不改变 HTTP 时区语义。解析失败呈现字段错误，不静默回退。文件选择继续传递浏览器 File 对象，不读取或记录内容。组件错误完整上抛给现有页面状态。

## 验证

单测覆盖受控值、键盘与焦点；Playwright 覆盖关键页面和全 viewport/theme/density；源码扫描证明旧实现零残留；运行 WebUI、Go 与 diff 门禁。
