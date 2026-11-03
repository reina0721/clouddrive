# 任务状态

## 实施

- [x] `preferences-model`：`PAGE_TRANSITIONS`、`appearance.pageTransition`、默认值与校验
- [x] 单测：默认值 / 旧记录补全 / 非法值拒绝
- [x] Host：`html[data-page-transition]`
- [x] Surface：`surface-screen-*` keyframes + 非默认整页 recipe + 标题让位 + none/off 降级
- [x] 设置页：外观·动效组 `SelectField`（含每项说明）
- [x] 设置搜索索引：`appearance.pageTransition` + 中英文文案
- [x] 快捷偏好抽屉：同字段入口（Host i18n）
- [x] e2e：`page-transition.spec.ts`（10 项）
- [x] 既有 `transition.spec` watcher 纳入 `surface-screen-*`
- [x] `settings-product-review` 外观字段数 9 → 10
- [x] 视觉基线复核：`settings-desktop` 更新（新增一行，1440×2265 → 1440×2381）

## 文档

- [x] 117 账本（README / research / requirements / design / tasks）
- [x] Motion Foundation：Router/Suspense 行与选项映射
- [x] 变更记录索引
- [x] 质量证据数字（完整门禁后回填）

## 验证

- [x] 局部：surfaces 176、web 192、目标 e2e 10、受影响回归 53、visual 9
- [x] 完整 `pnpm check`（退出码 0，423 项浏览器）并归档日志
- [x] 提交并 push
