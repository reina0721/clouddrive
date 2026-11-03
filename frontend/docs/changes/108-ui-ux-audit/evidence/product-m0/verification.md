# M0 验证记录

日期：2026-10-12（Asia/Shanghai）。范围为报告与证据；没有修改产品源码、架构规则、依赖、测试断言或视觉 golden。开始时工作区已有 Authentication/Sidebar/截图/Contract 等未提交修改，完整检查使用当前工作区，不把先前变更归入本轮 M0。

## 源码与浏览器

- [源码盘点](source-inventory.json) 记录 HEAD、38 Plugin URL、5 Host URL 和 fallback；HEAD 不代表工作区无未提交修改。
- [线上路由](online-routes.json) 38 项逐页 DOM；[公共认证页](online-public-auth.json) 4 项。`/ui-elements` 入口实际 replace 至 `/ui-elements/actions-selection`。首页亦实际检查。
- 线上演示 Mock 登录、退出；本地登录、首页、资源列表、数据工作台筛选/空态/分页和 404。两环境独立会话；结束时均退出本轮登录。
- 线上参考资源创建校验、创建→列表、编辑→离开确认→Escape 保留→保存→详情、通知 1→2→全部已读、刷新内存数据恢复。未提交真实业务请求。
- 桌面全局搜索、设置字段搜索与 focus、账户语言；手机详情/导航/设置分类/深色刷新；平板设置布局。临时语言/主题已恢复、viewport override 已 reset。
- 404 线上翻译 key 缺陷与本地正常结果分别保留：[线上](online-unknown.txt)、[本地](local-unknown.txt)。恢复按钮可用，具体部署根因尚未确认。
- 局部手机截图已视觉检查；像素捕获不作为全设备、全状态、Axe 或视觉 golden 批准。真实 Backend、真实手机硬件、线上 commit 一致性未验证。

## 自动门禁

本轮执行根命令 `pnpm check`：Foundation/Architecture/Dependency/Codegen/Lint/TypeScript、403 项 Vitest、生产构建与性能预算通过。进程在 Playwright 第 284 项通过后停止，未获得整条命令成功退出证据，原日志保留为 [check-interrupted.txt](check-interrupted.txt)。因此不宣称一次完整 `pnpm check` 全绿。

随后补跑最后 12 个测试文件（含临界 Surface Foundation 文件及 Backend project），58 项通过，退出码 0，见 [browser-remaining.txt](browser-remaining.txt)。按 project、文件、行号和标题对照 [当前完整清单](browser-test-list.txt)，两段日志合并覆盖 **341/341 个唯一测试**，无缺项；首个 Surface Foundation 用例重复通过一次，见 [覆盖核对](browser-coverage.json)。中间一次全量重启为避免重复已通过用例主动停止，退出码 1；[该日志](browser-restart-stopped.txt) 不计作测试失败或完整验收成功。

根 `pnpm format:check` 与 `pnpm docs:check` 独立通过；后者检查入口、8 个 authority、15 项变更索引。格式日志见 [format.txt](format.txt)。原有视觉阈值和 `updateSnapshots: 'none'` 保持不变。

Backend project 三项是受控请求协议测试，覆盖 CSRF/session/login/register/logout、恢复失败与私有内容 Gate，**不是实际服务联调**。其日志出现 `PressResponder ... without a pressable child` 警告；测试没有失败，但警告来源尚未定位，后续交互组件复核应检查该路径，不能把无失败等同于无警告。

本报告与最终验证记录更新后再次使用项目 Prettier、文档门禁和 diff whitespace 检查。

## 已知边界与后续

本阶段未实施 M1–M7，完整缺口、复用与依赖见 [M0 报告](../../product-readiness-m0.md)。若原门禁暴露非本轮产品回归，先记录具体失败，不通过自动更新基线或扩大任务范围掩盖。本阶段不把受控 Backend 测试通过记为真实 API 接入通过。
