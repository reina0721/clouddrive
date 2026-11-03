# R075-003 API 文档页内呈现层改用平台组件的决策复核

## 研究问题

用户追加要求：API 页面「页内组件也需要使用当前 WebUI 的组件」。这意味着页内呈现（operation 列表、方法徽标、参数表、响应表、schema 属性表等）必须由 `@webui/sdk/ui` 组件体系构成，而不是第三方 Swagger UI 原生控件的外观。需要回答：第三方库能否满足、自绘呈现的边界与成本、依赖与生成链如何调整。

## 方法与范围

- 检查已提交的 075 实现（commit 55ee70f）：页内为 `swagger-ui-react` 完整组件树（其控件/样式既不可被注入平台组件，也不可被平台化替换）。
- 盘点平台组件清单（`webui/src/ui/index.tsx`）与页面需求映射：PageHeader/PageSection 页面骨架、Surface/DataCard 卡片、DataTable 参数/响应/属性表、InlineAlert 错误态、EmptyState 空态、Button 交互、SelectField 过滤——足以表达只读契约参考页。
- 对照 AGENTS.md 3.2 的选型纪律：自研前必须说明候选不适用证据、项目特有价值、维护责任、风险边界、退出条件和验证计划。

## 事实

- swagger-ui-react（5.32.14）的呈现是完整自足组件树：控件语义、样式与交互（折叠面板、请求构建器、导入导出、OAS 徽标等）固定在第三方实现内；没有把宿主组件注入替换其控件的官方机制。因此「页内使用当前 WebUI 组件」与「继续用 swagger-ui-react 渲染页内」互斥（R075-001 的采用结论不再满足用户新要求）。
- 用户要求是产品决策：Admin WebUI 是自持产品，页内呈现一致性优先于复用第三方文档控件。
- 平台组件均可用（见上）；HTTP method 徽标无现成语义组件（StatusPill 语义为 CapabilityState，不适合 GET/POST），由模块内小型专用组件 + css module 承担（与既有「业务 selector 模块自有」规则一致，不构成新平台 SDK）。
- 生成链（openapi-spec.ts，R075-002）与渲染库无关，保持不变；自绘页面的数据源/三态 mock/零请求语义不变。
- 页面只读化带来范围收缩：不实现请求执行器（try-it-out）。真实用例仅「契约可视化浏览」；执行请求的能力与项目安全边界（CSRF/Origin 绑定、webuiSession）本身互斥，Swagger UI 的执行器对多数受保护操作本就不可用（075 页面说明已如实标注），不存在隐藏损失。

## 推断

- 自绘成本集中在「契约呈现的数据结构解析」：operation/tag 分组、参数/响应/schema 提取——这些是纯函数（输入 spec 对象，输出视图行），可单测，且只需覆盖项目实际产生契约的形态（OpenAPI 3.0.3、Huma 输出，无 `$ref` 远程/循环复杂度以本地 components.schemas 为主）。
- 维护责任：呈现层归 openapi 模块所有（模块自有逻辑，不成为平台通用能力），契约为构建期快照，没有运行期解析器依赖；后续契约为 OpenAPI 3.1 或新扩展时按需演进（退出条件：出现平台级通用文档呈现需求或新的成熟开放组件时重新评估）。
- 依赖与体积收益：删除 swagger-ui-react（页内 chunk 从 ~1.37MB raw / 387KB gzip 降到数百 KB 级，仍为懒加载独立 chunk）；`@types/swagger-ui-react`、tsconfig/vite 的 swagger 别名一并删除（单轨，不留旧实现）。

## 结论

- 【替换】页内呈现层由 swagger-ui-react 替换为「openapi 模块内、基于 `@webui/sdk/ui` 组件的只读契约参考页」；删除 swagger-ui-react 依赖与相关别名，页内所有控件使用平台/模块组件。
- 【保留】`webui generate` 契约快照生成链（openapi-spec.ts）、module 声明、菜单/路由、mock 空表、icon `book`、alias `@webui/generated/openapi-spec`（页面继续使用）。
- 边界：只读展示（无请求执行器）；方法徽标等无语义平台的细节由模块内自绘；不新增平台 SDK capability、不建全项目级渲染框架。
- 验证：vitest 直接渲染真实页面（无第三方 mock 需求）+ Playwright dev/mock 断言平台组件标记/内容；e2e 断言从 `.swagger-ui` 迁移到页面自有语义标记。

## 适用与不适用场景

- 适用：Admin 内页、平台组件一致性优先、只读契约浏览、OpenAPI 3.0.x Huma 产物。
- 不适用：独立文档站点（swagger-ui-dist）；需要完整调试执行器/导出/多契约切换的用例（无真实需求，成本不成比例）。

## 局限与剩余未知

- 页面交互深度（展开折叠粒度、schema 递归展示深度）在实施中按真实契约样本校准；`$ref` 循环引用在 Huma 产物中为 components 本地引用，递归渲染需做深度/循环保护（设计内落地）。
- 本记录不重新评估 swagger-ui-react 在独立站点场景的适用性（与 075 页内场景无关）。

## 对当前任务的影响

- 撤销 55ee70f 中 swagger 渲染部分：package.json/pnpm-lock、tsconfig/vite 的 swagger 别名、OpenAPIPage 页内实现、e2e 断言、vitest mock 移除。
- design.md/tasks.md/requirements.md 按本决策更新；R075-001 标记 superseded（本记录 supersedes），历史证据保留。