# 个人账户常驻表单与轻量内联操作

用户最终选择常驻页内表单，明确取消弹窗编辑方向。页面按个人资料、账户安全、有效登录会话排列，使用轻边框 Section；两组动作是字段后的普通按钮行，无 Sticky／Fixed、独立背景或浮层阴影。

## 设计与实现

资料字段桌面两列、手机单列，身份 ID／状态／角色作为下面的只读摘要。UserForm 新增 embedded 组合，保留验证、权限、版本冲突、刷新与未保存保护；默认用户创建和编辑页仍用原 Section 与 FormActions。账户动作是重置／保存资料。

密码字段常驻并限制桌面阅读宽度，影响说明提前展示。清空不改变资料，修改只提交一次；失败保留输入并定位当前密码，成功清空凭据并重新登录。密码错误与会话查询错误分别呈现，避免互相污染。

有效会话独立区段，刷新与退出其他会话在标题操作组；当前会话有状态标识，退出按钮明确当前影响。无其他会话显示禁用原因。只有离开未保存内容及撤销会话使用既有确认弹层。

## 公共能力边界

已撤回本轮仅为编辑弹窗引入的 DialogSurface、FoundationForm.id、UI Elements 示例、公共契约及状态扩展。保留之前已有组件与展示，不改全局 StickyActions，不新增 API、路由、依赖、Token 或持久化迁移。

## 验证

旧弹窗方向日志仅保留作为实施诊断，不作为当前方案验收证据。当前专项首轮 8 项通过、2 项矩阵失败，失败为确认浮层进入动画未稳定时的 Axe 扫描；补上统一视觉就绪等待后，两项中文浅色／英文深色矩阵均通过。覆盖 320／390／768／1440／2560、页面无横向溢出、普通操作行无定位与阴影、密码阅读宽度、确认焦点和 Axe。

实际操作已通过资料校验、重置、Enter 保存、持久化恢复、两组输入独立清空／重置、未保存导航取消及确认离开、密码错误定位、成功重新登录、会话退出，以及 Backend 版本冲突恢复和 Pending 下防重复原生提交。Backend 为请求夹具验约，真实后端联调继续延后。

完整门禁首轮在上一轮 auto-restore 测试的 JSON.parse 未校验访问处被 ESLint 拒绝，已为该旧偏好夹具增加 Zod 校验，保留所有字段并复核相同行为；无规则豁免或阈值调整。

最终完整 `pnpm check` 退出 0：Foundation、Architecture、Dependency、两项 Codegen freshness、ESLint、TypeScript、438 项单测、Next build、产物预算、365 项浏览器测试、Prettier 和 docs:check 全部通过。浏览器全量运行 42.2 分钟，未更新任何视觉基线。原日志见 [完整门禁](evidence/check-final.txt)，截图归档见 [浏览器证据](evidence/browser-full-artifacts.zip)，新布局见 [整批预览](evidence/index.html)。

预算实际 gzip 字节：initial=371523，最重路由 /page-archetypes/resource-list=438526（上限 440320），CSS=48434（上限 49152），largestChunk=84658。保持全部规则与阈值。

旧阶段自动生成截图已复制到本轮 evidence/existing-regressions 后恢复历史原文件，Next 自动生成的类型引用文件亦恢复；未提交、部署或更改真实服务。已有 HeroUI PressResponder 和颜色环境警告仍在日志中，没有隐藏；本轮未出现对应交互、Axe 或视觉失败。
