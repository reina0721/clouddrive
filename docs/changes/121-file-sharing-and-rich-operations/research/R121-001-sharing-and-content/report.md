# 分享与内容操作研究

## 问题、方法和适用边界

研究如何承接已实现的私有文件，避免用无后端入口冒充分享与目录/媒体功能。检索既有 metadata 后命中 R120-001，复用其仍有效的资源所有权、32 MiB bytes 契约和基础设施选择；公开分享触发其明确的刷新条件，仅定向复核新增边界，不重做首批全部研究。

2026-11-03，Git 为 `998f63c` 且工作区干净。实际读取 files 的 service/repo/model/HTTP/module、console 认证转发、Huma security declarations、Next rewrite/root layout、Host backend、Surface Port/页面与既有 UI Adapter。参考站登录会话仍有效，视觉观察主页、新建菜单及“我的分享”空页，没有上传、创建分享、修改配置或删除参考站内容。

## 可复核事实

- 参考站浅灰画布、窄侧栏、顶栏“新建”、独立工具栏和大面积文件画布；本地首批卡片重复展示选择标签、文件名与多个按钮，密度明显不同。新建有目录/剪贴板上传、文本/Markdown 创建；分享页有刷新、排序与空态。因参考站目录为空，不能声称验证过其具体文件菜单、分享创建及口令流程。
- 当前 files Repository.Change 仅可保存一个 Entry；树复制必须扩展原子批量入口，不能循环提交并在中途失败后假报成功。元数据保存随机不可变 ObjectKey，本批没有物理删除，复制可共享不可变内容，但配额按新目录项计费。
- 原生 files 仅会话保护；console native 转发也先验证登录。公开分享不能简单复用该转发。Huma 支持 SecurityNone/PolicyPublic，Next 同源 `/api/*` rewrite 已存在；新增公开 files operation 可走原生 API，保留其明确公共策略，不能放宽私有入口。
- IAM 已有维护中的 x/crypto Argon2id 窄适配器（64 MiB、3 次、2 路），其 Verify 返回 IAM 自有结果。files 应定义自身小契约，由 composition 转换；不得从 files 导入 IAM 内部实现，也不另造 KDF。
- 根 AuthProvider 会恢复会话，但受保护路由门禁位于 app 分组；公开分享应位于该分组之外，并由独立 Host Port 注入，不让匿名用户绕过私有文件的 owner 校验。
- 浏览器 DOM/File/Blob/URL 生命周期当前归 Host，Surface 消费文件候选 ID。媒体与目录扩展仍应服从此边界，不把 Blob URL 当永久对象地址写进数据库。

## 主源和候选判断

| 能力 | 选择与分类 | 证据和取舍 |
| --- | --- | --- |
| ZIP 打包 | 保留 Go archive/zip 标准库 | [官方](https://pkg.go.dev/archive/zip)提供 Writer/Close；无需 archiver 或解压能力。目录名必须项目侧校验，限制总字节和条目数，保留 Write/Close 错误 |
| 目录上传 | 浏览器已有文件选择能力 | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory)及[相对路径](https://developer.mozilla.org/en-US/docs/Web/API/File/webkitRelativePath)确认选择器返回相对路径；不引入 Uppy 仅包装当前有界协议，不声称空目录/断点续传已支持 |
| 媒体预览 | 浏览器 img/audio/video 原生能力 | Host 创建经鉴权下载的 Blob URL，并按[标准生命周期](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)在关闭、切换、卸载时释放；不引入转码/解码框架，实际编解码支持由浏览器决定 |
| 分享密码 | 复用既有 Argon2id，composition 适配 | 不升级依赖、不复制算法；昂贵校验要有并发准入与持续失败预算，不能依靠高熵链接替代密码保护 |
| 分享、树操作、归属 | 项目业务逻辑，合理自研 | Storage 和 IAM 不表达文件祖先、撤销、到期、目录遍历不变量。使用现有 GORM 事务和 service，而非引入另一套网盘服务 |
| 接入架构 | 保留纵向 files 与 Host/Surface，局部扩展 | 当前具备数据库事务、clock、ID、logger、storage 和公共 operation gate；无须新 Kernel、后台 goroutine 或共享万能容器。新增批量 repo 能力与独立匿名 port 具有真实用例 |

未新增或升级第三方库，本研究不声称对全部现有依赖完成新的安全审计。若未来增加流式/分片或持久作业，当前 bytes/请求生命周期不再适用，必须重新选型。

## 推断与设计约束

分享是 capability 授权，持有链接者只可读取选定根的有效子树；每次请求重新检查撤销/到期/祖先回收状态。目录外 ID、owner ID、原始 object key、密码摘要不得输出。入口采用固定 `/share` 加 fragment 承载 token，避免浏览器 referrer 携带 token；API 的 token 路径必须由既有 operation 模板脱敏，不能新增原始 URL 日志。匿名下载不建立 IAM 身份。

文本编辑必须有内容 revision 的比较并交换，不能用最后写入覆盖另一窗口的成功内容；旧对象不自动删除，避免副本引用失效。逻辑配额按当前目录项统计，不宣称等于物理磁盘占用。目录上传允许逐项结果与取消，不能把整棵目录当作原子事务；原子性只要求服务器单次树复制和内容替换。

## 门禁、局限与后续

关键承载路径、公开契约与现有能力均有源码证据，足以形成计划，研究门禁通过。参考站无文件样本、实际媒体格式及外部数据库未验收，不阻碍明确本批行为，但必须在集中验证中使用本地受控样本。外部挂载、离线下载、Office、任意大文件续传继续是完整目标中的缺口。Git 推送当前受本机身份权限阻塞，不改变远端地址或伪造交付。

## 实施定向复核

- 架构源码明确禁止组合根直接导入任何模块 adapter。因此新增 IAM 无资源公开 facet `CredentialDigests`，局部复用现有 Argon2id 并转换为 bool；组合根仅注入该公开 facet，files 不依赖 IAM。相比迁出完整凭据库，该方案保留 IAM 已有参数与解析验证，不复制 KDF、不引入共享状态或新资源。这是已规划窄契约接线的具体边界修正。
- Plugin 生成器原先固定将所有插件放进 `(app)`，公开分享若沿用会被 ProtectedGate 阻断。Host placement 对 `/share` 明确选择 `(file-shares)`，Plugin Contract 不增加认证字段；独立 file-shares 插件拥有访客 UI，Host 仅解析 fragment、注入匿名 Port 和管理请求/URL生命周期。其他插件保持原部署位置，需在集中验证中核实所有私有入口仍受保护。
- 解锁持久化窗口计数所有实际 KDF 尝试（含成功），而非只计失败，约束合法高频请求同样消耗的资源。默认每分享每分钟最多 10 次，窗口最短 1 分钟，KDF 并发最多 2。过期 grant 仅在同分享签发时清理，不删除文件或审计记录；无后台清理进程。
