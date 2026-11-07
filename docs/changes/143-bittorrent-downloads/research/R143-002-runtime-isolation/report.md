# 受控下载器运行证据

## 问题、范围与快照

延续R143-001，只补充影响选型的真实运行缺口，不重新研究HTTP和文件发布。产品基线80cd04e，工作区干净。以下均为隔离的依赖探测，不是20项产品验收；既有三个产品预览及其数据库没有切换。脚本、受控种子、凭据和原始回执仅保存在ignored `.data/143-*`、`.tools/143-*`。两个研究daemon均已正常关闭，按PID及启动时间核对，不停止产品进程。

## 可复核事实

随本研究保存的去敏回执：[真实peer字节](evidence/peer.json)、[证书校验](evidence/tls.json)、[重启隔离](evidence/restart.json)。它们是当时实际调用的结果记录，不是重新运行产品验收；原始脚本及包含本机路径的完整回执保留在ignored目录。

Transmission 4.1.4官方MSI的SHA256与官方资产摘要相符。行政解包调用被自动审批拒绝后没有重试安装，改用7zip只读解档。旧7za提取出现Data Errors，输出目录已标记无效，没有执行；使用官方7zip26.05成功解档后才运行。真实RPC协议6.0.1、已知元数据选择、重复hash去重和重启行为均获得回执。重复hash返回同一个原任务及原目录，不适合作为两账号的独立逻辑任务。磁力元数据前提交files_unwanted未保持为最终选择；每任务下载限速0又阻止元数据完成。因此不能用暂停轮询的时序假设承诺“配额准入前没有payload”。此结论仅针对本方案的使用约束，不表示Transmission不能进行正常BT下载。

aria2 1.37.0的metadata-only/save-metadata官方机制在真实peer交换中生效：Transmission作为真实seeder，aria2正常经受控tracker连接，没有Webseed；205字节元数据文件生成前后没有payload目录。读取元数据后，新建显式GID任务选择第1个文件，所选34字节与seeder逐字节相同，SHA256为`38b3796eb2561c9933632fcefeb367f5cdc642f95389cc29a5f8679b1be83e53`，第2个文件保持未选。回执`.data/143-aria2-peer-receipt.json`、脚本`.data/143-probe-aria2-peer.mjs`。

两个同hash引擎任务使用不同GID、目录及相反选择，均可暂停。saveSession与正常重启后，engine session变化，两个GID、目录、选择及暂停状态恢复；见isolation/restart回执。这证明引擎隔离能力，尚未证明产品IAM两个账号隔离。暂停后重新连接、产品租约以及候选发布仍须集成验证。

官方旧Windows发行二进制的依赖较旧，没有作为默认交付运行时。改从MSYS2官方ucrt64数据库解析15个包，以TLS下载并逐一核对官方数据库SHA256后提取；aria2为1.37.0-8，实际加载的OpenSSL DLL为3.6.5（用相同包openssl工具和运行模块路径核对，不能把aria2编译时版本字串当成实际DLL版本）。provider路径显式传入子进程，仅导出现有Windows公共根证书给该隔离profile；未新增系统根、未关闭证书校验。自签名测试被拒绝且HTTP处理器未收到请求，可信公开HTTPS成功，见tls回执。未完成PGP签名审计，不将SHA校验描述为完整供应链审计；这些探测不证明peer网络有HTTP来源过滤。

固定anacrolix提交的bencode包提供可配置字符串和嵌套深度上限，Go模块要求1.25，适配当前1.26.10。只使用有界解码器，不导入其tracker/client/peer引擎；v1.61.0不作为选择，相关安全修复见R143-001。实际依赖可达图须在添加后核验。

实施入口已解析实际包可达图：新引入的第三方可达包仅为bencode、missinggo/expect、missinggo/v2及xstrings，没有anacrolix的peer/tracker/client。Go模块图同时将既有multierr从1.10.0提升至1.11.0，已取得校验和；依赖图枚举不是编译或产品测试。完整模块的声明图会带入更多go.mod校验和，不表示这些包进入运行二进制。记录`.data/143-decoder-reachable-packages.txt`；最终构建仍待本批接通后集中执行。

固定模块LICENSE复核为MPL-2.0，延续R143-001记录；没有修改第三方覆盖源码。对上述实际可达辅助包的生产源文件定向检查，未发现init函数、后台goroutine创建或默认HTTP/日志替换；不把这个检查扩大为完整第三方安全审计。实施还发现当前`pkg/secrets.RedactMap`只遍历map，不能保护节点列表内secret字段；详细设计已将必要的列表递归修复纳入本批，测试在20项接通后运行。

## 分类、比较和决策

BT网络与块下载属于成熟第三方通用能力；不自研协议、tracker或块存储。采用外部aria2，GPL-2.0-or-later下载器独立进程运行，不把其源码静态链接入Go服务；运行二进制和发行再分发义务另按实际打包处理，本仓库不提交该可执行文件。MSYS2是本机研究与预览可用的维护中发行包，生产节点由运维配置和维护。JSON-RPC传输属于标准库net/http、encoding/json的局部Adapter；业务只见使用方定义的任务、状态与错误，不复制完整RPC API。

保留：IAM授权、files内容/配额/写锁、数据库事务、Scheduler和Host生命周期。替换：仅本任务未落地的“优先尝试Transmission”候选方向，由aria2承担BT，不替换现有HTTP下载器。升级：增加固定安全修复版bencode包，不引入完整anacrolix引擎。合理自研：项目特有的GID绑定、租约围栏、所选文件准入及原子发布；不自研RPC框架。架构调整：HTTP单child契约按来源分支扩展为真实多文件任务，保留HTTP基数断言；不增加Kernel全局Capability或第二套数据库/存储客户端。

功能、版本、安全、许可证、生态和替换成本：aria2具备元数据、选择、真实进度、暂停、校验和会话保存；官方稳定版1.37.0及MSYS2维护包可复核，Cloudreve采用该节点模型作为真实生产用例证据，不能据此宣称本项目已达到其质量。替换边界为窄引擎端口，私有GID不进入产品API；退出时只替换Adapter与节点准入，不改发布规则。Rain公开存储/日志/选择接入不足、嵌入anacrolix网络TLS问题、Transmission元数据准入问题均已有具体证据，不继续叠加兼容层。

## 运行与安全边界、局限

节点为管理员配置的受信下载器和共享本地挂载；不接受用户RPC地址、凭据或本地路径。RPC远端必须HTTPS，只有显式loopback地址可HTTP；拒绝重定向、用户信息及查询，禁用环境代理。节点内部tracker/peer/DHT/Webseed出站策略由该节点部署负责，**不继承**HTTP下载来源的DNS/IP过滤。默认不配置BT节点时禁用此能力，不增加无实际保障的“安全网络”勾选项。

files拥有配置、错误语义、调度及目录预算；Adapter拥有HTTP连接池并在Host退出关闭，外部引擎进程由运维拥有，产品不能停止共享daemon。配置改变按Configured generation重建实例，不原地改共享Client。每次领取使用独立GID和目录，DB持久绑定先于RPC；旧worker只可能作用于其旧目录，发布仍须验证lease。产品测试必须覆盖清理失败、会话丢失及旧RPC，不以当前引擎回执代替。

研究门禁通过：已有证据足以设计和实施受控共享目录节点。未覆盖BitTorrent v2、无共享目录远端代理、恶意或被接管下载节点；均明确排除。原生包清单与TLS探测不是全面漏洞扫描，后续安全公告或协议/挂载变化触发定向刷新。产品20项集成、配额、事务和UI仍未实现或验收，不增加功能累计。
