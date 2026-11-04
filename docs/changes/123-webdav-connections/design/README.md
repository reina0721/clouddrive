# 技术设计

R123-003补充：实际扫描触发Go1.26.10、Excelize2.11.1及govulncheck1.9.0升级，统一脚本、镜像和当前文档；S01不增加产品功能数量，替代旧安全前提。

支撑研究R123-001、需求F61–F80。保留IAM/GORM/流式Storage/持久暂存；采用emersion/go-webdav v0.7.0并封装；升级x/net到0.62.0及其最低依赖；扩展现有上传核心，退役另起一套大文件入口的做法；不新增Kernel万能能力。

- [凭据与文件边界](connection-authority.md)
- [协议、路由与资源](webdav-protocol.md)
- [统一流式发布](streaming-publication.md)
- [界面与集中验收](host-and-verification.md)
- [协议和端点决策](adr-001-protocol-and-endpoint.md)

状态：按用户goal的直接实施指令执行，不增加确认步骤。新事实若推翻上述边界，先定向更新研究与设计；不借当前授权删除原数据或改写已应用迁移。
