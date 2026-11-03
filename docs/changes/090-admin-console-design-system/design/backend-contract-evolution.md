# 后端契约演进设计

## 1. 设计边界

UI 需要的是面向管理任务的稳定投影，不是把数据库模型完整暴露给前端。新增契约继续由各业务模块拥有，通过现有 WebUI binding 与生成 registry 暴露；不建立无归属的通用后台 API 包。

## 2. 通用查询语义

各模块可共享窄的基础值对象，但字段与允许排序仍由资源所有者声明：

```text
QueryRequest
  search?: string
  filters: resource-specific typed fields
  sort: [{ field, direction }]
  page: offset/limit or cursor/limit

QueryResult<T>
  items: T[]
  pageInfo
  total?: number
  facets?: resource-specific summaries
  snapshot/version?: string
```

- Offset 适用于稳定小规模管理数据；高变化/大规模日志使用 cursor。
- `total` 和 facets 可能昂贵时必须显式可选并标注近似/延迟，不能暗中改变口径。
- sort field 使用资源专用枚举，非法值直接返回验证错误。
- search 的匹配字段和大小写/模糊语义需在资源契约中说明。

## 3. 列表与详情投影

同一资源至少区分：

- `Summary`：列表高频字段、状态和少量关系摘要；
- `Detail`：详情页需要的完整允许字段、版本和 actions；
- `Reference`：下拉/关系选择使用的轻量身份；
- `Command`：创建、修改和状态转换的专用输入。

`allowedActions` 只能作为 UI 辅助，服务端仍在命令执行时鉴权。关系摘要提供 count 与少量 preview，完整集合通过独立分页查询读取。

## 4. 影响预览与命令

高影响命令采用 preview/execute 两阶段但不形成永久双轨：

```text
Preview(command, expectedVersion)
  -> previewId, expiresAt, affectedCounts, warnings, blockers

Execute(command, previewId, idempotencyKey)
  -> completed | partial | accepted(jobId)
```

preview 有短有效期，execute 重新校验版本、权限和约束。低影响命令可直接 execute，避免机械增加两阶段。

## 5. 批量结果

同步批量响应统一表达：

```text
requestedCount
processedCount
succeeded: [{ resourceId, version? }]
failed: [{ resourceId, code, message, retryable }]
correlationId
```

失败消息是受控用户信息；原始错误链保留于服务端诊断。单项权限失败不得使其他结果丢失。是否原子必须由具体命令明确：需要事务一致性的操作整体失败；可独立资源操作允许 partial。

## 6. 异步 Job（P1/P2）

Job 由明确能力模块拥有，最低契约为：id、type、owner、status、progress、counts、created/started/finished/expiry、result reference、stable failure summary、cancel capability。Job 的执行、恢复、并发和保留策略需要独立研究；本方案只规定 UI 接口需求，不虚构现有基础设施。

## 7. 审计投影

- `eventId` 稳定唯一，`correlationId` 串联一次请求/工作流；
- 服务端使用确定性 `(occurredAt, eventId)` 排序与 cursor；
- filter 支持明确时间范围和资源/操作者/动作/结果；
- Detail 只返回 allowlist metadata 和摘要，不返回原始请求体、Authorization、Cookie、DSN 或 secret；
- 高影响 preview、execute、异步 Job 和导出都记录相关审计。

## 8. 统计与运维

统计响应必须携带 metric key、value、unit、window、timezone、asOf、dataDelay 和 comparison basis。运维产品投影从现有 health/diagnostics 演进，不让前端从 Prometheus 文本推断业务语义。Prometheus 仍服务监控系统和专业调试。

## 9. 错误语义

前端至少需要识别 validation、unauthenticated、forbidden、not_found、conflict、rate_limited、dependency_unavailable、timeout、partial_failure。每个错误带 correlation ID；字段错误带稳定 field path。错误转换保留服务端原因链，但用户消息不包含敏感内部细节。

## 10. Migration

- 新契约按页面族落地并同步生成 registry、前端 adapter、测试和文档。
- 同一资源迁移完成后删除旧 UI 调用与旧契约；不长期保留 v1/v2 双入口。
- 若外部协议兼容需要短期双轨，必须另行确认范围、截止和删除任务。
- 数据库字段或索引变更在实施子任务中单独评估本地数据与破坏性影响，本设计不授权 migration。
