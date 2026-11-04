# 第三批实施记录

实施基线c907155、R120/R121及R122-001；用户当前goal要求直接实施。.data/122-baseline.json和两份一致性SQLite备份在忽略目录，未重置账号或修改参考站数据。

已完成流式Storage/Kernel租约、files持久传输与tus窄Adapter、同步OS锁、v5/v6增量迁移、HTTP精确传输预算、私有与公开原生下载、Host全局队列和files传输中心。媒体独立预算避免大文件上限扩大页面Blob读取。旧普通上传入口及无消费者fallback退役，文本创建使用明确的小内容契约。

成熟依赖为tusd2.10.1、gofrs/flock0.13.1、tus-js-client4.3.1和noble-hashes2.4.0。MVS带来的AWS/Smithy等最低版本变动已解析并通过Go回归；候选和取舍在研究/设计中保留。锁候选因生命周期证据做过定向刷新，未自写续传协议。

全部F41–F60实施后才集中测试。实际检查、失败修复及外部未验收边界见[验证记录](verification.md)。唯一checkbox仍在[tasks.md](tasks.md)，本文件不提供另一套完成清单。

普通开发4173/8080/9090、独立预览4180/8120/9120均已迁移至files v6并重启最新代码；访问资料.data/preview-access.json及.data/122-delivery.json保持Git忽略。原40项已验证前端曾冻结以保护开发期间预览，现在已由最新服务替换。隔离验收使用4182/8122/9122，不共享正式预览的暂存根。

整体Cloudreve对齐goal继续，当前60项不代表挂载、离线下载、多人协作、版本和Office已经实现。远端权限问题不以本地commit替代，准确回执写入验证记录。
