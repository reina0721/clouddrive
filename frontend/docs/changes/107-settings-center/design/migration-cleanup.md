# 迁移与单轨清理

## 1. 目标与边界

- 旧用户偏好值保留迁移（theme/locale/sidebarCollapsed → 新分类模型）；
- 移除 system-tools preferences 全部资产，不保留旧路由/旧入口/路由别名（AGENTS §3.8 单轨）；
- 只保留 icons 图标工具（既有 Child 继续存在）。
  设计依据 R107-001 §8（删除引用面清单）。

## 2. `clouddrive.shell` v0 → v1 迁移

现状：`apps/web/src/state/use-shell-store.ts` name `clouddrive.shell`、version 0、无 migrate、
partialize `{theme, locale, sidebarCollapsed}`。
目标：偏好继续用该 key，version 0 → 1，migrate 把旧记录映射进新分类模型：

- 旧 `theme: 'light'|'dark'` → 新模型 appearance.themeMode。**注意语义扩展**：新默认是
  'system'，但旧用户显式 light/dark 应保留为显式值（不套新默认）；无记录（首次）才用
  新默认 system。
- 旧 `locale` → localeRegion.language（zh-CN/en 值原样）。
- 旧 `sidebarCollapsed` → navigation.sidebarBehavior（折叠态映射为 'collapsed'；展开 →
  'expanded'；新默认 'remember'——旧用户保留显式折叠态而非新默认 remember，遵循"旧用户
  值优先保留，不套新默认"）。
- migrate 必须处理 version 0 形状缺字段（旧 JSON 只有三字段）：补默认；未知/损坏记录 →
  Host 读取时显示原因与恢复动作，不静默覆盖（PersistResult 失败语义）。
- 新用户无记录 → 默认值表（capability-ports.md §6）。
- 临时 Shell 状态（mobileNavigationOpen 等）已不持久化并保持；新模型 partialize 白名单
  只含 durable 偏好字段；未来再破坏性变更续升 version。

## 3. 独立 Store key（不混入设置记录）

- favorites/recents、notifications center、search history、page states、drafts 分别独立
  persist store（state-foundation createPersistStore，name `clouddrive.<scope>.<store>`）；
  plugins 私有 store 归各自插件 stores/（filesystem ownership）；Host 级归 apps/web。
- 恢复默认只写偏好 store，绝不触碰上述独立 Store。

## 4. system-tools preferences 删除引用面（单轨）

| 资产                                                        | 动作                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `surfaces/plugins/system-tools/plugin.navigation.ts`        | 移除 preferences Child（icons 保留）                                                                                                       |
| `surfaces/plugins/system-tools/routes/preferences/page.tsx` | 删除文件                                                                                                                                   |
| `surfaces/plugins/system-tools/schemas.ts`                  | 删除 preferencesSchema（若 icons 无 schema 则整个文件删）                                                                                  |
| `surfaces/plugins/system-tools/i18n.ts`                     | 移除 preferences.* 与 nav.preferences 键                                                                                                   |
| `apps/web/src/shell/app-shell.tsx` 账户 MenuButton          | 硬编码 href → Route Target `route('settings')`                                                                                             |
| `apps/web/src/i18n/resources.ts`                            | 移除 nav.preferences/shell.preferencesDescription（Shell 禁引用 Plugin namespace；账户入口文案若在 Shell 侧由 Shell 键提供）               |
| `apps/web/e2e/preferences.spec.ts`                          | 删除/改为 settings 场景                                                                                                                    |
| `apps/web/e2e/visual.spec.ts`                               | 移除 preferences 快照 → 新增 settings 页快照                                                                                               |
| generated catalog/composition/plugin-routes/adapter         | `pnpm codegen:plugins` 自动收敛（禁手改）                                                                                                  |
| `tooling/foundation-contracts.json`                         | state-foundation authorityRoutes 移除 `/preferences`（改 `/settings` 或按实际 authority）；新增 surface/plugin-framework 公共 subpath 登记 |
| `docs/quality-evidence.md`                                  | 同步门禁证据数字/路径                                                                                                                      |
| `docs/plugin-framework.md` §9/§10                           | system-tools 示例改为 icons-only + settings 插件示例；§10 迁移叙述更新                                                                     |
| `docs/surface-foundation.md` / frontend README / AGENTS     | 仅在有事实变化处同步（本变更若新增公共 Pattern/规则才动）                                                                                  |

- 删除后 grep 确认旧符号（`system-tools.preferences`、`nav.preferences`、
  `preferencesSchema`、`/system-tools/preferences`）零残留（生成物除外——codegen 后同样
  检查）；历史变更账本（docs/changes）不改。
- settings 插件自身的 schemas.ts（plugin zod）不与 system-tools 共用；无路由别名。

## 5. 生成、登记与门禁

- `pnpm codegen:plugins` 生成 settings 路由与收敛删除；`codegen:plugins:check` 复核。
- surfaces/package.json exports += 产品模型 subpath；plugin-framework package.json exports
  += 能力子路径；tooling/foundation-contracts.json 与 dependency-policy.json 同步
  （exports 逐字节一致由 foundation check 强制）。
- docs/changes/README.md 索引 += 107（docs:check 要求含最新序号字符串）。
- 全量 `pnpm check`；视觉基线人工审阅后更新。

## 6. 风险与接受

- 旧用户"显式 light/dark + 展开/折叠"迁移必须保真（不套 system/remember 新默认）——
  migrate 单测覆盖三类形状：无记录、v0 三字段、损坏。
- 设置中心是本仓库迄今最大变更：SET-003~007 分实施轮次，每轮跑对应门禁；SET-002 的
  TailAdmin 外部复核未完成前不得标完成。
- 外层 `docs/repository-scope.md` 称 frontend 为 Nuxt/Vue 属陈旧描述，不在本变更范围
  （记录风险，不改）。
