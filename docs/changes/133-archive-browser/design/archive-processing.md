# 解析与原子发布

## 契约和装配

service定义ArchiveProcessor窄接口与typed成员/内容结果，Adapter依赖它；输入是有界源字节、只在内存的密码、明确inspect/read动作和选择路径。Adapter内部持有私有版本化IPC协议，files公开工厂从os.Executable取得当前程序，在模块边界内构造解析Adapter；composition只调用公开工厂并注入Archives用例。Service本体不依赖sevenzip、os/exec或操作系统。composition.Run只对精确内部参数切入worker；cmd/app仍只提交I/O。

子进程不加载用户配置、连接库、服务端口或另一日志sink；仅标准ZIP和sevenzip解码、受控输出。Windows先创建/设置Job、Start、附加，再写stdin；子进程未收到stdin前不解码。Linux在读stdin前设置RLIMIT_DATA；其他平台拒绝此能力。每次请求有ctx、30秒默认超时和有界WaitDelay，必Wait并关闭Job/进程/管道；失败没有第二套解析路径。进程内存默认512MiB，可收紧，不允许任意提高；请求为有界单行JSON元数据加原始源字节，避免源base64副本；响应JSON按64MiB数据的base64最坏编码加有界元数据限制，stderr另限诊断字节但不返回正文。

标准archive/zip负责ZIP CRC与Store/Deflate，sevenzip v1.6.5负责7Z编码、固实块及AES；只用ReaderAt内存接口，不打开包内外部卷或任意本地路径。头部签名识别格式，不信扩展名；SFX和分卷拒绝。所有非目录/普通文件模式拒绝。压缩/展开/成员/隐式目录/深度和名称预算先校验，选中内容实际读至EOF并验证大小/CRC，关闭错误合并。

## 目录与写入

Archives消费原Service的Content与Repository、Clock/IDs/Normalizer政策，复用Detail/ReadSmall、model.Parent/Visible/Available/Used和ChangeManyBounded。成员虚拟路径必须相对、UTF-8、不含反斜线或控制字符，每段通过项目名称校验；NFC加大小写归一识别碰撞。不能把恶意路径清洗后接受。隐式目录加入清单；名称相同的文件/目录或重复文件拒绝。

选择用明确all/selected类型，选择目录包含其后代，祖先选择去重。目标plan以完整有界owner快照计算。reject同名即失败；skip允许复用目标中同名普通目录，但同名文件/目录类型冲突跳过该成员与其后代；rename为冲突的文件或目录选有界数字后缀，保留扩展名并限制名称长度，不覆盖。可选包裹目录按同一规则处理。

构建完整plan并校验文件数/配额后才写随机不可变ObjectKey。单次事务重验源expectedRevision/ObjectKey、目标及所有复用目录位置/名称/有效性、同名和总配额，然后保存全部新增目录项；竞态不自动覆盖或重试。发布前源被改写/回收、目标被移动/回收或新冲突时整次回滚。失败补偿全部候选，清理和记债各用一次总期限，不对500个对象各无限等待；保留主要错误、删除与记债错误链。

回执只来自事务结果，包含创建项目、跳过路径、改名及真实目标ID；不返回Storage路径、对象密钥或密码。重复提交没有隐式幂等保证，UI提交期间禁用再入；网络结果未知时刷新目标后由用户判断，不自动重试创建。

## 配置、错误和文件影响

新增files.archive.timeout（默认30s，允许收紧到正值）、workerMemoryBytes（默认512MiB，128–512MiB）；files配置RestartRequired。现有maxArchiveBytes/BatchEntries及树/文本/图片预算直接复用，无迁移。API JSON限制与密码1024字节上限集中命名。解析密码失败有专用稳定错误码；无效/超限/不支持、取消/超时、worker退出及补偿失败分开，stderr和第三方错误文本不进入协议/日志。Handler记录最终失败，Adapter只用phase/code诊断隔离失败，取消不记Error。

影响service/archive*、adapter/archiveprocess*（平台文件/worker）、config binding、handler、HTTP binding、module装配、composition.Run/generation、go.mod/sum、生成契约与authority。重要验证含坏CRC、路径穿越/Unicode冲突/链接、空包、ZIP炸弹、7Z密码/固实块、worker超时/内存、退出清理、源/目录/配额竞态和全部失败补偿。Linux交叉构建与实际运行必须分开记录。

实施补充：sevenzip File.Open不自动校验单个文件CRC，Adapter读取至EOF后显式核对CRC32；校验失败保留专用错误及标准ZIP校验错误链。窗口使用现有DialogSurface的cover尺寸，普通确认保持lg；选择框限制在其自身宽度内。
