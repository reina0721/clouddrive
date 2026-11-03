# 099 Admin Shell Navigation Interaction — 完成清单

研究门禁：`R099-001` 已通过。
计划状态：已确认；实施与验证已完成。

## 研究与计划

- [x] `R099-001` 核实父级菜单、展开状态和 Compact Hover 根因；证据：源码、现有 E2E、Git 基线与用户图 1～5。
- [x] `PLN-099-001` 完成需求、设计、影响范围和验证计划；证据：本变更 requirements/design/tasks。
- [x] `PLN-099-002` 用户在计划报告后确认实施；证据：2026-09-01 后续消息“确认”。实施基线 `484dfe009a8527f49a0564f9bec5b1151c46592d` 未漂移。

## 实施

- [x] `NAV-099-001` 把 Branch 父级迁移为整行 Disclosure Button，删除默认子级跳转与独立方形 IconAction；证据：`packages/admin-foundation/src/shell-navigation.tsx` 与 `admin-shell-parent-navigation` 快照。
- [x] `NAV-099-002` 建立 active/expanded 正交的用户 override，使活跃父级可收拢和恢复；证据：Playwright 验证两次切换期间 URL 保持不变。
- [x] `FLY-099-001` 分离 Pointer/Keyboard Flyout 生命周期，消除 Hover 重复开关和 Hover 焦点抢占；证据：500ms 稳定性、Hover Corridor、Keyboard/Escape 与 `admin-shell-compact-flyout` 快照。
- [x] `DOC-099-001` 同步 Admin Foundation 当前 authority；证据：`docs/admin-foundation.md`。

## 验证与提交

- [x] `VER-099-001` 更新父级 Button、URL 不变、叶子导航、移动导航与 Hover Corridor Playwright 契约；证据：`navigation.spec.ts` 4/4 通过。
- [x] `VER-099-002` Axe、Light/Dark、active/idle、expanded/collapsed、Compact Flyout 和视觉快照通过并人工复核；证据：新增 2 张导航快照并单轨更新 1 张移动导航基线，完整浏览器矩阵 41/41 通过。
- [x] `VER-099-003` 完整 `pnpm check` 与 `git diff --check` 通过，不调整预算或阈值；证据：Foundation/Architecture/Dependency/Lint/Typecheck/Test/Build/Performance/Playwright/Format 全绿。
- [x] `COM-099-001` 只暂存 `/frontend` 099 文件并创建 Conventional Commit，不推送；证据：本任务收尾提交与提交后状态复查。
