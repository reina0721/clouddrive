# 交互与生命周期

FilesPort新增窄FileClipboardPort：订阅稳定snapshot，set(mode,entries)、clear、paste(destination)。snapshot包含mode、entries及pending；Host闭包拥有最多100项的不可变快照，绑定runtime原owner。dispose先清空并通知，再释放订阅。公开写入与异步返回核验assertCurrent；订阅读取在owner切换卸载窗口返回稳定空快照；set/clear在pending时拒绝。粘贴先通过detail重读全部目标及有效祖先，目标自身/后代或同父移动等非法计划拒绝；实际copy/update仍决定并发冲突/权限。每项串行，移动成功移除、复制成功保留便于再粘贴，失败携带原错误对象返回，Surface只显示受控FilesError码和条目名，不打印敏感错误文本。全局取消/owner漂移停止后续项；没有伪原子承诺、不自动重试写入。

Surface用useSyncExternalStore订阅；待处理栏展示复制/剪切数、名称、粘贴及清空，粘贴仅有效普通目录、无搜索/分类/回收/加载中可用。右键、批量栏与Ctrl/Cmd+C/X/V进入同一port；保留原立即复制dialog，不混淆待处理语义。剪切源项淡化但不预先移动，成功只保留失败源项。

文件导航抽成局部组件复用同一render：桌面固定宽、sticky独立滚动；移动仅显示工具栏按钮，由现有left navigation DrawerSurface管理焦点与Escape。导航动作关闭浮层，根/分类调用既有navigate，其余FileLink保留真实href与修饰点击。保留Host既有skip link，不重复计数；空目录提供直接选择上传入口并复用队列，主区仍原id/tabIndex。

工具栏保留语义label，视图/排序集中既有MenuButton，祖先菜单展示完整路径并跳转；末级长名截断且title保留。上级按钮与Alt+Up只在有效有parent目录可用。搜索框Escape恢复已提交值，清空会更新真实URL而非仅删输入；结果行显示当前范围和total。当前页选择菜单清空/全选/反选只操作visibleIds，选择统计只汇总文件字节。

文件影响：Surface model/clipboard契约及files-page、局部导航/工具栏组件、icons、lazy消息；Host clipboard实现、runtime注入与快捷键；相关前端测试和browser文件；当前使用authority。后端/migration/依赖不变。验证在20项接线标记后开始：Host所有权/并发/失败/资源，真实跨目录文件复制移动、同名冲突、剪切部分成功、输入隔离、移动端抽屉/焦点/截图、已有18条流程、类型/lint/build/性能与契约门禁。两套SQLite先备份，冻结126预览；最终重启两套最新服务并核验旧行保留，精确commit/push。
