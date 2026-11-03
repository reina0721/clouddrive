# R074-001 页内侧边栏与全局菜单不匹配：原因与一致性修复

## 研究问题

设置中心页内 SectionNav（8 项）与全局「设置」子项（6 项：5 分区 + iam.security）数量/内容不匹配。原因与修复？

## 证据

- `SettingsLayout.tsx` `sectionRoutes`：profile/account/security/appearance/notifications/language/about/acknowledgement（8 分区，页内全列）。
- `settings/binding.go` Navigation：settings.center 下五子项（profile/account/security/appearance/notifications）。
- `iam/binding.go`：`iam.security` ParentID=settings.center（070 双向归属演示挂入设置组）。
- 全局「设置」下实际呈现：五分区 + Account security（iam.security）＝6 项；页内 8 项（无 iam.security，多 language/about/acknowledgement）。

## 事实与推断

**事实**：不匹配由 070/072 两个决策叠加（五主分区进全局 + iam.security 跨模块挂入）；settings 模块在页内无法渲染 iam 页面（模块边界，settings 不感知 iam 菜单）。

**推断**：一致性修复 = 全局子项补全 8 分区（图标 languages/info/star）+ iam.security 移回 iam.access（跨 owner ParentID 能力保留在平台供未来使用）；页内 8 分区不变。全局与页内将完全一致（8 项同名同序）。

## 对本任务的影响

074 计划：settings binding 加三子项（Order 31-33 + 图标）；iam binding iam.security 回 iam.access；composition 菜单测试与 e2e 断言更新（Settings 组 8 项、Account security 回身份权限组）；权威文档（双向归属实例说明 + 一致性规范）；门禁与提交。