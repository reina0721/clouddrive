# HTTP源与强校验续传

HTTPDownloadSource提供纯Normalize与WithBody(ctx, request, use)；服务只见项目typed头/验证器与Reader，不见http.Client/Response或文件路径。Adapter拥有单个Transport、DNS/连接/重定向、Body关闭和原始错误链；composition以Participant显式关闭闲置连接。无新增第三方依赖。

只允许http/https、合法host/端口、最长4096字符，无userinfo、控制字符或不支持协议。默认公网；netip规范化含IPv4映射，依据IANA特殊地址清单拒绝私有、回环、链路、文档/测试、共享地址、组播、转换地址等，并阻止常见云元数据目的地址。每次连接重新解析、验证结果并只拨已验证的IP，不在验证后按域名二次解析。TLS仍使用原域名验证证书，禁止跳过验证。所有DNS答案均须被策略允许，解析/尝试数量有界。

管理员可显式增加至多16个CIDR许可；隔离QA仅允许127.0.0.1/32的受控源，用户预览不放开内网。Transport不用环境代理，无Jar/应用Cookie/任意认证Header；每跳重验且去除Referer，最多5跳，HTTPS不降级HTTP。连接/TLS/响应头默认10s、body空闲15s、头32KiB、连接数和buffer有界，整个attempt还受15min和任务到期限制。HTTP错误用稳定类型归一化，cause保留但Error()和日志不暴露URL/query。

初次GET不依赖HEAD，不提前完整缓存响应。已知长度必须吻合，未知长度在剩余预算内读到EOF；额外一个字节即拒绝超额，不默认截断成功。Content-Disposition只提供经过ValidateName/NFC检查的单个名字，不能变成本地路径；否则使用受控URL名称或生成名称。自定义名保持用户选择。签名query只保存在私有任务表，需要本人明确复制时才返回给Host。

有前缀时使用Range及If-Range。只使用强ETag，或符合RFC9110强验证器条件的Last-Modified；弱/缺失校验不冒险拼接。最终URI、起始偏移、Content-Range总量、长度和显式新验证器须一致；200或来源变化明确要求restart。允许合法分段206，但每attempt最多64次请求。未知源总量不伪造百分比。已seal且偏移等于大小的候选可在重启后直接校验发布，不把下载完整但未确认的内容重新拼接。

追加能力放入既有tus Store的窄Staging接口，使用相同UUID、OS锁和取消Reader；不让Service访问内部目录。进度按真实已写入字节、至多每1MiB或1s检查点持久化；UI2s有界轮询，速度取同一attempt的样本，不虚构长期平均值。正常取消/关停不记Error。数据库写失败、心跳失效与清理失败完整导出，不以空任务/默认状态掩盖。
