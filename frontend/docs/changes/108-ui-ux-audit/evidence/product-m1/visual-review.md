# M1 视觉审阅清单

用户已于 2026-10-12 人工确认 M1 视觉变化并授权更新对应基线。随后定向运行本清单对应的 11 个测试，全部通过；只重建超出既有阈值的对应截图，未调整 diff 阈值。更新记录见 [获准视觉检查](approved-visual-passed.txt)。最终完整门禁通过，浏览器 **344/344**，见 [最终检查](check-passed.txt)；第一次检查记录见 [原检查日志](check-before-visual-approval.txt)，实现与数据边界见 [实施账本](../../product-implementation.md)。

## 当前产品预览

- [中文桌面工作台](workbench-desktop.png)
- [中文手机工作台](workbench-mobile.png)
- [英文 Dark 手机工作台](workbench-dark-en-390.png)
- [英文 Dark 平板](workbench-dark-en-768.png)
- [英文 Dark 桌面](workbench-dark-en-1440.png)
- [英文 Dark 超宽屏](workbench-dark-en-2560.png)

## 审阅范围

M1 改动：工程介绍首页替换为真实工作入口；导航分为工作空间、个人、开发中心；Icon 与 Reference 归开发中心；clouddrive 品牌与个人偏好名称；删除 Shell 工程 Preview。

部分对照同时含既有工作区差异：参考资源说明文案、浮层页底部可见位置、日期控件的今天标记随执行日变化、开发工具按钮位置。逐项检查确认文案与当前源码一致、组件交互和可访问性通过。DatePicker 用例额外固定 2026-10-09 的 Date 时间，计时器继续运行；固定日期后仍有 M1 Shell 变化，因此重建该图，但不把执行日漂移纳入基线。共更新 15 张对应截图。清单保留第一次检查的原始对照供追溯。

## 旧基线 / 当前 / 差异

- **authentication-login-320**：[旧基线](visual-review/authentication-Authenticat-5b3ad-ts-remain-accessible-at-320-chromium/authentication-login-320-expected.png) · [当前](visual-review/authentication-Authenticat-5b3ad-ts-remain-accessible-at-320-chromium/authentication-login-320-actual.png) · [差异](visual-review/authentication-Authenticat-5b3ad-ts-remain-accessible-at-320-chromium/authentication-login-320-diff.png)
- **authentication-register-320**：[旧基线](visual-review/authentication-Authenticat-5b3ad-ts-remain-accessible-at-320-chromium/authentication-register-320-expected.png) · [当前](visual-review/authentication-Authenticat-5b3ad-ts-remain-accessible-at-320-chromium/authentication-register-320-actual.png) · [差异](visual-review/authentication-Authenticat-5b3ad-ts-remain-accessible-at-320-chromium/authentication-register-320-diff.png)
- **authentication-register-320-en-dark-large**：[旧基线](visual-review/authentication-Large-Engli-d3490-keeps-password-entry-usable-chromium/authentication-register-320-en-dark-large-expected.png) · [当前](visual-review/authentication-Large-Engli-d3490-keeps-password-entry-usable-chromium/authentication-register-320-en-dark-large-actual.png) · [差异](visual-review/authentication-Large-Engli-d3490-keeps-password-entry-usable-chromium/authentication-register-320-en-dark-large-diff.png)
- **surface-shell-parent-navigation**：[旧基线](visual-review/navigation-展开侧栏用同一递归能力呈现-P-0c607-ve-Path-Anchored-Accordion）-chromium/surface-shell-parent-navigation-expected.png) · [当前](visual-review/navigation-展开侧栏用同一递归能力呈现-P-0c607-ve-Path-Anchored-Accordion）-chromium/surface-shell-parent-navigation-actual.png) · [差异](visual-review/navigation-展开侧栏用同一递归能力呈现-P-0c607-ve-Path-Anchored-Accordion）-chromium/surface-shell-parent-navigation-diff.png)
- **surface-shell-compact-sibling-swap**：[旧基线](visual-review/navigation-收缩侧栏切换兄弟菜单时同一时刻只有一个-Flyout-且旧菜单不残留-chromium/surface-shell-compact-sibling-swap-expected.png) · [当前](visual-review/navigation-收缩侧栏切换兄弟菜单时同一时刻只有一个-Flyout-且旧菜单不残留-chromium/surface-shell-compact-sibling-swap-actual.png) · [差异](visual-review/navigation-收缩侧栏切换兄弟菜单时同一时刻只有一个-Flyout-且旧菜单不残留-chromium/surface-shell-compact-sibling-swap-diff.png)
- **surface-shell-compact-flyout**：[旧基线](visual-review/navigation-收缩侧栏的-Hover-Flyout-保持稳定并支持键盘进入-chromium/surface-shell-compact-flyout-expected.png) · [当前](visual-review/navigation-收缩侧栏的-Hover-Flyout-保持稳定并支持键盘进入-chromium/surface-shell-compact-flyout-actual.png) · [差异](visual-review/navigation-收缩侧栏的-Hover-Flyout-保持稳定并支持键盘进入-chromium/surface-shell-compact-flyout-diff.png)
- **ui-elements-date-picker-open**：[旧基线](visual-review/overlays-DatePicker-与-Command-展开面支持键盘及无障碍扫描-chromium/ui-elements-date-picker-open-expected.png) · [当前](visual-review/overlays-DatePicker-与-Command-展开面支持键盘及无障碍扫描-chromium/ui-elements-date-picker-open-actual.png) · [差异](visual-review/overlays-DatePicker-与-Command-展开面支持键盘及无障碍扫描-chromium/ui-elements-date-picker-open-diff.png)
- **ui-elements-menu-open**：[旧基线](visual-review/overlays-Dropdown、Popover-与-Tooltip-展开面进入视觉回归-chromium/ui-elements-menu-open-expected.png) · [当前](visual-review/overlays-Dropdown、Popover-与-Tooltip-展开面进入视觉回归-chromium/ui-elements-menu-open-actual.png) · [差异](visual-review/overlays-Dropdown、Popover-与-Tooltip-展开面进入视觉回归-chromium/ui-elements-menu-open-diff.png)
- **ui-elements-popover-open**：[旧基线](visual-review/overlays-Dropdown、Popover-与-Tooltip-展开面进入视觉回归-chromium/ui-elements-popover-open-expected.png) · [当前](visual-review/overlays-Dropdown、Popover-与-Tooltip-展开面进入视觉回归-chromium/ui-elements-popover-open-actual.png) · [差异](visual-review/overlays-Dropdown、Popover-与-Tooltip-展开面进入视觉回归-chromium/ui-elements-popover-open-diff.png)
- **ui-elements-tooltip-open**：[旧基线](visual-review/overlays-Dropdown、Popover-与-Tooltip-展开面进入视觉回归-chromium/ui-elements-tooltip-open-expected.png) · [当前](visual-review/overlays-Dropdown、Popover-与-Tooltip-展开面进入视觉回归-chromium/ui-elements-tooltip-open-actual.png) · [差异](visual-review/overlays-Dropdown、Popover-与-Tooltip-展开面进入视觉回归-chromium/ui-elements-tooltip-open-diff.png)
- **ui-elements-combobox-open**：[旧基线](visual-review/overlays-Select-与-Combobox-使用统一-Popup、键盘和选中状态-chromium/ui-elements-combobox-open-expected.png) · [当前](visual-review/overlays-Select-与-Combobox-使用统一-Popup、键盘和选中状态-chromium/ui-elements-combobox-open-actual.png) · [差异](visual-review/overlays-Select-与-Combobox-使用统一-Popup、键盘和选中状态-chromium/ui-elements-combobox-open-diff.png)
- **ui-elements-select-open**：[旧基线](visual-review/overlays-Select-与-Combobox-使用统一-Popup、键盘和选中状态-chromium/ui-elements-select-open-expected.png) · [当前](visual-review/overlays-Select-与-Combobox-使用统一-Popup、键盘和选中状态-chromium/ui-elements-select-open-actual.png) · [差异](visual-review/overlays-Select-与-Combobox-使用统一-Popup、键盘和选中状态-chromium/ui-elements-select-open-diff.png)
- **reference-resources-desktop**：[旧基线](visual-review/reference-resources-Reference-Resources-视觉基线（桌面全页）-chromium/reference-resources-desktop-expected.png) · [当前](visual-review/reference-resources-Reference-Resources-视觉基线（桌面全页）-chromium/reference-resources-desktop-actual.png) · [差异](visual-review/reference-resources-Reference-Resources-视觉基线（桌面全页）-chromium/reference-resources-desktop-diff.png)
- **overview-desktop**：[旧基线](visual-review/visual-Overview、Reference-Form-与-Settings-真实页面进入视觉矩阵-chromium/overview-desktop-expected.png) · [当前](visual-review/visual-Overview、Reference-Form-与-Settings-真实页面进入视觉矩阵-chromium/overview-desktop-actual.png) · [差异](visual-review/visual-Overview、Reference-Form-与-Settings-真实页面进入视觉矩阵-chromium/overview-desktop-diff.png)
- **mobile-navigation-open**：[旧基线](visual-review/visual-移动侧栏打开状态纳入视觉回归-chromium/mobile-navigation-open-expected.png) · [当前](visual-review/visual-移动侧栏打开状态纳入视觉回归-chromium/mobile-navigation-open-actual.png) · [差异](visual-review/visual-移动侧栏打开状态纳入视觉回归-chromium/mobile-navigation-open-diff.png)

共 15 张差异图，分布于 11 个视觉测试；另 7 个非视觉失败单独补跑，不用基线更新掩盖。
