# R065-001 日志与审计体系当前能力、缺口与进阶候选方向

## 1. 研究问题

用户要求「深度研究，为项目新增方案：日志与审计体系等业务模块」。回答（a）当前日志体系与审计体系的能力边界；（b）真实缺口与无收益扩界边界；（c）业务模块写操作是否具备可审计路径；（d）进阶应落在哪个模块/能力边界，形成 065 计划的事实基础。

## 2. 方法与范围

- 只读检查 `pkg/logger/*`、`internal/kernel/logging/*`、`internal/module/auth/**`（审计相关）、`internal/module/{iam,organization,navigation}/service`、`docs/development/logging.md`、`docs/operations/security.md`、`docs/operations/runtime-capabilities.md`；快照 commit `753f2b7`（064 完成）。
- 复核既有档案 `028/R001`、`041/R001`、`022/R006`、`024/R002,R005`、`057/R013`、`064/R064-001` 的适用/不适用判定与刷新触发器。
- 不修改实现；不启动服务；不执行浏览器验收。

## 3. 证据：当前事实（有代码证据）

### 3.1 日志体系已闭环但只有 sink 写入、无查询 API

- `pkg/logger`：项目自有 `Logger`（Debug/Info/Warn/Error/With）、`Field`、`Config`、`Resource`（Sync/Close）封装 zap；`internal/kernel/logging.Manager` 强制 baseline + 配置 replacement；`docs/development/logging.md` 规定唯一错误 owner、级别、结构化字段、低敏与测试。
- 运行事件覆盖：Application/Generation 生命周期、HTTP access（method/operation/request_id/trace_id/status）、Auth security decision、Execution、Scheduler、Messaging、Management、Migration（041 已治理）。
- 输出模型：`sinkSet` 只写 stdout/stderr/文件（`openSink`）；**没有日志查询 API、没有日志存储/检索**，日志消费完全在进程外（文件/采集器）。这是「日志作为可查询能力」的真实缺口。

### 3.2 审计体系在 064 已落地「授权决策审计」，但不覆盖业务写操作

- 064 新增 `auth_schema_migrations` + `auth_audit_events` + `adapter/audit/storage` 持久化 Sink + `auth.audit.list` 只读查询 + Auth WebUI 审计页 + `auth:audit:read` 权限键。
- 事件来源目前**只有 Auth 自己的授权路径**：`EnforceOperation`/`EnforceAction`（operation/action 级授权决策）+ `RecordAuthenticationFailure`；事件字段含 operation/action/actor_kind/subject_hash/resource_type/resource_hash/decision/outcome，低敏。
- **业务模块的写操作没有任何审计痕迹**：`internal/module/{iam,organization,navigation}/service` 中没有 `AuditEvent`/`Record` 调用（grep 验证）；IAM 创建账号/角色、替换角色权限、Organization 部门/岗位/分配变更、Navigation 菜单策略变更都未记录「谁在何时对什么资源做了什么」。这是「审计体系」最实质的操作审计缺口。

### 3.3 既有判定与边界

- `024/R005`：认证授权（含 audit）收口在 `internal/module/auth`；业务模块只定义自己需要的窄 port，唯一 composition root 连接。→ 业务操作审计应通过窄 port 注入同一低敏审计面，而不是新建第二套审计存储。
- `041/R001` non-applicable：集中日志平台选型、OTLP Logs、日志轮转、审计日志持久化（后项已于 064 落地为真实选择，属判定刷新）。→ 日志自建查询/检索是**无收益扩界**：当前 10 个输入模型不支撑查询语义，外部平台才适合承担检索；自建=重复造轮子。
- `057/R013`：http 观测走官方 otelhttp，业务日志永不进 tracing。
- `064/R064-001`：审计查询、保留上限已确认；MFA/数据权限/外部身份列为后续。

## 4. 事实与推断的区分

**事实**：日志 sink 模型无查询 API；审计只覆盖 Auth 授权决策；业务写操作无审计记录；`audit` owner 在 Auth；业务模块通过 port 接入（053-058 既定模式）。

**推断（需设计确认）**：
- 「业务操作审计」是真实缺口：用户可查询「谁改了什么」；实现 = 在 Auth 暴露窄 `OperationAuditWriter` port（复用 `AuditSink`/`auth_audit_events`），IAM/Organization/Navigation 在写操作成功边界调用，经 composition 注入。
- 审计查询增强（结果视图加模块维度/动作筛选）属低风险配套；日志自建查询与外部日志平台保持非目标。
- 独立 audit 业务模块相对「收口 Auth + 窄 port」没有额外收益，且会推翻 024/R005 既有决策，属于无收益重构（除非有强 consumer 证据——当前没有）。

## 5. 适用与不适用场景

- 适用：业务写操作审计（IAM/Organization/Navigation 变更点）、审计规范 authority（在 `docs/development/logging.md` 或并列文档固化「操作审计」要求）、审计查询增强（模块/动作过滤）、配套 WebUI 审计页增强（模块维度/动作筛选、差异呈现）。
- 不适用：日志数据库/全文检索、外部日志平台、OTLP Logs、日志轮转、SIEM/异地聚合、独立 audit 模块推翻 024/R005。

## 6. 局限与剩余未知

- 未执行浏览器验收与真实负载；操作审计的字段/动作枚举（action 域、resource type 域、是否含 before/after）需设计确认，但**不得**引入原始对象内容（保持低敏）。
- 业务写操作审计的「成功边界」语义：在事务内还是事务后记录、失败是否记录，需按失败语义设计（fail closed 不吞错、不阻断主路径）。
- 日志查询若未来确需，应在外部平台边界内研究，不在本变更自建。

## 7. 对本任务的影响

- 结论：进阶方案应聚焦「业务操作审计」（真实缺口、模块边界清晰、符合 024/R005+port 模式）与配套审计规范/查询增强；日志体系保持已闭环（不新增查询 API），外部平台维持非目标。
- 研究门禁：证据充分（日志/审计代码、业务服务层、既有判定均已核实），足以形成计划；最终范围由用户在计划阶段决策。