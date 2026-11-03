# 048 研究索引

本目录回答四个问题：当前业务模块持有 WebUI 的哪些边界是正确的，为什么页面演进仍会反向修改宿主核心，怎样用通用 SDK contract/adapter 让普通新模块在 core 零修改前提下接入，以及怎样阻止未启用、未完成或不可用模块自动加载。

## 记录

- [R001 当前 WebUI 全栈耦合审计](R001-current-webui-coupling/report.md)：沿 Binding、Composition、codegen、Router、宿主契约、业务页面和 CSS 核对当前依赖方向。
- [R002 静态全栈模块方案比较](R002-static-full-stack-module-model/report.md)：保存“把 web facet 迁入独立前端目录”的历史比较；其页面 owner 结论已由 R003 取代。
- [R003 模块自有 WebUI 与 SDK 适配边界](R003-module-owned-webui-sdk-boundary/report.md)：落实用户修订决策，区分 module-local adapter、host-level SDK capability 和普通模块接入。
- [R004 WebUI 模块启用、降级与加载门禁](R004-activation-degradation-load-gates/report.md)：核对当前 Entry 与 locale 加载顺序，定义 Selection、Activation、Delivery、Availability、Access 五层 fail-closed 门禁。

## 门禁结论

关键问题已经有可复核证据。R003 已把“模块目录继续持有 WebUI”与“宿主 SDK 通用化”明确分开，R004 已证明当前 locale 仍会早于 manifest 全量加载，并给出构建与运行双层门禁。剩余未知主要是首批 SDK public surface 和 availability provider 的逐符号清单，不妨碍形成计划；这些清单必须分别在实施 Checkpoint A/D 冻结，因此研究门禁通过。
