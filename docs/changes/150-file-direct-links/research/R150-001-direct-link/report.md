# R150-001 文件直链

Cloudreve 参考实例默认用户组展示“获取直链”、批量上限 10、启用中转和重用已有直链。目录直链标为 Pro。视觉证据位于 `.data/150-reference-direct-links.jpg` 和 `.data/150-reference-direct-link-reuse.jpg`。参考实例文件列表为空，个人菜单语义由正式源码与接口文档交叉复核。[Cloudreve 路由](https://github.com/cloudreve/Cloudreve/blob/master/routers/router.go) [直链接口](https://cloudrevev4.apifox.cn/create-direct-links-306837572e0)

现有项目通过 `contentResponse` 与 `Service.DownloadTo` 处理请求范围、租约、条件与传输准入。分享票据绑定单次下载能力和版本，不能作为持久直链。现有 `newCapabilitySecret`、摘要与账号分享授权可用于新的 capability。所有拥有者变化经 `lockOwner` 串行，持久化采用增量迁移。

推断：维持同一文件 ID 的中转可支持稳定地址和逐次撤销判定。使用 Go 标准库 ServeContent 和现有内容 Adapter 可覆盖协议要求，避免引入新的中转和鉴权依赖。目录与对象签名支持属于不同权限及存储边界，留待独立研究。
