# 056 Navigation 后台导航策略模块

状态：已完成。`NAV-056-001..007` 已实现并通过 Go、WebUI、E2E、视觉、生成与文档门禁；未引入动态页面、第二套授权或后台 watcher。

## 目标

新增 `navigation` 业务模块，只管理已注册菜单的启停、父子和排序，产出菜单策略 API/WebUI 与 `NavigationRevision`。静态 Route、Entry、component、locale 和 ViewOperationID 继续由各模块 WebUI Binding 拥有。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求规格](requirements.md)
3. [设计方案](design.md)
4. [任务与确认状态](tasks.md)

## 实施门禁

053、054、055、056 已完成。数据库动态页面、外链/iframe、远程模块或第二套 role-menu authority 必须重新研究。
