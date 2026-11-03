# 106 需求摘要与导航

本变更把 `@clouddrive/schemas` 公共能力接入 Plugin 架构。需求面向“Plugin 开发者
与装配方”两类使用者，不涉及内部类名/包路径以外的实现细节。

- [Plugin 经公开入口消费 schemas 能力](plugin-schema-access.md)：可验收行为。

## 范围

- Plugin/装配方经 `@clouddrive/plugin-framework` 的 `./schemas`、
  `./schemas/runtime`、`./plugin` 消费 schemas 能力，无需访问 schemas 内部实现。
- 浏览器入口不引入 Node Runtime；Runtime 创建/关闭由装配方负责。
- 不新增 Provider/Hook/服务/协议；不打通浏览器↔Node 调用；不改 schemas。
