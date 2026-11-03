# 094 研究索引

本目录只保存形成 094 完整计划所需的证据快照，不替代 `frontend/docs/ui-element-system.md`、`frontend/docs/ui-visual-calibration.md` 或当前代码。

| ID       | 报告                                                                                                 | 结论                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| R094-001 | [TailAdmin UI Elements 逐页复核](R094-001-tailadmin-ui-elements-refresh/report.md)                   | 22 个当前菜单页面已实际访问；吸收场景矩阵、Anatomy、层级和状态表达，不复制 Demo API 与实现。                                                       |
| R094-002 | [当前新前端 UI 体系与缺口审计](R094-002-current-frontend-ui-audit/report.md)                         | 现有单轨基础应保留；缺口集中在公共契约覆盖、无行为控件、页面私有基础元素、真实集合 Pattern 和视觉测试稳定性。                                      |
| R094-003 | [HeroUI v3 与 Tailwind CSS v4 官方互补模型](R094-003-heroui-tailwind-official-composition/report.md) | HeroUI 官方本身组合 Tailwind v4 与 React Aria；项目用前者承载成熟交互/可访问 primitive，用 Tailwind theme/variant 承载 Semantic Token 和产品视觉。 |

研究门禁判定：关键事实已有代码、Git、运行命令、在线页面、已安装依赖和官方文档证据；剩余未知不会妨碍形成全范围实施计划。实施入口只按三份 metadata 的 `refresh_triggers` 做增量漂移检查。
