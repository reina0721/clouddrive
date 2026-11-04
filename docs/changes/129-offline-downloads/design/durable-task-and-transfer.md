# 持久任务与文件发布

## 所有权与模型

DownloadTask归files，保存owner、源种类HTTP、私有原始/最终URI、验证器、声明长度、实际进度、目标目录/可选名称、状态、控制意图、稳定错误码、尝试次数、租约token/期限、时间、幂等键与CAS版本。HTTP当前一个子文件，但任务和Transfer通过downloadID关联，不假定完整离线任务等于一个文件。不开启未实现的magnet/driver分支。

Transfer增加SourceOffline和downloadID，仍唯一拥有内容对象key、SizeBytes容量预留、最终摘要、条目ID、发布与清理债。新任务的子Transfer为preparing/未知长度/零字节预留；账号与全局数量立即占用，收到合法来源头后在同一owner事务中分配长度或剩余容量。不能先下载到无限临时文件再检查配额。已知长度精确分配，未知长度至多当前可用容量和512MiB，最终seal才缩减预留。

DownloadRepository消费方契约包含Create/List/Read/Change/Claim/Delete等明确任务操作。实现复用Transfers相同Access、storage/staging检查与owner锁；创建Task+初始Transfer同一事务。Transfer事务读取关联任务作为publication grant，源URL不进入普通TransferSummary。既有两个来源API维持其范围，离线子项不进入浏览器tus列表/控制，不可通过原路径绕过任务意图。

## 状态、围栏与恢复

Task状态：queued/fetching/pausing/paused/publishing/completed/failed/canceled/expired；控制意图独立为run/pause/cancel。领取生成新token并递增尝试；Revision只在用户控制或目标改变时推进，后台领取/进度/阶段变化不制造无意义CAS冲突，默认租约20s、5s心跳，心跳和主执行共享可取消上下文且退出时等待。旧token、超期或非run意图不能进入最终目录项事务。

默认每次只处理一个任务，沿Scheduler有界并发；源网络总超时15min，单次服务期限不越过任务24h到期。进程正常关停保留可继续状态；异常退出后租约过期可接管。最多20次自动领取，下载与清理共用该预算；耗尽后保留稳定失败或已发布事实和清理债，不无限重试。显式移除、取消的维护领取不消耗自动预算，仍可清理；从头下载重新建立尝试预算。

下载先追加到同一tusd候选，完整EOF和来源校验后关闭body，seal并计算摘要，再进入已有Transfer内容发布。最终事务再次复核目录/名称/容量/租约/意图和当前IAM授权。发布与任务完成确认分两步：Transfer已完成但Task未确认时，下一次对账只确认已有条目，绝不再次请求来源或建第二文件。清理失败保持已发布事实并显式保留cleanupPending。

暂停先持久化意图并取消本代句柄，跨代/跨进程由心跳和围栏兜底；不在DB事务内等待文件锁或网络。暂存锁→DB owner的顺序与原传输一致。取消/移除先完成候选清理再释放容量；失败保留清理债，不能删除记录掩盖残留。移除在同一维护租约内删除Task及关联Transfer，不存在先释放租约再删除的领取窗口，不删除任何已发布Entry/对象。仅记录删除失败不伪造内容清理失败。

失败重试保留可验证前缀；显式restart才移除本候选并重置来源验证器、预留与摘要。只允许未持有有效租约的暂停/失败任务改目标；原子更新Task目标和关联Transfer名称/父级/CAS。冲突不覆盖，输入和失败项保留。

## 迁移与配置

新增v11：files_download_tasks及owner/key、状态/时间索引；files_transfers增加download_id及索引，原字段与v1–v10 SQL不变。down前有任务、offline来源或非空download_id时guard拒绝；只在合成库验证down，不回滚用户库。MySQL guard显式ENFORCED，遵守128已记录的版本边界。

配置files.offline默认enabled=true，batchEntries20、ownerRecords200、globalRecords2000、concurrency1、dispatchInterval1s、leaseTTL20s、renewInterval5s、attemptTimeout15min、maxAttempts20、maxRequests64；硬预算只允许调小且保持时间关系。源头/连接预算见下一文。配置RestartRequired，disabled不删除历史；调度不可用时仍可读和清理，创建/继续明确不可用，不偷偷启动第二worker。

进度与租约使用专门的有围栏列更新，不推进用户Revision；通用任务状态事务仅写明确变更的字段，不覆盖并发检查点。进度每1s通过Adapter.Offset读取真实文件stat，不把网络已读但尚未写入的字节当成已接收事实。

目录超过files.search.treeEntries时仓储明确标记MetadataLimited，返回任务元数据但不返回截断的目录树。创建、继续、重试、从头下载、改目标与发布拒绝使用不完整目录；暂停、取消、任务读取与清理仍可用。调度被关闭时显式取消可自行维护清理，不依赖不可运行的后台调度。
