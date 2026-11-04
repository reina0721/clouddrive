# HTTP、Host与压缩包工作区

四个原生POST operation：`/{id}/archive/inspect`、`/{id}/archive/member`、`/{id}/archive/download`与`/{id}/archive/extract`。前三个需files:read，最后需files:write；全部保留Session、Origin/CSRF与现有传输名额。参数带expectedRevision和当前密码；inspect返回typed格式/完整有界成员/总量/实际预算；member返回单个文件字节；download把明确选择重新打包ZIP；extract返回原子回执。标准私有no-store/nosniff/安全Content-Disposition，不把密码写入URL或日志。原生150项增加4项至154，生成器与权限清单同步，不手改生成文件。

Surface `files/archives.ts`定义严格schema、ArchivePort与typed选择/策略；FilesProvider增加独立archive上下文，Host显式注入。Host archives.ts集中HTTP、blob下载与UTF-8/安全图像预览，复用既有媒体签名/预算辅助；URL由Host创建/释放，响应过期或账号变化时释放，不让Plugin持有File/Blob/DOM/Session。公开分享不注入此私有port。

Plugin私有ArchiveDialog懒加载，普通文件菜单为zip/7z提供入口；默认文件打开也可进入该应用。原图片/文本/媒体路径保持。UI复用Dialog/Drawer、Action、字段、复选框、SearchBox、ReadyImage等；不建通用文件浏览框架，不穿透Vendor。目录、搜索/排序、选择/统计、文本/图像预览、单文件/所选下载、全部/所选解压在同一明确作用域；解压目标有分页/根/上级、可选包裹目录与冲突策略。密码仅当前组件内存，关闭后释放；PasswordField使用transient目的与autocomplete=off，不冒充当前账号密码。

源版本变化显示冲突，刷新重新检查，不静默使用更新后的包。所有读取AbortController取消，预览对象由Host释放；异步写入结束的账号围栏由原FilesRuntime assertCurrent保留。成功通知共享workspace revision刷新文件列表/配额，回执可通过既有Host导航打开目标。失败保留输入与选择，未知结果不自动重试。

中英文消息作为懒加载文件域资源，不增加初始Shell负载。使用既有语义class，CSS预算不放宽。20项全部接通后集中执行真实字节、密码、目录、冲突策略、移动/深色/英文/Axe与已有文件流程；运行新生产构建和性能检查，真实预览数据不作为测试数据集。
