# 当前视觉复核与限制

本页记录 109 当前渲染，未批准更新 Playwright baseline。

## 当前项目截图

- [手机外观设置](current-settings-mobile.png)：核心字段已进入首屏；主题说明在选项内
  纵向排列，短选项使用配置行，恢复操作移至次级区域。
- [桌面首页](current-home-desktop.png)：组件规范、页面模式、完整资源流程主入口；
  当前 Catalog 推导指标，唯一 Web Host。最近访问单区段占满可用宽度。
- [手机工作台](current-workbench-mobile.png)：顶栏在边界内；统计改为两列紧凑 outlined
  组合，桌面保留四列。详情在实际选中后使用同源 Drawer，截图不作为该流程通过证据。
- [手机详情打开态](current-workbench-detail-mobile.png)：使用现有 embedded 内容面，
  状态保持完整横排，长记录名自然换行。detail-focus-final.txt 证明实体一致、关闭后
  列表焦点/选择/可见位置保持、跨桌面恢复详情及打开态 Axe；像素截图不代替行为。
- [256px 短 Dialog](current-short-dialog.png)：截图展示初始滚动位置；正文及 Footer
  通过完整 Dialog 滚动到达，动作可达性由 short-dialog 行为测试证明，非仅凭截图。
- [手机 Fields](current-forms-mobile.png)：长目录已收起；保留当前 Family，本页索引
  指向组件标题。字段与开关有内部起始对齐。

## TailAdmin 校准

本轮检查具体 Modals、Tabs、Button Group、Form Elements、Data Tables 页面，
保留对应 `tailadmin-*.png`。只观察视觉层级/语义与状态，不复制源码、DOM、CSS、
图片或尺寸。新增 [Modal 打开态](tailadmin-modal-open.png)：标题/正文/动作区域清晰，
低噪声 Scrim 与独立浮层层级。Button Group 保持连续选项的边界；Data Tables
把搜索/每页控制与表格置于同一内容面，局部滚动承接宽数据。

本次 Modal 打开态曾因字体等待超时；使用 Playwright 已提供的截图字体等待开关后
取得像素证据。终端 Tabs、Form Elements、Notifications 重试曾导航超时，
日志见 `tailadmin-components-current.txt`、`tailadmin-matrix-current.txt`。
随后使用应用内浏览器成功复核，不再把这三个页面记为当前无法访问。

[当前外部矩阵](tailadmin-review.html) 保存 Basic Tables、Data Tables、Tabs、
Form Elements、Notifications 五页 × Light/Dark × 390/1440/2560，共 30 张截图。
已检查手机排列、桌面与超宽内容边界、表格身份与状态层级、字段说明区域、通知
主次动作，以及 Tabs 的 filled/underline/icon/badge/vertical 组合。

交互另存：`tailadmin-tabs-mobile-selected.jpg`（Customers 切换）、
`tailadmin-data-table-selected.jpg`（Next 到第二页与禁用）、
`tailadmin-table-search-dark.jpg`（查询）、`tailadmin-form-selected-dark.jpg`
（Radio 选中）、`tailadmin-date-picker-open-dark.jpg`（日期打开态），并检查
日期 Escape、静态 Error/Success/Disabled 字段。只观察，不复制实现或尺寸。

外部 Demo 只有其实际英文 fixture，不注入中文、不伪造 Loading/Error；中文扩张
和本项目 Pending/恢复状态由项目自身矩阵证明。30 张空间/主题截图不等于所有
控件全部交互状态均通过，107 人工视觉门仍保留。

## 人工与设备边界

当前快照与预期快照差异需逐张确认合理后才可更新，不能提高 diff 阈值。
真实 iOS/Android 触摸、软键盘、动态工具栏、安全区及原生 zoom 没有当前设备证据。
CSS viewport 和 Chromium 模拟验证只证明其覆盖范围。

## 差异复核入口

[原基线 / 当前渲染 / 像素差异](visual-diffs-final/index.html) 按快照名称列出完整
原尺寸图片；manifest.json 记录来源测试文件。历史 visual-diffs/ 保留早期差异，
最终结果只使用 visual-diffs-final/ 与 check-final.txt。未修改原快照或 diff 阈值。
