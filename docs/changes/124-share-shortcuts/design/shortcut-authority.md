# 引用及权限边界

实际分享地址是`/share#token=...`，不是带token的服务器路径。open采用经当前owner验证后的303 Location，片段仍不发送给分享页面服务端；原生链接在新标签打开，不销毁文件页的活动上传。普通列表不返回token。

## 文件类型与公开契约

Entry新增shortcut Kind与内部ShareToken（json隐藏）。引用没有ObjectKey、内容SHA或实际内容字节，SizeBytes=0，ContentRevision表达引用的受控修改版本。v8新增share_token默认空，旧file/folder均不变。保存引用由Navigation用例先向Sharing的模块内窄语义接口检查token格式及当前分享状态，再在文件owner事务中检查父目录、别名、重复与数量，写入真正Entry。密码分享可保存但不读取锁定根名称；调用者提供别名，不接收或持久化密码/ticket。

所有字节入口必须按Kind明确处理：ReadSmall/DownloadTo/文本替换/永久对象发布仅file；引用不作为ZIP成员或新分享根；公开分享目录和WebDAV只呈现不含target的引用元数据，打开原分享须走专用受保护的引用open操作并重新执行现有分享授权。协议内不自动展开或伪造空文件。共享页面现有密码/下载ticket生命周期保持唯一实现。

## 生命周期与CAS

普通文件树API继续承担目录/命名/回收恢复。shortcut重命名和移动要求expectedRevision，修改时递增ContentRevision；回收/恢复亦递增，使旧编辑失败。copyTree保留内部ShareToken并分配新EntryID，预检所有复制引用数量后一次保存；不写原对象、不创建跨账号可写引用。引用保存在任何有效自有目录，“与我共享”聚合当前可见引用，分页最多20。

共享状态来自Sharing当前事实：active/protected、expired、revoked、unavailable；不返回失效或锁定目标的新名称/对象信息。状态读取有界、取消向上导出。open只向当前owner返回同实例相对share路径，Host导航至原公开页面；不返回Storage键、其他ownerID或解锁票据。即使旧页面曾显示可用，实际访问仍检查撤销/到期/根状态。

永久移除是独立API，只接受已直接回收的shortcut及当前revision，在同owner事务删除引用行和对应pin；不允许file/folder、不递归清理、不调用Content.Delete、不改原分享。UI描述不可恢复的引用删除并确认，隔离测试只操作自建fixture。

## 错误与诊断

复用Missing/Conflict/Invalid/TooLarge/Quota/Busy，必要时新增拥有语义的Unsupported用于不提供引用字节。HTTP按当前Problem映射，不忽略仓储、关闭或取消错误。事件只记录保存/修改/回收/恢复/移除/pin策略及稳定phase/code，不记录token/地址/别名/原始异常。新构造全部由files模块根显式注入，不借全局容器获取Sharing。
