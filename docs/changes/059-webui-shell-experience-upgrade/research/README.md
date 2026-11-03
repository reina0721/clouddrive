# 059 研究档案

本目录回答两个问题：当前 WebUI 后台骨架的真实完成度和体验缺口是什么；TailAdmin 的哪些设计适合当前 React/module-owned 架构，哪些内容不应复制或引入。

## 检索与复核

- 已检索 `docs/**/research/**/metadata.yaml`，复用了 047 对宿主产品化和 048 对 module-owned WebUI/SDK 边界的结论。
- 当前事实重新核对了 `webui/src/App.tsx`、`components/AppShell.tsx`、`components/RouteSearch.tsx`、`components/ThemeDrawer.tsx`、`theme.ts`、`ui/index.tsx`、`styles.css`、前端测试、E2E 和已有视觉产物。
- 外部事实使用 TailAdmin 官方 GitHub 仓库、对应 React 官方仓库与在线 Demo 的 DOM、截图和 computed style；没有把营销说明当作当前项目事实。

## 记录

- [R001 当前 WebUI 骨架与交互缺口](R001-current-webui-experience-gap/report.md)
- [R002 TailAdmin 参考适配性与技术边界](R002-tailadmin-reference-fit/report.md)
- [R003 模块、SDK 与 WebUI Host 可插拔边界](R003-module-sdk-host-pluggable-boundary/report.md)
