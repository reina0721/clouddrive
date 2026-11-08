# R170-001 网页式文件应用

参考站管理页的“添加应用”有网页和 WOPI 两类。网页表单含图标、名称、扩展名、URL 模板、大小、平台及另开窗口。变量对话框说明临时文件地址、文件名、身份及主题字段。参考站只查看表单，退出时未保存。官方文档分别描述[网页式应用](https://docs.cloudreve.org/zh/usage/file-apps)和[WOPI](https://docs.cloudreve.org/zh/usage/wopi)。

基线 `06a8bc9` 的 `internal/module/files/repo/file_applications.go` 已能保存带并发修订的 JSON，`frontend/surfaces/plugins/files/src/files-page.tsx` 已有按后缀及平台分派的文件打开入口，`internal/module/files/service/download.go` 已提供原始内容租约。现有直链持续追踪当前内容，不适合作为临时授权。

保留现有应用策略与传输设施。已有分享下载凭据绑定分享记录和访客身份，不能由第三方阅读器匿名消费本人私有文件。URL 解析和编码采用标准库及 Web URL API，临时凭据采用 Go 标准库 AES-GCM 密封文件和版本约束。相比持久直链或新增授权表，短期加密凭据可保护私有 ID、限定读权限及重启失效，无需新增依赖、迁移或后台清理。WOPI 专用发现、编辑回写及锁定另有契约。此次证据只覆盖实际观察的网页式管理和读取路径。
