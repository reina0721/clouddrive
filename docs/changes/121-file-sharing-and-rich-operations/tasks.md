# 唯一任务清单

状态：研究门禁通过，计划完成；用户目标已明确取消中途审批，进入已授权实施。第二批实现、集中验收、最新服务重启及本地提交通过；推送被 GitHub 403 拒绝，C01 未完成。

- [x] R01 增量研究；前置：120 证据与当前工作树；完成：R121-001 有代码、视觉、标准能力证据及边界，研究门禁通过。
- [x] P01 第二批需求与设计；前置：R01；完成：requirements/design 明细和 20 项验收完整，用户已授权自动实施。
- [x] I01 基线与数据保护；前置：P01；完成：记录 revision/status 增量，已有数据备份与迁移版本明确，不重置账号或数据库。证据：.data/121-baseline.json 与 .data/backups/*before-121*；基线未漂移，v3/v4 additive 迁移已在专用预览应用且 compatible、dirty=false，见 verification.md。
- [x] I02 树和内容持久化；前置：I01；完成：ChangeMany、复制、内容 revision/CAS 与 additive migration，保留原子性和错误链。
- [x] I03 分享与公共边界；前置：I02；完成：Share/Grant/失败预算、hasher composition、public/private operation隔离，日志无凭据。
- [x] F21 复制文件；前置：I02；完成：需求 F21，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F22 复制目录；前置：I02；完成：需求 F22，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F23 新建文本；前置：I02；完成：需求 F23，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F24 新建 Markdown；前置：I02；完成：需求 F24，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F25 文本编辑；前置：I02；完成：需求 F25，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F26 目录上传；前置：I02；完成：需求 F26，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F27 剪贴板上传；前置：I02；完成：需求 F27，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F28 图片预览；前置：I02；完成：需求 F28，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F29 音频预览；前置：I02；完成：需求 F29，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F30 视频预览；前置：I02；完成：需求 F30，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F31 画廊视图；前置：F28；完成：需求 F31，证据：verification.md 与浏览器/视觉日志。
- [x] F32 文件操作菜单；前置：I02；完成：需求 F32，证据：verification.md 与浏览器/视觉日志。
- [x] F33 文件快捷键；前置：F32；完成：需求 F33，证据：verification.md 与浏览器/视觉日志。
- [x] F34 打包下载；前置：I02；完成：需求 F34，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F35 创建分享；前置：I03；完成：需求 F35，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F36 分享有效期；前置：F35；完成：需求 F36，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F37 访问密码；前置：F35；完成：需求 F37，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F38 访客访问下载；前置：F35/F37；完成：需求 F38，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F39 我的分享管理；前置：F35；完成：需求 F39，证据：verification.md 的需求矩阵与实际命令日志。
- [x] F40 共享目录浏览；前置：F38；完成：需求 F40，证据：verification.md 的需求矩阵与实际命令日志。
- [x] V01 第二批集中功能验证；前置：F21–F40 实现；完成：详细设计的成功/失败/权限/持久化/资源检查及构建通过并记录，不隐瞒失败。
- [x] V02 视觉和键盘检查；前置：V01；完成：同视口参考对照、窄屏、真实媒体、菜单/快捷键、失败状态有证据。
- [x] D01 同步 authority；前置：V01/V02；完成：当前 README/scope/运行/API 只描述实际能力并列明剩余缺口。
- [ ] C01 重启与提交交付；前置：D01；完成：最新持久预览可登录，访问资料保持忽略，精确文件提交、推送且核验远端；权限失败如实保留未完成。

## 当前实施证据

统一证据见 [集中验证](verification.md)：Go 全量/真实 HTTP 与 SQLite/分享安全、369 项前端单测、7 项浏览器闭环及定向资源/视觉/输入失败复测均有实际结果。已保留原数据、应用 v3/v4 additive 迁移、同步唯一当前运行 authority；未验证外部实例、race detector 或生产部署。

C01 已完成最新重启与精确提交 `bf66da5ac1874461d5af63d20c8368e6cb725680`，`git push -u origin codex/cloud-drive` 再次返回 403：当前身份 rin721 没有 origin 写权限，远端未更新，保留未完成。剩余整体差距包括挂载、离线下载、账号共享协作、版本历史、Office 和分片续传，本批不标记整个目标完成。
