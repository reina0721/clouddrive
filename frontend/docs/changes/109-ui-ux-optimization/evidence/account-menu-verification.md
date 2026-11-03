# 账户菜单验证

2026-10-09。方案、消费者与边界见[专项审查](../design/account-menu-review.md)。

实际浏览原账户菜单与TailAdmin Dropdowns完整状态；新版CUA语言二级选择即时生效并关闭。
专项覆盖320/390/1440/2048宽度、分组/选中、语言刷新保存、主题dark/system响应、键盘
层级与焦点返回、触摸/短视口、外部关闭、鼠标跨层和滚动后sticky定位；截图在account-menu/。

中间失败用于修复窄屏邻接越界、Header装饰头像重复ARIA名称、缩放入场与聚焦滚动冲突。
几何检查使用默认超时重试条件，无固定等待或边界放宽；主题断言消费现役data-theme。
验证过程中尝试固定定位与关闭自动聚焦，均暴露真实回归，已撤销；最终保留HeroUI生命周期。

账户专项8项全部通过（20.9秒），日志为account-menu-browser.txt；新增键盘Home/ArrowDown/
Enter选择、选中项聚焦、Escape层级返回、操作后触发器焦点与document滚动不变断言。
320/390/1440/2048截图已人工检查布局，窄屏向下层叠、桌面邻接翻转符合当前信息架构。
补充权威示例验证1项通过（account-menu-authority.txt）：同源分组/选中/禁用/动作/Axe，
新增状态标签具备双语映射，截图authority-grouped.png归档。全部账户专项共9项。
首次完整检查：383单元、治理/类型/构建/原预算通过；309浏览器306通过、3失败。
其中两项包含视觉差异，一项是comfortable+大字号320px下顶部触发器溢出；旧Popover
测试还假定只能向下展开。最终移动端隐藏装饰箭头，document宽度实测恢复320；
定位测试严格检查上下翻转、完整视口边界和实时锚点，不放宽阈值。

最终源码相关复验14项：12通过、2仅截图失败，四个错误全部为截图；账户9项与
全部九Family的三密度dark/English/大字号边界均通过。日志account-menu-current.txt。
新对照共4项：Menu、Popover、Tooltip打开态和Overlay Family（增加同源分组示例）。
[人工复核对照](account-menu/visual-differences/index.html)已归档，原golden保留。
旧Scroll Reveal的28项已获确认并完整复验；其授权不扩展到本轮4项。
本轮4项按AGENTS §10人工确认后才能更新。

## 人工确认与最终复验

用户明确回复“确认这 4 项，更新并复验”。更新前逐项验证现有golden与对照expected的
SHA-256一致，唯一目标位于e2e目录；仅复制已审查的4项actual，不批量生成其它基线。
原expected/actual/diff保留，前后hash见account-menu/approved-baseline-updates.json。
最终源码生产构建、原性能预算与Lint通过：initial374517B，maxRoute437039B，
union907658B，CSS47803B。未引入新运行时依赖，格式/文档/diff检查通过。
批准后的完整检查account-menu-check-approved.txt：383单元、310浏览器全部通过（15.6分钟），
架构/依赖/生成物/Lint/类型、生产构建和原性能预算均通过。完整命令最后因新对照HTML
未格式化退出1；仅格式化该证据文件后，补跑format:check、docs:check与diff检查通过。
不把完整命令退出码改写为0，全部质量门禁以完整运行及末尾修复复验共同构成。
本轮未提高像素阈值、放宽Axe规则或批量更新未批准截图。最后一次运行生成的历史路径
证据另存account-menu/final-run，原历史截图恢复；当前账户截图与审批对照保留。
