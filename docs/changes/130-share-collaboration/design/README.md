# 分享协作设计

研究依据R130-001。保留现有IAM、文件/历史/配额、GORM、tusd、Storage和Host；合理自研链接业务权限；重构事务范围与发布许可承载，拒绝事务外检查和复制文件用例。

- [策略与事务范围](policy-and-transaction-scope.md)：实体、版本、仓储、读写与错误。
- [访客传输与发布](visitor-transfer-and-publication.md)：SourceShare、tus、生命周期和清理。
- [接口、界面与验证](api-ui-and-validation.md)：20项接线、迁移、文件影响与集中验收。

计划状态：已确认（当前goal明确授权直接实施、免逐批审批）；实施范围F201–F220，证据与最终状态以唯一tasks.md及verification.md为准。
