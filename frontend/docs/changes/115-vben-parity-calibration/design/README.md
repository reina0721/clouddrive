# 分层设计与公共能力门禁

当前 authority：[Foundation](../../../frontend-foundation.md)、[Surface](../../../surface-foundation.md)、[Plugin](../../../plugin-framework.md)、[UI Element](../../../ui-element-system.md)、[视觉校准](../../../ui-visual-calibration.md)、[Motion](../../../motion-foundation.md)、[配置](../../../config-foundation.md)、[质量证据](../../../quality-evidence.md)、[扩展治理](../../../foundation-extension-governance.md)、[认证](../../../../apps/web/src/auth/README.md)。本文件仅记录这些候选需求如何消费它们，不改写 authority。

## 所有权约束

- Universal 只承载跨产品成立的能力；Surface Foundation 与 Plugin Framework 都属于当前 Product Surface 层，不把所有 packages 统称 Universal。
- DataTable 保持行列/选择/排序/列宽等 Element 语义。查询折叠、列配置工具栏与批量动作先用 Collection 槽位组合；需要稳定 Pattern 时至少证明两个独立业务场景。导出字段投影与数据范围由 Feature 决定，下载/剪贴板由 Host 或明确 Browser Adapter 实现，不塞入基础表格。
- SettingsLayout 只提供空间结构。偏好业务留 settings，模型留 Surface，持久化与平台生命周期留 Host。新增字段沿用校验、partialize、hydration、version/migrate 与失败恢复，不另造 key 或 Provider。
- 权限呈现留当前 Surface identity，复用 IdentityPort/useProductAccess 与点分权限码；真实授权归服务器。Plugin Framework 不承载业务权限计算或具体菜单编辑数据。
- Shell 只消费已解析导航、正式 Ports 与 Next 生命周期；布局呈现可留 Surface Foundation，但不得引用 surfaces 的 navigation-groups 或生成物。
- 若需要分析业务，以标准 Surface Plugin 组合现有 Page/Pattern；Host 只装配，不将完整业务大盘写入 overview-page。图表先有真实消费者，再选最小语义契约，不预设必须自研 SVG 或零依赖。
- HeroUI import/compound styling 只在 ui-adapter；RHF/Resolver 经 form-foundation；i18next/Intl formatter 经 i18n。业务文案不写入 packages/i18n：Plugin-private 放 Plugin，Shell-private 放 Host resources，跨模块产品共享放 Surface；中英文同步。

## 公共能力扩展清单

先尝试 Element → Variant → Composition → Pattern → Feature Component。确有跨业务通用缺口才扩展 Foundation；完成以下证据前不得登记 stable：

- [ ] 搜索全部消费者和聚合 exports，记录谁应变化、谁应保持；证明不是单页组合错误。
- [ ] 定义语义分类、输入输出、controlled/uncontrolled 边界、失败语义、键盘/焦点与状态矩阵；不暴露 vendor props/type/slot。
- [ ] 对齐 Semantic Token、Light/Dark、Density、Contrast、Responsive、长文本和 Locale；Token facts 修改 design-system.schema.json 并生成，不手改生成区段。
- [ ] 先选 HeroUI 正确 primitive/anatomy；需 Slider/Tree/Overlay 时先核对已安装类型与官方文档，不自建 Selection/Focus/Overlay 管理。
- [ ] 公共 UI 变更前实际复核 TailAdmin 对应具体 UI Elements 页面，记录完整状态；Vben 不替代该门禁，不复制参考源码/DOM/CSS/数值。
- [ ] Showcase 与业务使用同一实现；Universal Element 对应 `/ui-elements`，Motion 对应 `/motion`，Pattern 对应 `/page-patterns`，完整组合对应 `/page-archetypes`。
- [ ] 在 tooling/foundation-contracts.json 登记公共 exports、owner、maturity、authority 与 evidence；依赖和 Browser Adapter 如需扩展，按既有边界完成审查，不加无条件豁免。
- [ ] 覆盖适用 Loading/Empty/Error/Success/Warning/Disabled/Pending/Offline/Permission Denied；提供恢复路径，不混淆 Loading 与提交 Pending。
- [ ] 完成 Contract/DOM/单元、Playwright 键盘/焦点、Axe WCAG AA 与视觉证据；覆盖桌面、超宽、移动、Dark、英文扩张和所有相关 Floating Layer 打开态。
- [ ] 动效按生命周期选择现役 Recipe；Page Enter 由 Host 自动提供，Overlay 由 HeroUI 管理，Reduced Motion 统一处理，禁止实验性 React ViewTransition 与页面自写参数。
- [ ] 完成 pnpm check，保留原 JS/CSS/gzip 预算；视觉基线仅在人工确认后限定更新，不提高阈值或排除规则。

## 回归与范围隔离

先用最小消费者证明新能力，再迁移其余选定调用方；单场景差异留 Feature composition，不改变公共默认值。若抽出已有私有实现，原 Plugin 也迁移到同一实现，不形成两条平行逻辑；保留旧数据迁移，替换完成后删除失效实现。

本次只有文档修改，不触发公共 UI 校准、浏览器或视觉基线更新；未来实现不能引用本次文档验证作为功能证据。
