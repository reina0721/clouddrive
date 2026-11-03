# 实机审查

使用本地演示账户在运行站点逐项操作请求配置、认证选项、发送、响应视图、历史、Runner、任务、环境抽屉、搜索与删除确认；覆盖 390、768、1024、1440、1920、2560px、中英文及明暗主题。

- 原 1024px 布局两侧固定 288/384px，使编辑栏剩余 207px 并出现跨栏溢出。
- CheckboxField 的全宽 Field 根直接成为 flex 子项，挤压 Headers 三个输入到约 30px。
- Action 内直接嵌 SVG，被当作文字内容而非正式 icon slot，出现上下分裂。
- 手机直接堆叠项目树、编辑器、结果，首次编辑需滚过整个导航。
- 提取器与任务表单以 viewport 断点判断窄容器，造成标签与控件拥挤。
- Body 缺少 content 翻译，格式化错误被吞掉；全局变量入口没有指定目标标签。
- 原任务立即运行不执行集合，只写固定成功文本；原本地存储也吞掉写入错误。

对照项目 `/ui-elements/actions-selection`、`/ui-elements/forms` 的实际控件，确认优先修正 Feature composition，不更改公共控件默认视觉。图像证据在本目录 screenshots，浏览器自动化阶段图像位于 `test-results/api-workbench-ux/`。
