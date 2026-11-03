# 实现方案

导航分离身份与访问、系统管理、个人。业务复用现有 Foundation；认证安全通过 Surface 的具体 AccountSecurityPort，由 Host 注入，Schema 延迟加载。通知服务端消息与本地应用事件独立分页，避免错误合并分页。
