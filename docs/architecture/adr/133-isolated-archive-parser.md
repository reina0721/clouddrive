# ADR-001：不可信压缩包在受限同二进制进程解析

状态：当前goal授权采纳；实施前的已确认决定，不冒称已落地。

sevenzip的编码header与字典会在应用可以检查成员前触发分配。选择同一应用二进制的内部纯计算入口，通过composition显式分派，不启动Application/Generation资源。父进程限制输入输出与并发；Windows Job Object和Linux RLIMIT_DATA负责硬分配边界，context/WaitDelay负责终止与等待。拒绝无保护回退。

保留成熟archive/zip与sevenzip v1.6.5，不fork算法、不修改全局解码器；拒绝因易接入而在HTTP进程冒险解码。没有使用外部7z可执行文件、容器、通用工作流或池，避免额外发布依赖。代价是每次有界进程启动、IPC字节复制及7Z固实块重复解码；当前64MiB/500项适合显式同步操作。未来持久解压任务须沿项目已有调度/持久聚合独立设计，不将本worker包装成万能任务器。

此决定通过新ADR替代；若库提供可验证的每实例硬预算/取消且实际收益充足，可单轨退役进程边界，不保留静默旧路径。解压发布仍属files事务，不进入worker。

## 原始材料定位

本记录从历史任务迁出，决定正文和历史状态不因此更新。完整原文、原研究与验证可用 `git show 0f6efdf5976c1f1f3c806a77138f8cf93f6ee2c3:docs/changes/133-archive-browser/design/adr-001-isolated-archive-parser.md` 查阅。
