# R137-001 文件偏好研究

## 事实与证据

基线66ffa3d281dfcd02adc032f16ada48494406a064，工作区干净；C盘约1.9GB可用，已有运行目录和两库必须保留。已检索docs的metadata并阅读R125-001报告，复用其Host/Surface边界，旧功能数量不沿用。

CUA只读进入参考站“设置→偏好”，明确显示：时区、版本保留、按目录记住视图并同步服务器、树自动展开、文件夹单击打开或选中（双击打开）。观察时参考站提示配置502，因此这些仅证明当前UI展示，不证明服务器写入语义；没有修改其设置或文件。

当前 `view-options.ts` 为严格Zod模型，包含视图、排序、方向、目录优先、缩略图、分页和列；`FilesPort.loadPreferences/savePreferences` 为同步本机契约，Host按账号使用v1 localStorage键。FilesPage只加载一次，不按目录隔离；FileItem普通名称点击直接打开。`IAM.UserPreferences` 已有时区等跨产品字段，但文件专有设置不属于IAM职责；file-only账号也不一定拥有IAM偏好权限。

files已有service消费方接口、repo数据库租约、owner事务锁、CAS冲突、Huma注册与会话/CSRF；`module.New`是明确注入位置。迁移当前v13，支持SQLite/Postgres/MySQL。新增偏好只需追加独立表，不必读取、更新或删除文件内容和既有记录。

## 分类与候选判断

这是项目特有的文件视图文档，不是通用配置中心。保留现有Go encoding/json、GORM和数据库租约、Huma、Zod以及UI Adapter；无新依赖、无新通用能力。现有navigation集合revision可作为并发语义参考，但不把文件偏好塞进pins表或IAM任意JSON键。不引入独立KV服务、第三方同步平台或客户端第二套数据库：没有离线文件复制、多主合并和后台同步需求，新增生命周期与替换成本没有可验证收益。

现有承载架构适合：在files内新增窄PreferencesRepository接口，repo实现使用现有连接与owner锁；独立Preferences用例构造注入Handler。Host持有本地模式及旧键迁移，Surface只接收typed快照和异步Port。数据库、会话与Storage生命周期保持既有owner，不启动goroutine或第二客户端。

## 推断、限制与影响

按目录配置文档可复用现有视图类型；需限制目录数量与控制体大小，CAS避免多设备无声覆盖。全量文档CAS比逐字段隐藏合并更易解释失败。默认保留本机模式，用户启用同步时才发布当前设置；服务器读失败不得回退本机冒充同步成功。旧键只有新本机文档成功落盘后才移除。

不实现本批未设计的树导航、时区渲染或版本保留策略。136并行登录500的已有trace只证明一次HTTP500，暂不假定SQLite锁为原因。其归因与偏好数据流程独立，仍是交付风险。

研究门禁通过：当前边界、消费者、持久化与迁移路径明确；剩余未知不影响本批范围。刷新仅在metadata列出的契约变化或实施证据推翻前提时触发。

## 验证增量：发布繁忙恢复

扩展回归的图片上传在已发送134字节后，`files.transfers.commit`返回429，UI保留“完成保存”；请求与trace记录在.data/137-transfer-busy.json。此事实不证明唯一原因是锁争用。实际源码中Staging.WithLock具有有界等待并可返回ErrBusy；commitAuthorized在TransferCompleted时直接返回同一会话摘要，所以重试同ID不会再次发布文件。Host transfer-runtime已有tus-js-client分块的0/1000/3000ms重试，但commit只执行一次；没有可复用的可取消等待函数。

增量结论：复用现有重试预算，在当前Host发布阶段只对busy进行有界重试；不重试权限、冲突和业务失败。取消、owner变化与epoch失效必须阻止后续请求，timer由等待函数关闭。标准Promise/AbortSignal/timer足够表达此局部流程，无新依赖或通用重试框架。该修复纳入T137-05验证收口，不修改后端接口、迁移或原文件，不声称修复136的登录500。

第二次定向复验确认13张图片全部发布，但GET内容有429，响应code为files_busy且没有Retry-After，并非入口rate_limited。原生GET内容使用transferAdmission，与上传共享受控通道；Host的媒体读取已串行，但一次busy会被MediaView误报为格式损坏且缩略图没有重试入口。当前设计不提高服务器容量：两个真实消费者（幂等commit与串行内容读取）共享files局部的有界busy恢复函数及原预算；内容读取将调用信号与runtime生命周期合并，保证等待也能随dispose取消。媒体错误按实际错误码呈现，内容版本变更清理旧状态，缩略图同样可明确重试。此增量没有新增业务边界或依赖。
