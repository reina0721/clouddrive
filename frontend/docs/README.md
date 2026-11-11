# 前端工程手册

当前工程从 [frontend/README](../README.md) 进入。本手册说明当前职责和使用方式，历史变化由 Git 保存。

## 架构地图

Universal Frontend Foundation（design-system、ui-adapter、form-foundation、i18n、core、schemas、types）提供稳定语义；surface-foundation 和 plugin-framework 承载可复用产品能力，surfaces 是产品实现，apps/web 是 Next.js 与浏览器 Host。依赖分类以 tooling/foundation-policy.json 为准。

## 主题 authority

- [Frontend Foundation](frontend-foundation.md)、[Surface Foundation](surface-foundation.md)
- [Plugin Framework](plugin-framework.md)、[Foundation 扩展治理](foundation-extension-governance.md)
- [UI Element System](ui-element-system.md)、[视觉校准](ui-visual-calibration.md)
- [Motion Foundation](motion-foundation.md)、[配置](config-foundation.md)
- [认证](../apps/web/src/auth/README.md)、[API 工作台](../surfaces/src/api-workbench/README.md)
- [质量与证据](quality-evidence.md)、[工程职责与规范](../../docs/development/agent-workflow.md)

## 运行与验证

在根目录使用 `node scripts/verify-changed.mjs --dry-run` 查看计划，日常验证由[统一策略](../../docs/development/validation.md)选择影响范围。前端目录可执行 `pnpm dev`、`pnpm docs:check`；`pnpm check` 是完整回归入口。新增插件/路由按既有 codegen 生成并检查 freshness。

## 文档维护规则

一个主题只有一个当前 authority，局部 README 说明职责和契约并回链本手册。文档随真实行为演进；普通功能不要求创建变更目录或整套研究/需求/设计/任务档案。重要架构决定保留 [ADR](../../docs/architecture/adr/README.md)，原始证据与旧日志通过 Git 查阅。
