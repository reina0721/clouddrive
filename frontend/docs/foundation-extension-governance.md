# Foundation 扩展治理

任何业务请求先按以下顺序判断：

```text
已有 Element → 已有 Variant → Composition → 已有 Pattern → Feature Component
```

只有以上方式无法合理表达，且缺失能力对多个业务有稳定通用价值时，才进入 Foundation。新增公共能力必须同时完成：

1. 判断 Token、Variant、Element、Interaction Pattern 或 Page Archetype 的语义层级。
2. 设计输入、输出、状态矩阵、组合边界、DOM/键盘语义与失败表现。
3. 对齐 Design Token、Motion、Responsive、Density、Dark/Contrast 与 Content。
4. 检查 HeroUI/RHF/i18n/Host vendor owner，不泄漏第三方类型。
5. 在对应 `/ui-elements`、`/motion` 或 `/page-patterns` 建立 authority 场景；完整页面进入 `/page-archetypes`。
6. 完成 Accessibility、Axe、键盘、焦点、Live Region 与 Reduced Motion。
7. 完成 Type/DOM/Vitest/Playwright/Visual/Performance 和 Architecture fixtures。
8. 在 `tooling/foundation-contracts.json` 登记 owner、maturity、exports、authority 与 evidence。

成熟度只有 `experimental / stable / replacing / retiring`。替换完成后删除旧导出、旧实现、旧测试和失效文档；不保留 deprecated alias。Git 保存历史。
