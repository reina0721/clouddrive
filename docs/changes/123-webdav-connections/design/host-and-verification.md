# 界面与集中验收

R123-002定向修正：管理响应提供真实endpointOrigin和endpointPath，Host组合并验证HTTP(S)地址。Next管理JSON代理保留32MiB预算，WebDAV客户端直接连接所展示的API地址；TLS反向代理通过files.connections.publicOrigin显式指定地址，不读取任意转发头，也不承诺开发WebDAV和网页同端口。

files插件增加/home/connections子路由；复用FileLink语义导航、既有目录选择、Dialog/Action/表格/空态/消息，不直接访问fetch、Clipboard或Session。FilesConnectionsPort拥有列表、创建、CAS修改、停用/启用、撤销、轮换及复制；Host拥有请求、浏览器剪贴板和当前同源地址。一次性凭据仅当前成功对话框内存持有，关闭清除，不写localStorage、query或持久视图配置。

页面按参考站蓝色导航/灰底白面板、管理表格和客户端指南布局；窄屏使用不横向溢出的卡片/可读字段。创建显示备注、根目录、只读、点文件策略和期限；错误保留用户编辑，不能把加载失败显示为空列表。服务端代理固定为真实状态说明，不添加无行为开关。说明提供真实连接端点/用户名和各平台通用步骤；密码字段不嵌入示例URL，不输出弱化系统安全设置的命令。

全部F61–F80实现后集中测试，失败后只定向修复复测：

- Go全量/静态检查、迁移checksum、权限与身份边界、依赖安全；前端类型/lint/unit/构建、架构/foundation/生成/docs与scope/secret/diff。
- 实际SQLite+HTTP：正确/错误Basic、scope traversal/转义、两owner、readonly、阻止系统文件、过期/撤销/轮换/禁用和IAM权限变化；大于32MiB的PUT及Range SHA，短读/取消/CAS冲突不损坏现有对象，COPY/MOVE覆盖失败原子性、DELETE可从网页恢复。
- 实际服务停止/重启后连接和文件持久，不能只读DB行证明可用。
- 浏览器管理闭环和一次性密码、复制端点、目录选择、版本冲突、键盘、桌面/390px视觉；前60项回归，特别第三批刷新续传/配额与公开下载。
- 真实HTTP客户端可选采用go-webdav官方Client或已安装curl；未运行Windows/iOS实际驱动时明确不宣称已挂载。外部MySQL/PostgreSQL/S3和多机不算通过。

最新预览在开发前冻结已验收60项构建，避免源热更新把半成品展示给用户；集中通过后重启普通/独立预览最新代码，保留账号和文件并将地址/用户名/密码/令牌写ignored临时文件。任务提交前检查暂存diff退出码，新增SQL先清理格式、生成checksum再应用，避免重复上一批末尾空行提示没有阻止提交的问题。远端403继续如实记录，不停掉可推进的本地工作。
