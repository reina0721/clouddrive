# 持久上传与发布

## 契约、配置与状态

files自有Transfer实体：ID、OwnerID、ParentID、Name/NormalizedName、SizeBytes、ContentSHA256、CreatedAt、ExpiresAt、State、EntryID、ObjectKey、稳定失败码与Revision。真实offset以tusd暂存文件为authority，不用浏览器数字覆盖。状态为preparing/receiving/paused/publishing/attention/completed/canceled/expired；DTO不输出路径/object key/hash或其他owner。

迁移新增files_transfers及必要下载ticket表；不修改已应用v1–v4。已有条目无需重写。创建与目录预算使用现有storage->owner锁；默认512MiB文件、4MiBchunk、暂存有效期24小时、owner活动会话20、全局100会话/2GiB暂存预留、传输并发2，配置集中且restart-required。已发布逻辑配额+活跃预留不得超owner quota；全局预留按声明size保守计算，锁序固定。恢复和完成时再次检查，不依赖浏览器选择。

此处owner预留约束用于接纳新传输，不保证冻结其他目录操作的额度；并发复制或文本编辑仍可能消耗永久逻辑配额。发布必须按当时真实used重新校验，空间不足转attention保留已上传内容，用户释放空间后再完成；全局暂存声明预算则在所有传输事务内严格累计。不得为了维持预留数字而阻止不相关的既有读取或删除用户内容。

Staging窄port只定义Create/Inspect/WithReader/Remove/WithLock，无http或tus类型；adapter/tus独占filestore、gofrs/flock OS独占锁和权限0600/0700。Protocol窄接口属于HTTP边界，只暴露Handle；module纯内存构造，单独InitializeTransfers候选I/O创建/校验暂存根及数据库位置绑定。暂存变更有活动项时拒绝；已用原Storage内容位置策略也纳入活跃transfer。普通和专用预览使用不同根，不共享临时文件。OS锁协调跨generation和同机进程；所有HTTP核心和完成/取消/暂停操作共用同一锁，等待有timeout，获取以同步context轮询，不创建后台goroutine。锁文件长期保留，不在锁释放后删除，避免Unix不同inode产生两把锁。请求取消由调用方拥有；竞争请求不另建.stop文件或主动取消其他owner。

## 创建与tus数据面

POST /files/transfers JSON提交name、parent、size、SHA256与幂等key；先事务记录preparing并预留，再以确定的随机ID建立filestore，最后转receiving。重复请求返回相同会话，不重复分配预算；初始化失败保留可重试清理状态并导出错误。创建只接受合法ID和内部生成路径，不接受tusd metadata提供Storage.Path。

HEAD/PATCH /files/transfers/{id}/data要求本账号授权。service.RunReceiving在Staging.WithLock中读取持久状态与expiry，确认后以同步callback委托tusd核心；同一锁已在外层持有，tusd composer不再装第二把锁。协议检查交给tusd，Chunk长由http.MaxBytesReader限制。无需要消费者的channel或常驻worker。状态检查必须在拿锁之后，防止暂停/取消与已通过早期检查的PATCH竞态。

暂停：浏览器先abort并await当前请求，再POST pause；服务端同锁记录paused。继续POST resume后HEAD取得真实offset；网络重试先HEAD，不信任上一次客户端progress。取消同锁标canceled并清理本会话；重复取消幂等，completed拒绝。到期在读取/写入/列举/创建时请求驱动清理到期暂存并释放预算；记录仍保留expired。只清理DB登记的暂存ID，绝不递归清空根。清理失败保留占用及错误，不能先释放容量后无限堆积孤儿。

## 发布与失败

完整offset后POST /{id}/commit；持有同一上传锁，读取暂存流，Go SHA256核对预期hash与size，不一致进入attention并保留源供明确取消/重传。发布使用确定性随机ObjectKey，先持久publishing再流式写永久Storage，再在owner事务内重新检查父目录、重名、配额并创建Entry及completed；同事务写EntryID，刷新重试不重复创建。metadata竞争失败转attention保留暂存，允许修改本owner有效目标和name后再commit。已有上传内容不重新传；替换目标不是覆盖已有文件。

崩溃在publishing时重试可重复同key写同摘要不可变内容；不能删除可能已完成的object。completed但暂存尚未删除时后续读取/cleanup重试清理，明确记录cleanupPending而非返回假成功。清理错误保留原链，且已完成的业务状态不得被标为上传失败并诱发重传。原文件objectkey不受影响。

## 单轨迁移与退出

Host所有普通上传迁移tus；createText用语义化小文本创建API，移除POST /upload及UploadKey旧调用，迁移一并保留历史列作为已应用schema证据，但不留无调用入口。以前幂等语义迁至transfer id/key，原文本编辑CAS仍保留。遍历旧符号/路由/32MiB强制界限，更新API/权限/Host Port和对应测试。旧metadata字段仍被其他当前流程需要时保留，否则不暴露或继续写入。

adapter可替换，退出tus时只需迁移活跃暂存与协议端点/Host实现，永久Entry/Storage和业务状态不绑定tus结构。多主机无共享暂存不支持，需未来新架构研究。文件影响：files model/service/repo/adapter/http/config/migration、composition装配与Storage identity、预览脚本、三方言SQL、API契约、权威说明。
