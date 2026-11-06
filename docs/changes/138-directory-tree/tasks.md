# 唯一任务清单

- [x] T138-01 研究；前置：根范围、Git和metadata；完成：R138-001关键事实、成熟候选与所有权明确，研究门禁通过。
- [x] T138-02 计划；依赖01；完成：20行为、状态/接口/预算/文件与验证设计完成；当前goal已明确授权不中途确认直接实施。
- [x] T138-03 基础接通；依赖02；完成：Tree窄扩展、typed设备偏好、v1安全迁移和全调用方替换，删除旧方法。
- [x] T138-04 工作区树；依赖03；完成：单控制器、分页/路径跟随/错误/刷新/两种导航，F341–F360全接通后才开始集中功能测试。
- [x] T138-05 验证；依赖04；完成：708单位、最终类型/静态、34个不同真实浏览器场景、主/QA原预算通过；失败及修正见verification.md。
- [x] T138-06 预览；依赖05；完成：主4181、开发4173、QA4194前端重启成功，原两库所有files表摘要不变；17项运行检查、主预览CUA视觉及.data/138-primary-tree.png证据，访问说明.data/138-preview-guide.txt，服务保持运行。
- [ ] T138-07 交付；依赖06；完成：authority同步、完整diff/凭据审阅、Conventional Commit、推送与远端核验。

实施基线：e2b376423c47650fd62ea30e39961c88b518fcbb。计划完成时仅本任务文档新增，无相关源码漂移，未命中研究刷新触发器。根据当前goal直接执行授权进入实施；不沿用其他任务的默认确认。本批无数据库迁移或原数据写入，所有测试夹具进入隔离QA。

接通证据：Host sidebar-preferences.ts及FilesPort替换完成，旧方法引用搜索为0；Tree扩展仅通过UI Adapter。FileWorkspace拥有useDirectoryTree，stores/directory-tree.ts负责分支/分页/路径/预算/取消，DirectoryTree负责两种导航视图及中英资源；至此F341–F360均接通，尚未宣称测试通过，从此开始集中验证。FilesProvider以account为key，账号变化重挂工作区，旧控制器stop取消请求；旧Host断言拒绝写入。
