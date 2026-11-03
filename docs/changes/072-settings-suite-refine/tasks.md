# 072 设置套件细化 — 任务清单

> 依赖：研究门禁通过（R072-001/R072-002）；计划按 design.md 第 5 节推荐项执行；非文档实施需用户对计划报告的独立确认。

## 任务总览

| ID | 任务 | 依赖 | 完成条件 |
| --- | --- | --- | --- |
| SET-072-A | IAM：migration 004 资料字段 + UpdateSelfProfile/self-archive 两步端点 + 测试 | 计划确认 | REQ-A1..A3 |
| SET-072-B | runtime HostRuntime.navigate + App 注入 + SettingsNavLayout onSelect（SPA 修复） | A | REQ-B1..B2 |
| SET-072-C | settings 8 分区重组（路由/menu/页面/语言/关于/鸣谢/i18n/mock/图标） | B | REQ-C1..C3 |
| SET-072-D | Go/WebUI/e2e 验证与截图（SPA 切换无 reload、资料/注销/语言/关于/鸣谢） | C | REQ-D1..D2 |
| SET-072-E | 文档（IAM 自服务契约、webui 8 分区与 SPA 导航规范、changelog）与提交 | D | REQ-D3 |

## 状态记录

- 2026-08-26：研究门禁通过（R072-001 现状：IAM 无资料字段/无自服务归档端点、archive 即软注销语义、runtime 无 navigate、语言键已有；R072-002 推荐：updateProfile + self/archive 两步、HostRuntime.navigate SPA 修复、8 分区页内全列/菜单五项）；用户确认全量实施（决策 1–5）。
- SET-072-A（完成）：IAM 后端——migration 004 三方言（nickname/bio/birth_date + checksum 清单 version 4）；model/repo/service（UpdateSelfProfile 乐观锁 + Begin/ConfirmSelfArchive 两步确认进程内存储 TTL）；自服务端点 PATCH /api/v1/iam/self/profile 与 POST /api/v1/iam/self/archive{,/confirm}（permission keys self-profile.write/self-archive、serviceError 映射、huma 唯一 operation ID）；contract-openapi/operation-inventory 生成物同步；新增 Go 测试：资料乐观锁/非法日期、两步软注销（错误确认拒绝、确认后登录拒绝与会话吊销、owner 保护）；`go test ./...` 全绿。提交 9c224ef。
- SET-072-B（完成）：`HostRuntime` 增加 `navigate(path)`（contracts 类型 + App.tsx 注入 react-router navigate，向后兼容）；`SettingsNavLayout` 改用 SectionNav onSelect → navigate（SPA 分区切换，http 整页刷新路径单轨移除）。
- SET-072-C（完成）：settings 8 分区重组——binding 8 路由/菜单五项、SettingsNavLayout 8 分区全列；页面 Profile（资料表单 + 乐观锁冲突提示）/Account（用户名 + 注销两步确认）/Security（改密迁移）/Appearance/Notifications（保持）/Language/About/Acknowledgement；identity 会话投影携带资料（model/service/huma contract）；i18n 双语全键；受控图标 info/star/languages 两侧；生成链更新。
- SET-072-D（完成）：Go 全量测试、WebUI typecheck/lint/vitest 110/build/generate:check 全绿；Playwright 20 全绿（新增 072 用例：SPA 分区切换无整页 reload（load 计数 0）、资料保存、注销两步对话框取消、语言/关于/鸣谢渲染、截图 072-settings-{language,about,acknowledgement}.png）。
- SET-072-E：文档同步与提交——进行中/待收尾。