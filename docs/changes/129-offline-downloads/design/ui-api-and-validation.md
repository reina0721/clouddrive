# 接口、界面与验证

私有Native路径/downloads：GET列表（active/finished、状态/名称/来源站点、20项keyset cursor）、POST创建单项、POST batch-create最多20条、GET单项、GET私有source复制；POST pause/resume/retry/restart/cancel；PUT target；POST remove移除终结记录；POST batch-control逐项处理。共13个operation，当前原生inventory为134项。控制携带Task revision，源/身份/目录/关联传输及当前权限在后端复核；不存在通过body选择owner。

独立DownloadsPort与Context由同一个HostFilesRuntime显式注入，Host复用JSON client、账号生命周期、原生导航及clipboard，Surface不碰URL安全、文件路径、网络client或定时器资源。Host提供有界list/detail/create/control/batch/source-copy契约，Zod验证限额、有限状态、单位、真实进度和任务归属字段。原Transfer协议保持tus/webdav范围，offline不混入浏览器源重选。

新增/home/downloads插件路由，沿codegen生成Host路由，不手改生成壳。侧栏和文件新建菜单增加离线入口；页面按参考分为进行中/已完成，显示空状态、自动刷新开关与刷新按钮。新建弹窗逐行URL、可选单文件名和自有目录选择；批量创建保留失败行及逐项错误。任务卡进度、状态、时间与操作可键盘访问，窄屏无溢出。详情不展示签名query，复制原始链接明确说明含来源参数。终结记录移除/批量清理需要确认，不删除保存文件；批量动作逐项呈现，失败保留选择。

不伪造来源总量、断点能力、存入成功或调度可用性；轮询不覆盖未提交输入，隐藏/卸载/账号变化取消请求和timer。completed入口只在条目当前可见时跳转到其目录。中英文文案继续lazy加载，不抬高登录同步资源预算。

实施先记录305667e增量基线、两套SQLite一致性备份，冻结已验收128前端在4180，保持8120原服务。F181–F200全部source/路由/控制接线后写implementation-ready，之后才运行功能测试。

集中验证：真实HTTP下载源、HTTPS验证器/重定向、默认拒绝内网/DNS重绑定/元数据/伪造范围/签名日志；已知/未知/空文件/超额/中途断开；暂停续传/restart/权限变化/租约失权/重启/发布后确认中断不重复；配额与暂存清理债、owner隔离、记录清理不删Entry；v10→v11合成升级/down guard且原SQL不变。浏览器完整20项及原31流程、桌面390px、真实文件字节和UI分区。Go test/vet/govulncheck、前端unit/type/lint/build/架构/依赖/生成新鲜度/性能/文档门禁，保留失败和修正证据。

结束前重启正常4173/8080/9090和用户预览4180/8120/9120，保留已有120条文件并逐条对照备份；刷新ignored访问资料、只读视觉。按Conventional Commit精确提交，实际push和403单独记；不因推送权限改变remote、此前提交或新增凭据。
