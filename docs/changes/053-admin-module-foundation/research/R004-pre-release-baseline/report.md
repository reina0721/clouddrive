# R004 首发前 schema baseline 与 Todo 保留决策

## 1. 研究问题

053 初版计划把现有 Todo migration version 4 当作需要兼容的已发布数据库：Account 新增独立 migration set，读取并迁移 `webui_users` 的 ID/password hash，再删除旧运行表。用户指出项目尚未成型、没有正式发布，要求判断这条升级链是否真实必要，以及 Todo 是否应该保留。

本研究把三件事分开判断：正式兼容承诺、本地运行数据、Todo 产品定位。未发布不自动等于本地没有数据，Todo 是否保留也不能由 migration 实现便利性决定。

## 2. 当前证据

### 2.1 Git 与 release

- 当前 `HEAD` 与 `origin/main` 都是 `a935a68879cfc0042268bf23393a582ac78a25c8`；源码已经进入共享远端开发基线。
- `git tag --list` 为空，没有正式版本 tag。
- `.github/workflows/release.yml` 只由 tag 触发；没有证据表明执行过正式 GitHub Release。
- 当前项目自身已定义 copy-owned source scaffold 形态，但不存在由正式 release 建立的数据库升级兼容对象。

因此，不能声称源码“从未公开”，但可以确认当前没有已冻结的首发 migration 兼容基线。`origin/main` 不能单独推导出生产数据库升级义务。

### 2.2 本地数据库

对 `.data/app.db` 使用 SQLite read-only URI 实时查询，结果为：

```text
schema_migrations = version 4, dirty false
todos             = 0
webui_users       = 1
webui_sessions    = 4
```

查询没有读取 username、password hash、Session ID 或其它凭据内容。该数据库不是空文件：重建会丢失一个本地登录账号和 Session；但没有需要保留的 Todo 业务行。

本地运行数据属于用户。取消产品级自动迁移不授权本任务删除、覆盖、移动或重建 `.data/app.db`。若后续需要使用新 baseline，必须先明确目标文件、备份/恢复方式和损失，再获得当次授权；账号可在新库通过 setup 重新创建。

### 2.3 Todo 产品定位

`docs/changes/020-scaffold-product-form/decision.md` 已确认：Todo 是默认保留的学习示例，不是底座依赖，并且完整移除路径已经在隔离副本验证。当前根 README 也把 Todo 描述为默认应用垂直切片。

这意味着：

- Account 不应依赖 Todo，也不应让 Todo 继续拥有账号 schema；
- “无需 Todo4 兼容迁移”不等于“必须删除 Todo”；
- 当前仍按既有产品决策保留 Todo 示例；若项目从脚手架转为具体社区产品，Todo 去留应作为显式产品范围变更另行确认。

## 3. 结论

053 不建立正式历史升级链，改为首发前干净 baseline：

1. Todo 保留为学习示例，只拥有 Todo schema、配置、API、CLI、WebUI 与测试。
2. Todo 当前 `000001..000004` 收敛为表达最终 Todo schema 的新 `000001`；当前源码不再保存 expand/backfill 或 Auth 表历史步骤。
3. 054 IAM、055 Organization、056 Navigation 分别从独立 `000001` 创建自己拥有的最终 schema；不读取 `webui_users`，不迁移 password hash，不依赖 Todo version 4。
4. Migration catalog 先在 053 建立 `todo_schema_migrations`，再由 054–056 依次加入 `iam_schema_migrations`、`organization_schema_migrations`、`navigation_schema_migrations`；各 set 独立、按确定顺序运行，不建立跨 set 历史迁移依赖。
5. 检测到退休的 `schema_migrations`、`webui_users` 或 `webui_sessions` 时，status/up 返回稳定的 `pre_release_baseline_reset_required`，不继续写入、不静默共存，也不自动删除数据。
6. Git 与历史 `docs/changes` 保留演进证据；当前 migration、源码和主题文档只表达首发目标状态。

该方案比自动升级链更符合当前阶段：它消除错误 owner 和永久兼容成本，同时通过显式拒绝保护已存在的本地数据库，不把“未发布”误解为“可随意删除”。

## 4. 对 053 的影响

- 删除 requirements/design/tasks 中的 Todo4 upgrade、旧用户迁移、旧 Session 迁移和旧表自动删除要求。
- 保留多 migration set 能力，因为当前应用保留 Todo，并将新增 IAM、Organization、Navigation 三个 schema owner；各 set 独立，无历史迁移依赖。
- Migration 验收改为 fresh、repeat、dirty/incompatible、退休 baseline 拒绝和三驱动 checksum；不再验收 Todo4 自动升级。
- E2E 在临时数据库运行。默认 `.data/app.db` 不属于实现或自动化测试目标，后续重建需要独立明确授权。
- 053–056 分别进入“计划待确认”；用户对修改方向的确认不是任何一项非文档实施确认。

## 5. 刷新条件

出现首个正式 release、外部消费者/生产数据库证据、必须保留当前本地账号、Todo 产品定位变化或 repository scope authority 改变时，本研究失效。届时必须重新设计版本、迁移、回滚与支持窗口，不能继续应用首发前 baseline 结论。

## 6. 研究门禁

正式兼容对象、本地数据、Todo 定位和破坏性边界均有可复核证据；事实、用户决策与目标方案已经分离，足以修订 053 计划。研究门禁通过，不构成非文档实施或本地数据库重建授权。
