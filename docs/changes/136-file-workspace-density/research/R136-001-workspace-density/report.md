# R136-001 研究报告

问题：用户要求通过真实视觉分析改善与Cloudreve的差距。已复用R131-001的六页共享Shell、R125-001的文件视图边界；R132-001只证明历史通用截图归因，不证明当前密度合理。本次在a977aab上定向查看真实源码与浏览器，不重做既有后端研究。

事实：参考文件首页是空目录，显示紧凑导航、稳定工具与大面积内容区，存储卡在导航下方可见；不能据空目录推断有文件时的所有交互。参考偏好页有时区、版本保留、视图同步和目录点击设置，这些仍为后续功能缺口。本地首页真实48项，截图中卡片很高、侧栏与整页各有滚动条、品牌被截断、存储在首屏外。证据截图只放.data/136-visual，不保存参考凭据到仓库。

代码证据：FileWorkspace使用两层min-h-screen、内容自然流与宽搜索；ExplorerNavigation独立h-screen sticky overflow；导航py-2.5加间距；PinnedLinks和Storage顺序自然流。FileItem使用大块上下留白；FilesPage普通网格最多4列，根目录仍渲染禁用的上级入口。Page与Toolbar公共布局不提供局部density参数。推断：在files内改Flex可分配空间、缩小局部留白和改条目排版足以改善，不需要新布局引擎。

分类与选型：这是项目特有表现Composition，无新通用能力、无外部系统接入。保留现有React19、HeroUI Adapter、Tailwind4语义utilities与filesAccentStyle；采用已有size=sm和项目原生HTML布局容器。第三方维护、安全、许可证和版本不变，不引入依赖。拒绝穿透HeroUI内部DOM、arbitrary value、全局Token调整或扩展公共默认组件；这些会扩大调用方和回归范围，当前无必要收益。现有Surface/Host边界适合承载；DOM焦点仍通过现有Host Port，Surface不增加document/window/Storage或第二套导航。

资源与失败：无新资源、进程、数据库结构或后台任务；原有Abort与错误展示不变。视觉调整不能隐藏出错状态、禁用项或小屏操作，不能用不可访问的hover-only菜单替代真实动作。新方案替换对应局部布局，不留旧布局开关。

适用：私有六页共享Shell与FilesPage条目。非目标：访客页面全量改版、账户偏好与版本保留、Office等后端功能。局限：参考为空，无授权写入样本，不能宣称复制全部参考行为。研究门禁通过：代码与视觉足以形成局部计划；基线后相关布局、Adapter契约变化才定向刷新。
