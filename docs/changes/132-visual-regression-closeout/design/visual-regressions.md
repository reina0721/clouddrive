# 截图收口设计

仅修改Host auth/translations.ts两条注册说明、reference-resources.spec.ts截图前的业务就绪断言，以及经过审阅的8张现有PNG：认证320/1440登录注册4张、英文大字深色注册1张、Select/Combobox2张、reference-resources1张。若当前生成候选与原图无差异，不制造无意义替换。

参考资源测试等待h1、三条资源名称及查看链接数量，使用Playwright原生自动重试，不增加固定sleep或降低截图阈值。其它断言保持。截图候选先在ignored本机目录生成，检查后再写入既有基线路径；默认配置updateSnapshots:none保持，不新增第二套长期配置或Wrapper。

通过单独的4196/4197测试服务隔离Mock/后端协议fixture；已有4173开发与4181主预览持续运行，构建使用独立目录避免互相清理。资源归Playwright/本任务脚本，临时测试进程可关闭；用户预览重启后继续运行。没有迁移、依赖、API或模块边界变化。

验证保留现有无障碍、溢出、禁用和键盘交互；先生成候选再人工可见地逐图分析，然后按未更新基线模式重跑5个场景。执行适用lint、格式、文档、production build/performance，记录每次结果及完整门禁实际状态；读取原文件记录摘要复核未变。提交仅包含计划文件，访问资料继续使用ignored .data。
