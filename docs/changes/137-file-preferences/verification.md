# 集中验证记录

状态：实施与集中验证通过，待完成提交推送；通用首轮失败及定向恢复分别保留。

## 本批范围

F321–F324：异步偏好、本机同步模式、显式读取服务器设置及账号隔离。F325–F329：目录覆盖、根目录、全局回退及记忆开关。F330–F332：全局默认、单目录和全部覆盖重置。F333–F334：完整视图字段及成功落盘后删除旧键的迁移。F335–F338：文件夹单击选择/打开、双击和键盘语义。F339–F340：整个文档revision CAS、冲突重载、失败不覆盖、异步弹窗保存。

20项是本批使用行为，包含既有视图能力的保存语义改善，不计为20项全新独立后端功能；项目累计仍为300项。目录树、时区呈现、版本保留策略、BT/magnet及Office未作为本批完成能力。

## 已通过的检查

- Go全量测试及go vet ./...通过，最终日志.data/137-go-full-lf.log、137-go-vet-lf.log；初轮137-go-full-final.log、137-go-vet.log另保留。原生API由源生成，当前160项operation。
- 最终前端全工作区单位测试694项通过（Web290），见.data/137-units-r5.log；包含偏好边界及发布/媒体恢复检查。当前IO相关14项单独通过，最终lint和类型检查通过。
- 最终QA及主预览生产构建通过，分别使用.next/137-qa-final-r5、.next/137-primary-final-r5；两者原预算检查通过：initial347591、maxRoute/login441539、union2198066、CSS49139/49152、largest78686、rawJs6743142。未放宽阈值。media-view随后仅作Prettier换行，并验证去注释后的TypeScript转译JS字节一致，无运行语义变化。
- 最终r5的discovery、preferences、publication、workspace共22项全部通过（4.4分钟），见.data/137-browser-recovery-r5.log。包含全部20项偏好行为、真实13图片上传/12缩略图、上传发布的繁忙注入/耗尽/手动恢复/下载字节，以及空队列与工作区回归。
- dependency、plugin/backend/contract/design生成新鲜度及文档门禁通过，日志.data/137-*-check.log。

提交前另发现新增SQL工作区为CRLF，但Git按.gitattributes保存LF，原校验清单与将提交字节不同。仅规范化六份新SQL及其checksum，语句不变；从暂存区逐文件复核全部84份迁移checksum通过（.data/137-staged-migration-checksums.json）。重新执行Go全量与vet通过，构建两个SHA256一致的LF后端，主/开发/QA三个实际进程身份均核对一致（.data/137-running-backends-lf.json）。三者重启后，原数据复核、17项运行检查以及真实偏好写入/未知字段/CSRF/CAS接口场景再次通过（.data/137-native-lf.log）。没有为修正行尾执行down、重置或重写既有迁移。

## 失败及恢复证据

初轮扩展83项为81通过、2失败：图片commit返回files_busy，随后空队列失败。保留.data/137-browser-isolated-final.log及trace。实际旧会话仍保留完整暂存，通过页面“完成保存”成功恢复，队列活动数归零，截图.data/137-recovered-upload.png；没有清空数据库或取消该文件冒充成功。

发布增加有界重试后，r4定向为10通过、1失败：13张均发布，但内容GET返回files_busy，缩略图仅11/12。由trace响应code和原生transferAdmission确认不是入口rate_limited；不提高通道容量。最终共用files Host局部0/1/3秒预算，媒体退避期间保持串行，取消/账号/epoch检查保留；媒体错误按实际码显示并可重试。r5实际13张发布、12张缩略图及F240均通过。

完整pnpm check运行423项通用UI：418通过、5失败，整体exit1，不能描述为全绿（.data/137-pnpm-check-r3.log）。其中账户离开、已登录跳转、页面标签和命令导航四项在不修改其源码、断言和等待预算的复跑中全部通过（.data/137-generic-recovery.log），保留首轮失败，不声称根治其时序波动。

剩余为组件展示页的旧视觉基线：旧图仍使用Community Console及早期菜单，而当前已提交源码为clouddrive和现有管理菜单。实际检查新旧图后，用户明确批准仅更新这一张。保留原1%阈值、updateSnapshots:none，定向复验通过（.data/137-approved-golden.log）。SHA256旧48823ee8503dacdb91e02ee9233dd55121bddd111cc2c87219d2752741c758da，新dd29062710ffe87b9ba0521f67444d14fb4218bb79d683079acca3e6bfee6d24；其余golden未动。该组合证据不等于再次完整运行423项。

其余62项文件回归首次使用重复测试后的137账号，两项目标文件夹不在根目录首页而失败；中止该轮并保留日志及数据。为新一轮建立独立files-only验收账号，未删旧账号或文件；新一轮62项全部通过（9.9分钟），见.data/137-browser-remaining-r5-fresh.log。受众另用QA管理员运行5项全部通过（52.8秒），见.data/137-browser-audience-r5.log。最终22+62+5共89项不同文件场景通过，不能用files-only账号冒充管理员权限覆盖。

## 运行与数据

原两库已做一致备份并追加files迁移v14。以所有既有files表、原列、原行排序摘要复核一致，不仅检查条目数量；凭据及认证会话正常变化不宣称为全数据库字节相同。主库120条文件记录、开发库0条原记录保持，证据.data/137-original-baseline.json和137-data-receipt-v14.json。

主预览4181、开发预览4173及QA4194已更新并保持运行；最终r5的17项认证读取、就绪、代理目标及PDF安全头检查通过（.data/137-runtime-receipt.json）。CUA在真实主账号登录后检查最终偏好弹窗，截图.data/137-main-preferences-final-r5.png；无测试文件写入原两库。访问说明与所有凭据只存忽略的.data。

磁盘不足时按用户授权清理官方Go编译缓存，释放约10GB；保留原.data、数据库、存储、源代码、运行程序与生产目录，回执.data/137-cache-cleanup.json。没有因磁盘问题要求再次批准开发。

## 限制与待收口

全工作区Prettier检查通过；首轮4份旧文档/工作区文件的行尾格式由Prettier规范化，Git无内容差异，未增加无关提交文件。已审阅58个预定文件及用户批准的单张golden，私有凭据逐值比对未命中；历史截图与Next环境生成变化已备份并恢复，未混入本批。待完成提交推送。136的并行QA登录500尚未归因，本批没有修改IAM登录，不声称已修复。窄屏Axe等待React Aria临时播报引用恢复到稳定态后扫描，没有排除节点或规则；此证据不保证上游短时悬空引用已消失。三驱动迁移已提供，当前实际运行数据及浏览器验收基于SQLite，不扩大为Postgres/MySQL运行验收。
