# 153 文件 Blob 回收

当前基线 `6c12471`。参考 Cloudreve 4.19.1 的定期回收与 Blob 管理。本批实现失去引用对象的持久回收队列、独立授权的手动清理和可选自动任务。

依次阅读[研究](research/R153-001-blob-reclamation/report.md)、[需求](requirements/README.md)、[设计](design/README.md)、[任务](tasks.md)及[验证](verification.md)。
