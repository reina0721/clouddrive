# 研究

下面的 Modal 研究来自已撤销的弹窗编辑尝试，作为历史研究保留；最终常驻表单方案不修改公共 Overlay。当前复用 UserForm、FoundationForm、Page／Section 和既有 Action，确认所有 UserForm 消费者仅账户采用嵌入模式。

已检查 DialogSurface 全部真实消费者：UI Elements Overlay 与 Resource List。UserForm 用于用户创建、编辑与账户资料；只有账户使用嵌入模式。

2026-10-14 进入 [TailAdmin Modals](https://react-demo.tailadmin.com/modals) 的 Form In Modal，观察关闭态与打开态。表单信息、独立 Footer 主次操作、Scrim 与浮层层级明确，只采用视觉规律，不复制 DOM、CSS 或尺寸。

[HeroUI Modal 官方文档](https://heroui.com/en/docs/react/components/modal) 已定向复核受控状态、关闭策略、Form 与焦点；公共交互继续由 HeroUI 管理。
