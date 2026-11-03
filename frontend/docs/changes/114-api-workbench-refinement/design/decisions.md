# 最小修改设计

- 复用 Page、Panel、TabsView、DrawerSurface、Action、SelectField 与既有 semantic utilities，不新增公共 Element 或外观设置。
- 工作区按可用容器宽度降级：宽屏三栏，普通桌面请求/响应并排和项目抽屉，窄屏标签视图。项目树可收起。
- 不引入拖拽机制：先用自适应均衡分配和项目树释放空间满足常见任务，避免拖窄输入区。
- 历史可选 request/environmentId 字段兼容旧 workspace v1。记录解析前配置，认证密钥仅保留变量引用；不记录环境变量值快照。恢复独立内存草稿，保存追加新接口，保留原接口与草稿。原环境已删除则提示并使用无环境。
