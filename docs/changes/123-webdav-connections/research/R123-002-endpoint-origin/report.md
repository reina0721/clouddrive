# 实际连接地址

实施验证触发定向复核：`.data/123-browser-connections.log`初次大文件请求返回499；对应Next日志明确说明32MiB克隆预算截断33MiB请求。后端直接HTTP的未知长度33MiB写入、SHA和范围下载同时通过。证据定位为已安装Next16.3.3的`dist/server/body-streams.js`、`dist/server/lib/router-utils/proxy-request.js`及本批Go/浏览器测试。日志包含隔离会话，仅留在ignored目录。

事实：Next开发转发会克隆请求体，超过配置上限会结束克隆流；简单加一条rewrite并不能成为无缓冲的大文件网关。推断：把上限提高到512MiB会将单机流式预算转化为整包内存成本，不满足本任务资源目标。另起Node代理会增加进程、生命周期与第二套路由，当前实际用例不需要。

采用既有Go协议listener作为实际WebDAV端点。管理JSON增加`endpointOrigin`，binding默认采用当前API请求看到的scheme/Host，不采用未经信任的Forwarded头；`files.connections.publicOrigin`可显式声明HTTPS反向代理的公网origin。Host只负责组合服务端地址及相对路径、校验HTTP(S)/无凭据/无query并复制，不用浏览器地址猜测API端口。管理请求仍沿用原Next小JSON代理，WebDAV客户端直接连接所展示的实际地址。部署者必须让该地址可达，且网关支持真实流式转发。

范围影响仅限连接地址DTO、配置及Host组合，不改变文件契约、凭据、资源生命周期或数据迁移。用户当前goal明确要求自主执行，本任务按此授权更新设计并继续集中验证。局限：不自动发现公网域名、不自动配置TLS，不声称操作系统驱动已验证。验收需以服务端返回地址完成33MiB上传，不把后端直连通过冒称Next同源大文件转发通过。研究门禁通过。
