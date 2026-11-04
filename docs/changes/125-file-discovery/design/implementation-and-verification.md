# 实施和集中验收

基线7aeded2。实施入口只比较revision、Git路径和研究刷新触发器；未漂移则执行I01–I05，不重复选型或全仓审计。先一致性备份普通与独立预览SQLite，使用已验证的.next/124-production冻结4180前端，保留8120后端及数据；新QA用独立目录和未占用端口，不能接管原用户进程。

文件影响：service query/列表实现、Repository.ReadBounded及现有测试仓储、files配置defaults/Policy、Huma输入与响应和生成契约；Surface files的search/view schema、Route/FilePage与语义组件/i18n，Web Host query/prefs/键盘与焦点。没有SQL迁移、依赖声明、IAM权限或公开分享协议变更。删除已替换的无界List加载、重复默认偏好和废弃列表分支，不保留旧新搜索并行运行。

用户要求每批20项完成后集中测试，I02–I05期间只允许源码查看、格式化和diff检查，不提前执行本批功能测试/类型检查/构建。20项齐备后：Go分层/全量/vet、API golden与生成新鲜度，前端unit/type/lint/build/boundary/foundation/dependency/docs及本任务格式检查；失败修复按影响范围回归。

真实HTTP/SQLite验证关键词/Unicode/大小写/all-any、三类scope/祖先回收、kind/扩展/字节/UTC边界与逆序、稳定排序/分页/越界/占用、两owner及当前权限、预算溢出/取消。浏览器覆盖高级条件提交/取消/单项移除、URL刷新与历史、页码/大小偏好、缩略图开关、列表列显隐和owner偏好、Shift/修饰选择/方向键、桌面390px视觉与前100项回归。仅隔离fixture，不删用户文件。

通过后更新当前authority和唯一清单、重启最新两套服务并保存ignored访问资料；逐条比对批次前文件元数据，确认新入口认证可达、服务持续运行。按提交skill精确暂存且staged检查成功才Conventional Commit，实际push并核验；403如实记录，不更换origin、不伪造成功。
