# 验证

- F821–F830 由 `TestFilesystemSettingsApplyAfterRestart` 和 `filesystem-settings.spec.ts` 验证字段、权限、非法输入、两种分页值、冲突、恢复继承及重启生效。
- F831–F840 由 `TestWorkspaceCursorBoundariesAndChanges`、HTTP 实际查询及 `discovery.spec.ts` 验证双向游标、首尾边界、历史返回、筛选、排序绑定、锚点前插入、锚点移除、恢复入口和旧页码查询。
- 后端全量测试、文件模块及 composition 的静态检查、738 项前端单测、架构检查、改动文件 ESLint 和契约生成通过。隔离浏览器四个场景通过，管理保存与窄屏另外复测。未运行全站浏览器回归。
- 主预览和隔离预览生产构建及性能预算通过。三个本地预览已重启，现有文件数据库仍为 v26。管理员设置和搜索翻页截图、访问方式保存在本地忽略目录。

本批的游标在现有有界快照内定位，不提供数据库扫描性能优化、自动滚动追加或任意页码跳转。
