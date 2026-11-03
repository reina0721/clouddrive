# 导航 no-op 生命周期需求

## 客户目标

用户位于某个 Route 时再次点击 Sidebar 中对应的当前菜单项，不应发生任何“重新导航/重新加载”，
也不应让 Top Progress 卡在 loading。导航生命周期对重复点击、真实导航、被中断/失败导航
都必须正确收敛。

## 使用场景与可验收行为

### 场景 A：当前 Route → 再次点击自身

- URL 不变。
- 页面不重新导航（不重新挂载页面内容、不触发 RSC 请求、不播放进入转场）。
- Top Progress 不出现。
- 不增加 pending navigation state。

### 场景 B：A → B 真实导航

- Top Progress 正常进入 pending 并在导航提交后完成收尾（completing → idle）。
- 页面正常切换并播放既定转场。

### 场景 C：导航被中断 / 失败

- 快速连点不同路由：进度不叠加、最终收敛为 0，不永久卡住。
- 导航失败（渲染错误）：进度条收敛为 0。

### 场景 D：等价判断语义

- 判断基于“最终 resolved navigation target”，不是 menuId/routeId。
- 正确处理 pathname（含尾斜杠规范化）、search（key 无序、值敏感）、hash。
- 同 resolved target 才 no-op；search/hash 任一不同仍是真实导航。

## 范围

- 覆盖 Shell 全部导航入口：Sidebar Leaf（展开态 + Compact Flyout + 移动端抽屉）、
  CommandMenu、MenuButton、Plugin Link / imperative navigate/replace、RouterTextLink、
  redirect 页（not-found、ui-elements 索引）。
- 生命周期完整化：no-op 短路、commit 观测（pathname/search/hash）、cancel/fail 收敛。

## 非目标

- 不改变 Top Progress 视觉设计、时长预算或“极快导航仍显示一次完整周期”语义。
- 不通过 timeout 伪装完成、不隐藏进度条、不加 Sidebar 专属 CSS/临时判断。
- 不改 Next Router 行为本身；后退/前进与外部导航仍由 commit 观测自然收敛。
- 不处理 101 延期内容（完整 Shell、Legacy Navigation、Host 路由迁移）。
