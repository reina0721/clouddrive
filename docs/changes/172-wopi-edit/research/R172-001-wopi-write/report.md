# R172-001 WOPI 编辑会话、锁与内容发布

参考站“文件浏览应用 → 添加应用 → WOPI 协议应用”的同一发现表单描述在线浏览和编辑。参考环境未显示已经导入的编辑器，观察后取消。Cloudreve 官方手册描述 WOPI 锁与 PutFile。Microsoft 协议要求匹配 X-WOPI-Lock、30 分钟刷新和完整二进制写入。

R141-001 复核：当前仓库用同一 storage 写序列和 files_write_locks 约束原生、WebDAV 及传输发布。WebDAV 的连接字段绑定真实凭据，不能伪造连接或将 WOPI 客户端字符串混进 OwnerXML。保留现有锁表，追加类型专属字段，复用 ChangeWriteLocks 的原子 Entries+Upsert 和对象补偿。沿用短期密封票据、IAM files:write 与现有配额、历史策略。Go 标准库及既有 Huma 已满足协议与二进制预算，无新增依赖。流式大文件和跨所有者会话需要额外传输契约，当前直接二进制写入明确限额。
