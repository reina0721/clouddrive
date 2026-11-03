# 任务

## 确认状态

研究门禁已通过，用户已确认实施；以下任务已完成。`old-backend/` 全程排除。

| ID | 任务 | 状态 | 完成条件与证据 |
|---|---|---|---|
| `DOCSYS-051-001` | 完成当前文档体系全量审计 | 已完成 | R001 report 与 audit matrix 覆盖入口、模块、能力、前端、运维、历史和门禁；`old-backend/` 明确排除 |
| `DOCSYS-051-002` | 建立项目范围与当前状态 authority | 已完成 | `docs/repository-scope.md`；根 Go、`webui/`、`frontend/`、排除目录、生产交付和身份冲突均有事实状态；未修改 `old-backend/` |
| `DOCSYS-051-003` | 修复根入口、完整启动与首次使用路径 | 已完成 | 根 README 提供后端/全栈两条路径；`docs/getting-started/first-use.md` 覆盖 Setup、登录、Todo/API 和 management 验收 |
| `DOCSYS-051-004` | 补齐局部 README、索引、回链和运行能力矩阵 | 已完成 | `webui/README.md`、`internal/module/auth/README.md`、完整 module/pkg 索引、`runtime-capabilities.md`；docs guard 通过 |
| `DOCSYS-051-005` | 清理当前文档历史污染并恢复基线来源说明 | 已完成 | 当前主题移除任务编号前置；`docs/scaffold-baseline.md` 存在；change 导航区分导入基线与仓库原生记录 |
| `DOCSYS-051-006` | 修复 `frontend/` 当前状态文档 | 已完成 | `frontend/README.md` 删除不存在路径/脚本声明，明确未进入根 build/CI/release；未实施集成或退役 |
| `DOCSYS-051-007` | 定义文档治理 authority、触发矩阵和机器清单 | 已完成 | `documentation-governance.md`、`docs/documentation.yaml`、051 `documentation-impact.yaml` 完成并相互一致 |
| `DOCSYS-051-008` | 实现并测试跨平台 docs guard | 已完成 | Go 核心工具、PowerShell/shell 入口、单元 fixture 覆盖链接、可达性、目录完整性、anchor 和 impact authority 判断 |
| `DOCSYS-051-009` | 接入 quality/release 并更新质量说明 | 已完成 | Windows/Linux quality 与 release 静态 Docs gate 已接入；quality 的格式扫描明确排除 `old-backend/`；Go/WebUI/Docs 与外部验收边界已写入运维文档 |
| `DOCSYS-051-010` | 完成范围验证与交付 | 已完成 | docs guard、串行 Go 全量测试（`-p 1`）、WebUI 静态链、YAML 解析、`git diff --check` 通过；Linux shell、E2E、视觉、外部协议和生产托管未在本机执行 |

## 依赖顺序

```text
001
  -> 002 -> 003
  -> 004 -> 005 -> 006
  -> 007 -> 008 -> 009
  -> 010
```

002–006 负责修复当前内容，007–009 负责阻止后续再次失配；两部分已共同完成。

## 不在本次确认范围内

- `old-backend/` 的读取审计、内容修改、迁移或删除。
- `frontend/` 的代码集成、构建接入或删除。
- 仓库、Go module、镜像、二进制和 release 身份迁移。
- WebUI 生产托管、服务启动、数据库迁移或任何外部系统写入。
