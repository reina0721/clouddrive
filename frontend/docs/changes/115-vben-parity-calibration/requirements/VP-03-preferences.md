# VP-03 偏好增量、水印与锁屏评估

原 Task 116。状态：未实施；D-03 待决策。

## 已具备与检查入口

[preferences-model](../../../../surfaces/src/preferences-model.ts) 已有八分类和四个 accent；[settings](../../../../surfaces/plugins/settings/src/category-sections.tsx) 是真实业务；[restore-defaults](../../../../surfaces/plugins/settings/src/restore-defaults.tsx) 有双层恢复；[preferences-port](../../../../apps/web/src/host/preferences-port.ts) 有存储失败语义。[detail-settings](../../../../packages/surface-foundation/src/detail-settings.tsx) 是通用布局，不是偏好业务抽屉。

## 候选增量与执行步骤

1. 优先评估导出偏好 JSON：只输出已校验的偏好白名单，标明版本和范围；剪贴板归 Host/Browser Adapter，失败给恢复路径；不混入账户、凭证、通知和草稿。
2. 若选择更多 accent/独立侧栏/滤镜，先说明产品用途、对比度与全部消费者；复用 schema accents/appearanceProfiles，不能直接追加十套 raw palette 或手改生成 CSS。
3. 设置新入口留在 settings 的 composition，复用同一 PreferencesPort/八分类模型；四分栏替换不视为已确认需求，不改变 SettingsLayout 默认行为。
4. 水印与锁屏独立待决策。水印明确只是视觉提示及信息暴露范围，客户端 MutationObserver 不构成防篡改保证；Canvas/observer 清理由 Host 管理。
5. 锁屏须先定义服务端验证/会话失效、刷新恢复、跨标签同步和账户切换，不能保存当前明文密码或增加前端通用密码比较器；敏感访问仍受原认证与授权保护。

## 重复建设与兼容约束

不建第二套 preference store、Provider 或新 key，不把恢复默认再实现一遍。扩展仍保留 clouddrive.shell 的 version/migrate、显式白名单、缺字段补全、坏记录与写入失败语义。颜色、滤镜和安全生命周期分批，不用“设置中心”打包越界。

## 后续验收（尚未执行）

- [ ] 获选偏好经现有 Port 即时生效，刷新/跨窗口/坏记录/写入拒绝行为明确，恢复只影响偏好。
- [ ] JSON 导出只含白名单，复制成功和失败均有真实结果反馈。
- [ ] 获选外观覆盖全部真实消费者、四种既有 accent、明暗/高对比/密度/英文与窄屏；生成 freshness 通过。
- [ ] 若实施水印/锁屏，单独补生命周期、卸载、刷新、身份切换和认证失效验证；不能用 UI 遮罩证明安全授权。

本任务完成还须执行 [公共能力与质量门禁](../design/README.md) 和 [执行协议](../design/execution-protocol.md)；上列清单不替代完整 pnpm check。
