# Host传输运行时与集中验证

## 浏览器所有权

Host在认证应用框架下创建按真实owner隔离的TransferRuntime，位于Files页面上层，所有文件/分享管理页共用；离开文件目录不销毁活动上传。退出登录、切换owner或卸载应用框架时abort并等待活动操作退出，不泄漏File、密码或票据到Surface。没有源句柄的持久项显示“需要重新选择文件”。

tus-js-client仅在Host adapter内，使用服务端会话ID构造固定同源data URL（禁止任意URL），每个请求onBeforeRequest验证owner未变并注入当前CSRF；withCredentials仅同源。并行块数1，总文件并发由server budget配置2，retryDelays为0/1/3秒，仅重试网络错误、协议偏移409、锁423、准入429和5xx，不重试401/403/到期；业务控制请求不经过tus重试。所有取消、暂停、batch操作都await abort，不留下持续传输。网络失败用HEAD复核offset后重试，不重新创建session。

上传前按块迭代File，noble sha256.create().update逐块摘要，hashing有自己的进度和取消；不整体arrayBuffer。重选时全量摘要+size匹配，名称/lastModified只作导航提示，不能当同内容证明。SHA256准备与上传分阶段显示，速度/ETA来自单调时间和实际事件，重试/暂停时清零采样。相对目录解析沿用受控Host流程，最终ParentID记录后不随当前浏览目录改变。

FilesPort不再由Surface拥有queue/controller；新增TransfersPort提供snapshot/subscribe/enqueue/pause/resume/cancel/reselect/retarget/批量操作。Surface只持语义ID和数字，files插件的/home/transfers子路由展示状态筛选、目标、进度和失败操作；文件首页保留摘要和传输入口。UI复用现有ProgressMeter/Action/Dialog/Menu，蓝色导航与白色内容区；未知或加载失败不显示伪空态，不借用演示后台任务。

私有大文件原生a下载带会话，公开下载先授权短期限定对象ticket再原生链接；旧blob下载路径迁走，媒体小预览仍budget读取，>媒体预算的文件说明下载，不将本批扩大为未确认的服务器转码。

## 集中验收与文件影响

全部F41–F60实现后再启动功能测试。Go全量/静态检查，三方言migration/catalog校验，前端typecheck/lint/单测/production build，架构/foundation/codegen/docs与diff门禁；不以新20个浅层断言代替真实行为。

真实HTTP+SQLite：>32MiB完整hash、部分PATCH中断与offset、错offset409、跨owner隔离、暂停与PATCH竞态、配额并发、重复创建/commit、publishing崩溃窗口模拟、目标冲突retarget、取消/expiry/cleanup失败、实际服务重启、Range/If-Range/416、公开票据撤销/到期。读取内存有上界证据，不能仅上传一个小文件宣称大文件完成。

真实浏览器：受控生成大File，上传中暂停、导航、刷新重选、失败重试、批量操作、目标冲突改名、传输中心过滤、真实下载字节；桌面/手机截图核对参考密度、操作可达和无横向溢出。不操作参考站数据。已有前两批核心闭环回归覆盖分享、文本CAS、目录、图片及音视频资源释放。

新增/调整 frontend/apps/web/src/files的host adapter与上层layout、surfaces/src/files ports、files插件的transfers子路由、i18n/生成路由、package.json/pnpm-lock、浏览器tests及临时fixture生成脚本。Go新增成熟依赖需审查MVS变化与可达漏洞；不因引入tusd顺手升级无关依赖。集中测试失败后只定向修复/复测；通过后两个本地服务重启、访问资料继续写ignored临时文件，最后精确提交并核验push。当前403若持续，如实记录，整体goal继续。

