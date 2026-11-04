# 实施与集中验证

前置e6821bf干净基线。按当前goal直接执行授权，实施入口只检查增量路径；记录两套SQLite一致性备份，用现有125生产产物冻结4180前端，保留8120后端与数据。研究刷新仅在记录的触发器命中时进行，不重复全仓审计。

文件范围：files Model/Service/Repository、config与Huma binding、v9三方言migration/摘要；特别包括repo transfers/connections/navigation映射、service copyTree与transfer覆盖保留。前端Surface annotations值/port/schema、查询/filters、FileItem/FileGlyph、属性drawer及批量dialog、Host adapter/clipboard；原属性dialog和旧record别名单轨删除。同步OpenAPI、console投影、authority与影响记录。

I02–I06实现全部20项后才开始测试。集中验证包括Go规则/事务/迁移与真实HTTP、双owner/共享/DAV泄露负向、CAS冲突与批量原子、预算/取消、复制/覆盖/回收恢复及实际停止重建；前端schema/Host失效、浏览器标签/属性/搜索/图标/批量/冲突与前120项流程。桌面/390px视觉、格式/类型/lint/架构/生成新鲜度/性能/文档门禁按实际范围执行，失败修正与证据写verification.md。

完成后重启普通开发4173/8080/9090及预览4180/8120/9120并保持运行；备份逐行检查原文件保留，ignored访问资料刷新。按Conventional Commit精确提交，实际push并核验；若仍403，独立报告远端未更新，不改变remote、不强推、不伪造成功。
