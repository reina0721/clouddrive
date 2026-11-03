# 现有实现审查

- 原工作区在 4xl 容器阈值展示项目树，在 7xl 才展示横向请求与响应；常规桌面请求与响应纵向堆积。
- 历史仅保存已解析方法、URL 和响应元信息，恢复直接修改当前接口草稿。
- 外观由 Host preferences → html data attributes → Design System profiles 统一消费；支持 system/light/dark、四种强调色、密度、字号、内容宽度、动效与高对比度，无字体族/圆角偏好。
- 初始 WSL 缺 Node、Chromium 与 Linux 原生依赖；在 WSL 配置验证运行时，保留已有配置与缓存。

- 实际组合测试重现折叠导航内部横向溢出：compact width 包含两个 gutter，但 aside 的边框额外占用 1px，固定 group 宽度加 px-4 超过可用宽度。Host 导航改为居中布局与 px-3，保留原语义控件尺寸，避免裁切，不改全局 Token。
- 历史恢复测试发现项目树 activeId 与当前请求脱节，导致原接口已选中的假象和点击无响应。选择状态绑定当前请求上下文，外部恢复后重新派生。
