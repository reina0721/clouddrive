# 研究结论与证据

## 问题、方法和范围

从README、范围authority、已有research元数据和24eab80干净工作区出发，追踪files服务/仓储/传输、Kernel Storage回调、IAM公开facet与HTTP实际路由。外部复核官方tag源码、Go模块代理、Go漏洞索引及RFC；不以框架文档当成项目已实现事实。

## 项目事实

- files拥有目录、大小写/NFC名称、归属、回收、配额和内容版本；Content.WithReader限制reader在同步回调内，不能为了适配WebDAV把reader带出租约。Transfers拥有真实持久暂存、预留、checksum和发布，但仅接受已知长度/完整摘要并且只创建新条目，不能直接支持普通PUT或安全覆盖。
- composition/generation.go显式构造files；http_budgets.go只从Huma标准operation提取精确预算。Chi不接受未注册的扩展method；OpenAPI标准PathItem也不能表达PROPFIND/COPY/MOVE。把这些方法硬塞Huma或者调用chi全局RegisterMethod不符合当前边界。
- IAM现有CredentialDigests服务密码；ApiToken能调用普通API，不适合作为限定目录的WebDAV密码，否则同一secret可能绕过根目录使用Bearer访问全部files。账号可用性和即时权限需要使用方驱动的IAM窄facet，不可读取IAM私有repo。
- 本机现有普通4173/8080、预览4180/8120持续运行。新的连接凭据必须不同于IAM密码，不重置用户账号或复制既有凭据到源码。

## 参考站只读视觉

2026-11-03在Cloudreve/connect看到“连接与挂载”、WebDAV账号管理及iOS/iPadOS、Windows标签；表列备注、相对根、权限、反向代理、创建时间和操作。打开并取消创建对话框，实际选项包括备注、根目录、只读、阻止点开头系统文件、反向代理。未提交、未创建外部凭据、未上传或修改参考文件。样本的实际协议/客户端成功不在本研究证据内。

推断：本项目内容总经自身Storage下载，没有对象直链分支，因此“反向代理”固定成立，复制一个无效开关没有产品价值。应展示真实代理状态，并提供独立连接管理和标准客户端参数；不能把教程标签视为已验证操作系统挂载。

## 分类与成熟候选比较

| 候选 | 维护/API/许可证 | 实际适配与判断 |
| --- | --- | --- |
| 标准net/http | Go1.26.6，稳定标准库 | 复用Basic、请求取消、Range/条件内容，标准库无完整DAV；不自写XML协议引擎。 |
| golang.org/x/net/webdav v0.62.0 | Go官方扩展/BSD-3-Clause，2026-10-27发行，759个已知importer；pre-v1。源码明确不负责恶意客户端资源耗尽等加固 | 通用协议成熟，完整fs.File接口却要求跨调用读写句柄；默认COPY递归复制和先删目标，难直接保留本项目不可变对象复用/原子覆盖，GET关闭错误也不导出。继续适配会增加无价值临时文件和生命周期桥，因此不选为DAV承载。 |
| emersion/go-webdav v0.7.0 | MIT，Go>=1.13；代理确认2025-10-18，最近源码commit2026-06-28；pre-v1，非无限API稳定承诺 | 同步Create(body)、Copy/Move业务回调直接表达流式发布与原子元数据操作；不需要复制整个框架。选择明确tag并通过项目窄adapter。锁、完整dead properties以及某些扩展未实现，不能宣称全RFC兼容；边界显式拒绝不支持方法。 |
| hacdias/webdav v5 | MIT；维护中，当前Go1.26；使用x/net并包含配置、账号和OS目录服务 | 已有独立服务器产品，不适合嵌入为第二套身份、配置或目录；仅作为生产采用与候选比较证据。 |
| drakkan/webdav / SFTPGo | fork最新伪版本2026-10-14，SFTPGo实际采用；SFTPGo本体AGPL-3.0 | 改进的文件句柄服务器仍不匹配回调租约；不把整个SFTPGo引入当前项目。未选候选不伪称完成其完整安全审计。 |

所选库的风险边界是有界body/目录遍历、错误正文脱敏、独立凭据、已鉴权请求及项目业务事务。GET通过外层DownloadTo回调覆盖完整DAV调用，借用reader的Close不拥有底层资源，真实关闭由外层导出；Create同步读取并在同一次用例完成。这样承载重构可删除多余句柄桥，收益可通过大文件、取消和错误用例验证。

## 安全和版本复核

官方模块代理确认x/net最新v0.62.0、emersion v0.7.0；emersion公开安全页本次429，明确不可核验，不能写成无公告。官方Go漏洞模块索引未列emersion/drakkan，并非无漏洞保证。当前x/net v0.58.0的模块索引包含后续修复；实际读取GO-2026-6860（HTML合并复杂度）及GO-2026-6866（HTML渲染命名空间）均在0.62.0修复。go list -deps ./cmd/app实际含x/net/html、charset和http2，所以本批计划升级到0.62.0，不保留已知未修复版本作为新增协议的承载基线；实际可达性仍由集中安全检查说明。升级要求x/crypto0.58、sys0.49、term0.47、text0.43，兼容现有Go1.26.6。尚未运行本批功能测试或漏洞调用链扫描。

官方定位：[emersion后端](https://raw.githubusercontent.com/emersion/go-webdav/v0.7.0/server.go)、[模块要求](https://raw.githubusercontent.com/emersion/go-webdav/v0.7.0/go.mod)、[x/net版本要求](https://raw.githubusercontent.com/golang/net/v0.62.0/go.mod)、[漏洞索引](https://vuln.go.dev/index/modules.json)、[RFC4918](https://www.rfc-editor.org/rfc/rfc4918)、[hacdias实际承载](https://raw.githubusercontent.com/hacdias/webdav/main/lib/handler.go)。以上是证据导航，非协议文档的全文复制。

## 架构结论、复用与退出

保留files业务owner、IAM/RBAC、GORM/迁移、流式Storage和现有持久暂存。新增DAV仅为files应用内窄adapter与独立协议binding，不新增泛用Kernel capability、常驻worker、共享可变全局对象或第二套存储。重构现有传输核心：服务端摘要源类型与原生tus源类型明确区分，共享容量、暂存、cleanup和发布；增加期望条目/版本以CAS覆盖，不新增一套无预留的大文件上传。新来源不可被原生续传端点误用；Native原有20项行为必须回归。

协议路由采用net/http层的显式files协议声明/绑定，在共同HTTP预算、日志和过载边界内分派；管理JSON仍由Huma唯一生成，不伪造DAV的OpenAPI方法。连接管理使用现有IAM会话/CSRF；协议单独Basic凭据认证并每次复核账号和当前files权限/连接状态/根目录。取消、失败和最终提交继续导出原始链，日志不写密码、Authorization、文件名和完整URL。

根目录限制、点文件策略、操作语义和配额为项目特有规则，合理自研，维护归files；不自写协议解析、哈希算法或密码KDF。退出条件是库维护/安全不满足或必须支持其缺失扩展，替换adapter而不迁移业务条目与永久对象。DAV锁、任意dead properties、多机暂存和OS驱动兼容性不在这20项的验收承诺，但仍不能被当作整体Cloudreve对齐已完成。

研究门禁通过：关键接入路径、成熟候选、承载不适配原因和改进路径有源码证据；剩余外部部署/操作系统未知不妨碍形成限定的可验收计划。下一阶段只做实施基线增量检查，不重做全仓研究。
