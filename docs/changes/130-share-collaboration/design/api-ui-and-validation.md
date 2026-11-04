# 接口、界面、迁移与验证

私有files/shares沿现有Huma：创建增加title/permissions，GET列表增加query/状态/排序/分页，GET单项、PUT配置（revision/password operation）、PUT state（revision/enabled），revoke仍保留其当前入口并同步revision。FilesPort的分享调用方统一迁移到类型化ShareListing/更新契约，不保留旧数组分支。新增API最终数量以生成inventory为准，不预填成功。

公开file-shares/{token}增加范围内有界query目录、text读取、folder/text创建、text CAS、item更新、copy、trash、batch、archive与transfer create/read/data/commit/cancel。所有公开路径受原public声明、Origin和分享权限检查；原始内容允许download，只有preview时限制安全类型和预算；Host预览始终有界，原生download票据遵守download，票据版本与最终范围复核保持一致。访客媒体通过Host有界Blob预览，HTML/scripts仅文字，不执行远端内容；关闭/变更链接释放资源。

Surface修改files的share-dialog/shares-page及file-shares页面，复用Page/PageHeader/Toolbar/Section/StateSurface、UIAdapter字段/对话框/抽屉/进度，不改公共Token或复制基础组件。增加明确权限说明/预设、设置编辑、密码keep/set/remove、暂停/恢复确认与访客预览入口。访客显示实际允许操作；只有上传权限时不加载目录枚举。创建、编辑、移动/复制目录选择和批量失败保留输入/选择；根操作禁用有说明。中英资源lazy加载，DOM/File/network/timer/URL仅Host。

新增files v12，三方言迁移包含Share策略、ShareGrant revision和Transfer share绑定。已有分享显式迁移只读且启用；原始v1–v11 SQL与用户文件不修改。down guard在有新配置/分享来源或非默认策略时拒绝丢失能力，只在合成SQLite夹具验证down，不在用户库操作。MySQL/PostgreSQL/S3无真实外部服务时明确未验证。

影响：files model/service/repo/binding/config/http/migration/handler/module、composition公开IAM投影、OpenAPI/operation inventory与前端生成；Host public-backend/FilesPort/页面与i18n；当前文件说明/scope/runtime/api同步。不得通过common、万能权限容器或隐式全局变量连线，不改其他业务模块内部实现。

验证顺序：先两套SQLite一致性备份、冻结129已验收前端与现有后端；20项源/路由/行为全接线后写130-implementation-ready，再集中测试。真实双访客上传/文本CAS/历史、readonly/upload-only限制、跨根ID/移动/复制/根回收/ZIP拒绝，上传中暂停/撤销/改密码或IAM停用不得发布，临时候选/清理失败债；合成v11→v12保留旧链接只读及guard。Go全仓/vet/受影响race/govulncheck、前端640+units/type/lint/build/架构/依赖/生成/性能/文档、原35流程加本批浏览器，桌面/390px/Dark英文/键盘/Axe及浮层视觉。

交付重启普通4173/8080/9090和用户预览4180/8120/9120并保持运行，逐条核对原120Entry；访问资料仅ignored临时文件。精确Conventional Commit、实际push并记录真实结果，不沿用历史403推断。
