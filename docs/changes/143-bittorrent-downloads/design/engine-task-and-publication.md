# aria2节点、任务与原子发布

依据R143-001、R143-002。当前goal授权直接实施；以下是目标设计，完成状态只看tasks.md，不能当作当前运行说明。

## 边界与技术选择

保留IAM、files的Storage/配额/写锁/数据库租约、Scheduler和Host，HTTP来源保持原Adapter。BT采用独立aria2节点；service/bittorrent_ports.go定义使用方窄契约，adapter/aria2封装标准库net/http和encoding/json，只提供真实创建、检查、暂停/恢复/移除，不复制任意RPC。adapter/metainfo隔离固定安全修复版anacrolix/bencode，不导入其网络引擎。第三方类型不进入model/service，不增加Kernel全局Capability。

files binding/config拥有节点配置，composition/module显式注入；默认无节点即BT不可用。只公开节点ID/名称，端点、秘密、目录保持私有。远端RPC必须HTTPS，字面loopback可HTTP，禁止userinfo/query/fragment、重定向和环境代理；Secret只进请求体。请求5秒、响应1MiB、有限连接及头部，调用支持取消。Adapter拥有并关闭连接池，运维拥有外部daemon，产品不停止共享引擎。配置改变重建generation，不原地修改共享实例。

支持v1 btih磁力与v1种子；排除v2和无共享挂载远端代理。不接受用户RPC地址、凭据或本地路径。节点部署拥有tracker/peer/DHT/Webseed出站策略，不继承HTTP来源IP过滤，必须在当前运维authority明确此边界。

## 元数据与数据结构

元数据最多1MiB、深度32、200个真实文件，磁力最多4096字节且只有一个合法v1 btih。原始info字节计算SHA1并核对磁力hash，不能重编码后计算。验证UTF-8/NFC、Windows设备名、每段名称、大小写折叠和文件/目录前缀冲突；拒绝绝对路径、反斜线、盘符、点段、控制字符、尾点/空格、symlink。原始索引与路径保留，不能悄悄替换成不同文件。

追加v17，不改v1–v16 SQL；独立BT扩展记录保存节点、阶段、原始metadata，文件记录保存1based索引、路径、大小、选择和TransferID，job账本保存随机GID、领取token、阶段、目录身份及cleanup debt。不能给当前GORM别名record直接添加嵌套数组。BT在metadata前0个child，HTTP仍恰好1个；选择准入后才生成真实child。成功可释放原始metadata，保留公开回执。

整个torrent不超过既有512MiB预算，不能只统计所选文件，因为未选边界piece也占盘。每节点默认1个、最多2个活动逻辑任务；物理配额包含metadata、当前/旧job目录及转存双份期，不能假装RPC能硬限制磁盘。原始metadata owner累计4MiB、全局16MiB，同锁内准入。所选字节继续计入原owner/global预留；同DownloadID的N个Transfer算一个并发组，普通Transfer逐一计数，字节始终逐文件求和。不得直接放宽全局并发预算。

## 控制、恢复和生命周期

磁力先存逻辑任务，调度器领取后先存新GID/私有目录绑定，再发metadata-only/save-metadata RPC。完成并匹配hash才进入待选择，不提前启动payload。种子有界解析后待选择。用户选择以任务Revision CAS并同事务预留全部所选Transfer和目标，空选择拒绝。轮询进度不推进用户Revision。

每次领取和新阶段必须使用新随机16hex GID及目录，禁止跨lease复用GID。旧RPC只能影响旧目录，发布仍验证当前lease；操作前getOption核对目录绑定。恢复部分数据先停止旧job，复制到新领取目录并重新校验piece；旧目录未清理继续占预算。服务重启恢复持久意图，不把daemon session当成发布授权。失联不能发布，清理失败保留账本，不静默删除。

暂停/取消先存意图，再取消当前调用并按账本控制node。调度调用拥有context与等待，不新建常驻worker。Host退出取消并等待后关闭连接池。保留既有20次尝试预算，显式恢复才重置。元数据、网络/超时、节点、权限/写锁、配额、存储及清理保留稳定错误类型，取消原因可识别。日志仅使用owner/phase/task_id/error_code，不写源URI、RPC原文、文件内容、路径或秘密；决定失败策略的service边界负责记录。

## 内容校验和发布事务

引擎完成不等于转存完成。用os.Root打开受控job根，仅按可信metadata相对路径读取regular文件，核对索引/大小/完成量，不允许symlink逃逸。一次一个文件复制至既有tusd候选，seal/hash并由Storage写不可变对象。节点路径不作ObjectKey，不向浏览器开放。

所有候选准备好后，一次owner/storage事务重新验证IAM、lease、用户意图、目标、祖先可见性、配额/历史和写锁；目录、文件、全部所选Transfer及Task终态原子提交。默认冲突失败，不逐child发布后冒充整体成功。失败只补偿本次新对象，清理错误与主错误都保留并登记debt。成功清理node目录、保留最终条目ID，删任务不删已发布文件。

## 文件影响与实施顺序

I143-00先落实service/bittorrent_ports.go、adapter/aria2和adapter/metainfo；I143-01随后修改model/download、service/download_*、repo/downloads/transfers及新增BT record/transaction、binding/config/migration/v17、module.go、internal/composition/files.go、handler及binding/http。新增能力、种子和选择接口，schema走现有生成入口。I143-02接通前端离线运行域、新建/文件选择视图和双语状态；延迟加载并复用现有CSS，不放宽预算、不增加空菜单。

20项F441–F460全部接通后集中验证：受影响Go与协议失败用例，真实seeder字节、两个真实IAM账号同hash、暂停/重启/旧worker围栏，v16到v17原数据保留，前端类型/单元/生产构建/性能及浏览器视觉。迁移前一致性备份，不重置数据库；构建成功才切换归属明确的主/开发/QA进程，不覆盖正在运行的目录。访问资料只在ignored临时文件。未实现或未测试不可勾选。
