# 界面、文件影响及集中验证

FilesPort新增VersionsPort，Host沿唯一JSON client及assertCurrent注入；Surface仅接收typed元数据/文本/动作，原生下载和媒体Blob仍Host拥有。FileMediaProps可带指定version，沿同一MediaRenderer和串行readMedia读取版本地址；切换版本/关闭时AbortController、Blob URL和播放器按既有生命周期释放。媒体与文字预算由版本列表返回，不偷偷回退默认。

历史drawer列当前与过去版本，支持顺序、每页5项、分页、选择、元数据和空间；当前不能删。恢复、另存、删除/批量清理有明确确认和pending状态；版本/历史CAS失败保留选择和草稿，可显式刷新。文本preview使用pre；图片/音视频复用Media，超限给下载提示；并排比较明确两个revision和标签，不声称自动diff。所有新文案按原FilesRuntime lazy双语加载，不扩大登录同步资源。文件菜单与属性可进入历史，目录/shortcut无假入口。

文件范围：Model history、repo entry_record映射、Service版本规则与全部内容替换/复制/配额位置、config/binding/Handler/HTTP content及migration v10摘要；TransferRequest/summary/Repo发布及Host传输状态/重选；Surface版本schema/port/drawer/media可选version、Host下载/预览adapter与lazy文案。API/OpenAPI/operation inventory随真实操作生成，原115+6=121；若实际注册数不同按事实更新，不伪称测试通过。无新增第三方依赖。

先两套SQLite一致性备份，冻结已验收127生产前端；记录增量基线后实施20项，齐备标记前不运行功能测试。集中验证Go模型/Service/Repo和真实HTTP/SQLite：v9升级、down guard仅合成库、保留开关/预算/owner/损坏JSON、全部文本/tus/WebDAV写路径、CAS/并发/取消/历史泄露负向、复制历史与配额、回收恢复。浏览器真实旧文本/图片下载、上传覆盖/暂停重选、恢复前后字节、同名/双窗口冲突、批量清理、比较、桌面/390px与原22条流程。生成新鲜度、Go test/vet、前端unit/type/lint/build/性能/架构/文档门禁按实际证据记录，保留失败与定向修正。

完成重启普通4173/8080/9090和预览4180/8120/9120，保留原文件逐条与备份比较；ignored访问资料刷新并只读视觉检查。精确Conventional Commit及实际push；403独立记录，不改remote或强推。当前goal覆盖直接实施，不逐批审批。
