# 唯一完成清单

- [x] T137-01 研究；前置：读取根范围、Git与既有研究；完成：R137-001事实/推断与路径可复核，研究门禁通过。
- [x] T137-02 计划；依赖T137-01；完成：需求20项、设计、影响和验证方案形成；授权：当前goal明确要求不中途确认直接实施。
- [x] T137-03 服务端持久化；依赖T137-02；完成：typed模型、CAS repo、会话/CSRF API、三驱动v14迁移及生成契约接通。证据：新model/service/repo/preferences.go、http/preferences.go、六个迁移文件及生成OpenAPI160项；QA迁移v14且dirty=false，Go全量通过。
- [x] T137-04 Host与Surface；依赖T137-03；完成：F321–F340全部接通，不提前运行功能测试。证据：Host preferences.ts、Surface preferences.ts、FilesPage/ViewOptionsDialog/FileItem和中英文文案；接通后才开始单位及浏览器检查。对应关系见verification.md。
- [x] T137-05 集中验证；依赖T137-04；完成：相关Go/前端检查、真实浏览器与视觉验证通过，记录限制。证据：verification.md；694单位、89文件浏览器及通用5项恢复通过，原预算与静态/格式检查通过，LF规范化后Go全量/vet、暂存区84迁移checksum及原生偏好场景再次通过。
- [x] T137-06 更新预览；依赖T137-05；完成：数据备份/摘要、前滚与重启确认成功，最新访问说明保存.data。证据：137-runtime-receipt.json的17项、137-data-receipt-v14.json的所有原files表一致及最终r5 CUA截图。
- [x] T137-07 交付；依赖T137-06；完成：authority同步、完整diff审查、Conventional Commit及推送验证，工作区状态如实记录。证据：功能提交fdd08704756e2d798b507d4416f57e431a5b4354已推送main，ls-remote核验一致，提交后工作区干净；文档收口作为后续同任务提交。

实施入口：基线仍66ffa3d281dfcd02adc032f16ada48494406a064；进入实施时只有本任务文档新增，未命中R137-001刷新触发器，基线未漂移。原两库所有既有files表的一致备份、列/行摘要见.data/137-original-baseline.json，实施入口v13复核通过；其后按计划前滚v14并核对所有原files表一致。

最新进展：T137-05及T137-06已满足，最终主/QA生产目录为137-primary-final-r5与137-qa-final-r5，4173开发预览已重启，全部服务保持运行。用户明确批准仅更新组件展示页的一张旧视觉基线，原阈值复验通过；功能提交fdd08704756e2d798b507d4416f57e431a5b4354已推送并核验远端一致，T137-07完成。仍保留136登录500和通用首次时序失败的局限，不声明全站无风险。
