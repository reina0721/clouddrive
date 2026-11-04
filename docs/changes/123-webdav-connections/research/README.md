# 研究索引

集中安全扫描后的定向升级见[R123-003](R123-003-security-floor/report.md)，仅替换当前不安全构建基线，不改写历史证据。

集中验证触发的地址边界定向复核见[R123-002](R123-002-endpoint-origin/report.md)：实际WebDAV端点不通过Next整包克隆代理。

检索了docs内metadata.yaml的WebDAV/连接/mount主题。R122-001明确排除WebDAV，但其流式租约、暂存与HTTP预算证据可扩展复用；044的mount指HTTP路由挂载，不是网盘挂载。当前选型、参考站视觉和承载差异见[R123-001](R123-001-webdav-boundaries/report.md)。
