# 076 RBAC / HTTP API 未闭环缺口修复

## 状态

**已确认，实施完成**（用户确认：全部 5 组缺口纳入本批；G5 采用 min/max + 可选复杂度开关默认关。验证：`go test ./...` 84 包全绿、`go vet ./...`、contract-gen 再生成、config init 模板、Vitest 144、Playwright 22、docs-guard 全部通过；受限项见 [tasks.md](tasks.md)）。

## 目标

修复当前 IAM RBAC 管理与 HTTP API 的五类未闭环/缺口，全部落在既有模块边界与机制内：

1. **Gap1（认证断点，优先级最高）**：Organization 全部 operation 声明 `bearerAuth`，而默认托管模式（模式 B，IAM WebUI Session）只携带 Session Cookie、operation gate 对 `bearerAuth` 仅映射 Bearer 来源，org 页面真实 API 不可达；且 org mutation 无 CSRF/Origin 守卫。→ 单轨迁移 `webuiSession` + 接入既有 mutation guard + 前端补 Origin/X-CSRF-Token。
2. **Gap2（反向查询）**：缺 role→accounts、permission→roles 影响分析查询 → 新增两个只读 GET 端点（权限复用 `iam:role:read`/`iam:permission:read`，不新增权限键）。
3. **Gap3（会话分页）**：`iam.sessions.list` 全量返回、伪分页 → 分页 + status（active/revoked/all）过滤。
4. **Gap4（账号过滤）**：`iam.accounts.list` 仅关键字 → 增加 status/archived/roleId typed 过滤。
5. **Gap5（密码策略）**：最小/最大长度硬编码 → `iam.local.passwordPolicy` 可配置（默认 15/128 兼容存量，复杂度开关默认关）。

关键边界：不新增权限键、不改变 Casbin model/授权 authority、不动 Session/Cookie/CSRF 语义；多实例、MFA、外部身份、数据权限、IP 限流、自助找回等继续列为候选方向不实施。

## 阅读顺序

1. [研究档案](research/README.md)：R076-001（缺口事实核实）
2. [需求](requirements.md)：REQ-076-001..008
3. [设计](design.md)：方案对比、数据流与实现位置、待确认决策
4. [任务清单](tasks.md)：任务与验证矩阵（待确认/执行）