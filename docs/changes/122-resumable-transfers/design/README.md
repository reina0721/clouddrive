# 技术设计

支撑研究：R122-001；客户验收F41–F60。选择为采用tusd/tus-js-client、保留IAM/GORM/Storage owner、重构流式租约和HTTP预算、退役旧整块上传及无消费者fallback。

[流式承载](streaming-storage-and-http.md)描述基础设施与下载，[持久上传](durable-upload-lifecycle.md)描述业务状态与事务，[Host传输](host-transfer-runtime.md)描述浏览器所有权和集中验证。

协议与暂存选择的可追溯决策见[ADR-001](adr-001-resumable-protocol.md)。

用户在当前goal中明确要求直接实施、不经中途审批；本计划报告后按该指令继续实施，不增加批准步骤。没有授权删除既有数据或修改参考站。新事实实质改变上述范围时更新研究与设计再继续。
