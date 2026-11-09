# R171-001 WOPI 发现与文档只读操作

参考站文件系统的“添加应用”菜单中，“WOPI 协议应用”打开“导入 WOPI 应用设置”。表单仅要求发现地址，示例使用 /hosting/discovery，空值时确认按钮禁用。只观察并取消。官方 [Cloudreve WOPI 文档](https://docs.cloudreve.org/zh/usage/wopi) 描述导入、网络要求及读写操作。

[WOPI Discovery](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/discovery) 区分 view 和 edit，并按后缀选择动作 URL。只读 view 要求 CheckFileInfo 和 GetFile。[协议端点](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/endpoints) 以 /wopi 开始，启动采用浏览器表单 POST 传递访问凭据。Microsoft 365 CSPP 的证明密钥和接入要求不等同于自托管 WOPI 阅读器。

基线已有 HTTPS 安全出站控制（httpdownload）与文件应用 JSON 修订、外部应用用户确认、加密的短期票据及 Range 读取。保留这些边界。采用 Go 标准库 encoding/xml 与 net/url，Web 原生表单，复用已装配 HTTP 客户端，无新增依赖。应用只接受同源 HTTPS 动作。浏览器直接拉取发现存在 CORS 限制，新建通用 HTTP 客户端会重复 DNS、重定向和资源生命周期。此次证据涵盖发现与只读协议，编辑回写依赖锁和版本提交契约。
