# Host、迁移及集中验证

新增`/home/shared`，files静态导航和真实空态按参考站语义显示；普通目录的shortcut用独立图标与“打开原分享”动作，不显示编辑/下载/分享/打包等无实现能力。复制/移动/回收/恢复沿用同一条目生命周期。公共分享页面保存入口转到受保护共享页，未登录由Auth returnTo带回；Host仅解析本实例`/share#token=...`标准地址，密码、ticket不带入URL或持久状态。

源码定向复核发现ProtectedGate原先把完整片段编码到returnTo query，会让新的保存意图进入服务端请求地址。Auth统一把返回路径/query留在returnTo，而返回片段放在登录页fragment的具名字段；AuthForm/GuestGate在实际导航时重新组合，仅保留同源安全路径。登录/注册相互切换也保留fragment，不使用浏览器持久存储或共享变量。引用打开使用当前owner鉴权后的303，Location仍是`/share#token`；Host生成私有打开端点的原生新标签链接，不在异步回调里申请弹窗，也不提前缓存授权。

Surface消费NavigationPort，不调用fetch、Clipboard、location或账号全局对象。Host复用现有JSON/CSRF和owner生命周期；账号改变时当前Provider重建并取消旧请求。共享页含目录选择、别名、实时状态/搜索/筛选/分页、明确失败及保留输入；永久移除只在回收引用的独立确认界面。pin组件显示当前名称/不可用、上移下移/取消固定；顺序变化CAS失败要求刷新，不隐藏失败。窄屏不溢出，键盘操作有标签。

文件影响：files model/service/repo、各字节/分享/DAV入口、config与v8三方言SQL/checksum、模块装配和Huma管理、原生/console契约生成、Surface/Host文件schema/图标/导航/新页面与公开分享入口。没有新依赖或Kernel生命周期。当前authority在验收后从“与我共享=账号协作”假设修正为已实现的引用语义，历史记录保留。

实施入口只做206e793之后路径与触发器比较。备份原有及preview SQLite，冻结当前已验证123生产前端，保持8120 backend及账号文件不变。全部20项实现后集中Go全量/vet、前端type/lint/unit/build/architecture/foundation/dependency/生成/docs/scope/敏感信息检查；真实SQLite+HTTP验证两owner、密码/撤销/到期/根回收、版本/名称冲突、复制数量/元数据预算、原始分享不受引用删除影响、协议字节不泄密、真实停止重启持久。

Chromium管理闭环、登录返回保存、三种pin/排序、跨窗口CAS、回收恢复与仅引用永久移除，桌面/390px视觉及前80项回归。完成后用独立Go1.26.10构建并重启普通/独立预览最新服务，记录ignored地址/账号/密码/令牌/日志并持续运行；精确暂存检查成功再Conventional Commit，实际push核验；403不冒称成功。不对原用户数据执行清空或迁移down。
