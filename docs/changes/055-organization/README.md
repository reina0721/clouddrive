# 055 Organization 组织目录模块

状态：已完成。`ORG-055-001..007` 已实现并通过 Go、WebUI、E2E、视觉、生成与文档门禁；本次未扩展到数据权限或跨模块事务。

## 目标

新增 `organization` 业务模块，拥有 Department、Position 及账号部门/岗位关系，产出部门、岗位和账号组织分配 API/WebUI。首版只提供组织目录和筛选，不进入权限 decision。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求规格](requirements.md)
3. [设计方案](design.md)
4. [任务与确认状态](tasks.md)

## 实施门禁

053、054 已完成，用户已在计划报告后确认并完成 055。部门数据范围、多租户、汇报线或 HR 流程必须另行研究。
