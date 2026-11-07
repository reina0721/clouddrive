# aria2节点、任务与原子发布

依据R143-001、R143-002。当前goal授权直接实施；以下是目标设计，完成状态只看tasks.md，不能当作当前运行说明。

## 边界与技术选择

保留IAM、files的Storage/配额/写锁/数据库租约、Scheduler和Host，HTTP来源保持原Adapter。BT采用独立aria2节点；service/bittorrent_ports.go定义使用方窄契约，adapter/aria2封装标准库net/http和encoding/json，只提供真实创建、检查、暂停/恢复/移除，不复制任意RPC。adapter/metainfo隔离固定安全修复版anacrolix/bencode，不导入其网络引擎。第三方类型不进入model/service，不增加Kernel全局Capability。

files binding/config拥有节点配置，composition/module显式注入；默认无节点即BT不可用。只公开节点ID/名称，端点、秘密、目录保持私有。远端RPC必须HTTPS，字面loopback可HTTP，禁止userinfo/query/fragment、重定向和环境代理；Secret只进请求体。请求5秒、响应1MiB、有限连接及头部，调用支持取消。Adapter拥有并关闭连接池，运维拥有外部daemon，产品不停止共享引擎。配置改变重建generation，不原地修改共享实例。

实施定向证据补充：`pkg/secrets.RedactMap`原实现仅遍历嵌套map，节点列表会绕过secret键脱敏。I143-00必须同步修复其对配置列表的递归处理，保留输入和nil/空列表语义；这是新节点配置所必需的现有能力修复，不新增通用脱敏框架。相应用例纳入20项接通后的集中测试，配置默认不包含任何实际节点或秘密。

支持v1 btih磁力与v1种子；排除v2和无共享挂载远端代理。不接受用户RPC地址、凭据或本地路径。节点部署拥有tracker/peer/DHT/Webseed出站策略，不继承HTTP来源IP过滤，必须在当前运维authority明确此边界。

## 元数据与数据结构

元数据最多1MiB、深度32、200个真实文件，磁力最多4096字节且只有一个合法v1 btih。原始info字节计算SHA1并核对磁力hash，不能重编码后计算。验证UTF-8/NFC、Windows设备名、每段名称、大小写折叠和文件/目录前缀冲突；拒绝绝对路径、反斜线、盘符、点段、控制字符、尾点/空格、symlink。原始索引与路径保留，不能悄悄替换成不同文件。

追加v17，不改v1–v16 SQL；独立BT扩展记录保存节点、阶段、原始metadata，文件记录保存1based索引、路径、大小、选择和TransferID，目录记录保存选择时分配的稳定目录/父级ID，job账本保存随机GID、领取token、阶段、目录身份及cleanup debt。不能给当前GORM别名record直接添加嵌套数组。BT在metadata前0个child，HTTP仍恰好1个；选择准入后才生成真实child。成功可释放原始metadata，保留公开回执。

整个torrent不超过既有512MiB预算，不能只统计所选文件，因为未选边界piece也占盘。每节点默认1个、最多2个活动逻辑任务，默认节点预留预算2GiB；每个payload job另预留2MiB用于保存的种子和控制文件，为恢复时旧/新目录双份留出预算。物理配额包含metadata、当前/旧job目录及转存双份期，不能假装RPC能硬限制磁盘。原始metadata连同保留清单的owner累计4MiB、全局16MiB，同锁内准入；清单预算使用固定私有DTO，不能因业务类型增字段意外改变持久计量。所选字节继续计入原owner/global预留；同DownloadID的N个Transfer算一个并发组，普通Transfer逐一计数，字节始终逐文件求和。元数据阶段无child的BT任务也保留一个名额，不得直接放宽全局并发预算。

## 控制、恢复和生命周期

磁力先存逻辑任务，调度器领取后先存新GID/私有目录绑定，再发metadata-only/save-metadata RPC。完成并匹配hash才进入待选择，不提前启动payload。种子有界解析后待选择。用户选择以任务Revision CAS并同事务预留全部所选Transfer和目标，空选择拒绝。轮询进度不推进用户Revision。

每次领取和新阶段必须使用新随机16hex GID及目录，禁止跨lease复用GID。旧RPC只能影响旧目录，发布仍验证当前lease；活动控制前以getOption核对目录绑定，进度及终结结果以tellStatus同时核对GID和dir。恢复部分数据先停止旧job，复制到新领取目录并重新校验piece；旧目录未清理继续占预算。服务重启恢复持久意图，不把daemon session当成发布授权。失联不能发布，清理失败保留账本，不静默删除。

位置身份同时覆盖节点ID、端点和共享挂载，显示名称和Secret轮换不改变位置身份。有未清理job时，移除节点或换端点/换根必须在候选准入拒绝，保留原位置所有者。每个逻辑任务账本最多40个job，显式恢复也不能产生无界记录。节点明确返回固定版本的精确GID缺失消息才分类为missing，认证/网络失败不能假装已清理；未知Add回执不得仅凭暂时missing释放预算。

job先持久化预留，再复制部分数据；仅在当前lease下将Submitted推进为true之后才允许发Add RPC，随后保存Accepted回执。新领取者看到Submitted=false时，旧领取者已无法再通过提交围栏，可以回收未提交候选；Submitted=true但未见Accepted且node暂时missing时，必须保留不确定账本和容量，不能把“尚未提交”和“已提交但回执丢失”混在一起。

原提交者允许按原claim/GID的窄CAS记录迟到Accepted或确定未发送的观察，不能借此续租或发布。确定未发送使用HTTP写header观察，不凭网络错误猜测；Stopped且未Accepted可表示已经证明不会提交，不能再推进Accepted。Add前先准备私有目录，开启rpc-save-upload-metadata，保存上传种子供会话恢复；Probe要求绝对save-session、deferred-input=false与TLS证书校验。运维须用同一session文件配置input-file。暂停保留的是停止、移除并saveSession后的文件缓存，恢复以新GID复制并重新校验，避免旧句柄被晚到unpause或重启重新激活。

同一节点同时只运行一个相同infohash的逻辑任务，其他hash仍遵循节点并发数。依据固定aria2源码BtRegistry按hash查找首个下载上下文的事实，串行化是本项目为避免入站peer上下文歧义采取的策略，不宣称官方禁止创建同hash GID。任何账号仍拥有独立任务、选择、GID和路径，不能共享对方进度或操作权限。

暂停/取消先存意图，再取消当前调用并按账本控制node。调度调用拥有context与等待，不新建常驻worker。Host退出取消并等待后关闭连接池。保留既有20次尝试预算，显式恢复才重置。元数据、网络/超时、节点、权限/写锁、配额、存储及清理保留稳定错误类型，取消原因可识别。日志仅使用owner/phase/task_id/error_code，不写源URI、RPC原文、文件内容、路径或秘密；决定失败策略的service边界负责记录。

真实peer元数据获取超过通用Execution的两秒预算。BT调度使用现有命名策略入口和固定`persistent-task`策略：托管执行仍负责本次去重与生命周期，单次调用的尝试、时限和收尾由BT服务负责。通用默认策略及HTTP下载调度保持原有装配；不得把父context超时当成正常关停无限重排。

## 内容校验和发布事务

引擎完成不等于转存完成。用os.Root打开受控job根，仅按可信metadata相对路径读取regular文件，核对索引/大小/完成量，不允许symlink逃逸。一次一个文件复制至既有tusd候选，seal/hash并由Storage写不可变对象。节点路径不作ObjectKey，不向浏览器开放。

真实aria2终结结果可能缺少活动bitfield，逐文件完成量归零而任务已完成。完成判定要求校验终态、任务hash、选中文件清单和已完成总量一致；再逐一核对实际文件路径与长度并计算发布摘要。活动进度继续直接使用节点实际逐文件计量，不从声明大小推算进度。

所有候选准备好后，一次owner/storage事务重新验证IAM、lease、用户意图、目标、祖先可见性、配额/历史和写锁；目录、文件、全部所选Transfer及Task终态原子提交。默认冲突失败，不逐child发布后冒充整体成功。失败清理只覆盖该任务未发布候选，清理错误与主错误都保留并登记debt。成功清理node目录、保留最终条目ID，删任务不删已发布文件。

转存阶段按TransferID排序后持有整批候选锁，覆盖写对象、最终事务及失败补偿；最多200个锁句柄/批、两批最多400个，内容文件reader仍一次一个。旧worker与下一领取者使用相同顺序串行进入这一段，避免补偿删除另一领取者刚发布的相同ObjectKey。提交尝试前的失败可在持锁状态补偿该任务未发布候选，清理失败保留标记及容量；提交尝试后结果不确定时，不推定回滚或删除对象，保留受持久Transfer拥有的候选，交由重试/取消和终态核对协调。失败/暂停仍预留其容量，过期必须清理，不能泄漏无归属对象。

## 文件影响与实施顺序

I143-00先落实service/bittorrent_ports.go、adapter/aria2和adapter/metainfo；I143-01随后修改model/download、service/download_*、repo/downloads/transfers及新增BT record/transaction、binding/config/migration/v17、module.go、internal/composition/files.go、handler及binding/http。新增能力、种子和选择接口，schema走现有生成入口。I143-02接通前端离线运行域、新建/文件选择视图和双语状态；延迟加载并复用现有CSS，不放宽预算、不增加空菜单。

20项F441–F460全部接通后集中验证：受影响Go与协议失败用例，真实seeder字节、两个真实IAM账号同hash、暂停/重启/旧worker围栏，v16到v17原数据保留，前端类型/单元/生产构建/性能及浏览器视觉。迁移前一致性备份，不重置数据库；构建成功才切换归属明确的主/开发/QA进程，不覆盖正在运行的目录。访问资料只在ignored临时文件。未实现或未测试不可勾选。
