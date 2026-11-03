# 106 设计摘要与导航

本变更的详细设计聚焦“入口表面”：schemas 公共能力如何映射到 plugin-framework 的
公开入口，模块依赖方向与禁止项。

- [入口表面与模块边界](entry-surface.md)：入口设计、依赖图、登记与验证。

## 关键决策

- 两个独立入口互不 import：浏览器安全 `./schemas` 与 Node `./schemas/runtime`。
- 只 re-export schemas 公共入口命名符号，语义/引用原样；`SOURCE_PATHS` 不公开。
- `/plugin` 以值命名空间 + 类型命名导出暴露 schemas 能力。
- 装配方负责 Runtime 创建/关闭；本轮不实现装配调用方。
