# 074 设置菜单一致性：页内导航与全局菜单 8 分区对齐

状态：研究门禁已通过（R074-001）；计划已建立，**待确认**。

## 背景

用户发现设置中心页内侧边栏（8 分区）与全局「设置」菜单子项数量/内容不匹配：全局仅 5 主分区且多出挂入的「Account security」（iam.security），页内全 8 分区却无该 iam 页面。

原因（R074-001）：070/072 的「全局五主分区、页内全列」取舍 + 070 双向归属演示把 iam.security 挂入设置组——两决策叠加造成错位。

## 方案

- settings 全局子项补全 **8 分区**（与页内 SectionNav 同名同序，新增 language/about/acknowledgement，图标 languages/info/star）；
- `iam.security` **移回** `iam.access`（撤跨模块挂入演示；跨 owner ParentID / HostNavigation 契约能力保留在平台供未来使用）；
- 更新 composition 菜单测试、e2e 断言与权威文档；门禁全绿后提交。

## 阅读顺序

1. [研究档案](research/README.md)：R074-001
2. [设计方案](design.md)：双向改动与验证
3. [任务清单](tasks.md)：PAR-074-A..D