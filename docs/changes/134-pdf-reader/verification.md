# 集中验证与交付记录

基线78b41c600130078bddf5a4f844a3af74c4b06aa5；F261–F280共20项全部源接通后写入ignored .data/134-wiring.json，随后才开始本批生成、构建与测试。既有260项不重复计数。研究依据R134-001、R134-002和R134-003，任务状态以[tasks](tasks.md)为准。

## 实际验证

- Go：go test ./...、go vet ./...通过，记录.data/134-go-delivery.log和.data/134-vet-delivery.log。新增策略覆盖所有大小/时限上界与零值；无新migration、仍154个native操作。
- 前端：pnpm test全工作区669项通过（Host265项），typecheck、全量lint、architecture:check、foundation:check、dependency:check及四类codegen新鲜度检查通过。证据.data/134-{unit,typecheck,lint,architecture,foundation,dependency,codegen}-delivery.log。
- PDF浏览器11场景通过（.data/134-pdf-delivery.log）：真实字节/文字层、选择、40/10/30个查找结果与清空、页码边界、缩放/旋转的实际画布、8+2真实缩略图、大纲/内部链接/位置历史；错误密码重试；501页拒绝；真实文字、高亮和手绘、撤销/重做、未导出关闭保护、导出后再次编辑；历史revision与当前不同；阻断Worker模块加载后明确失败且不回退假Worker；资源按需、关闭Worker退出；320px/深色/英文与Axe；后台真实上传刷新后草稿仍在。
- 导出验证：浏览器下载并重新上传含文字标注副本后可重开；独立pypdf解析两个导出文件均10页，分别存在/FreeText与/Ink、/Highlight（.data/134-export-parse.json）。没有将改名原字节冒充导出。
- 图像边界：4MP红色图像实际canvas中心像素为红色；9MP图像按SDK预算省略且中心为白色，界面显示上限与下载原件提示。不是整份文档硬拒绝，详见R134-003。
- 原文件回归13组共55个不同场景通过（.data/134-regression-summary.json），含文件/媒体、版本9、压缩7、工作区8、分享、标注、连接、筛选、离线下载、文件操作、导航及33MiB真实分块暂停重选续传。最终workspace布局与PDF修正后另重跑压缩、版本和工作区，不重复计数；最终补跑压缩7例、版本9例、工作区8例全部通过（.data/134-delivery-{archives,versions,workspace}.log）。
- production依赖audit由原19项告警降为0（.data/134-audit-delivery.json），采用Next16.4.5、Zod4.6.6与两项窄传递约束，详见R134-002。不是对所有未知漏洞或开发依赖零风险的承诺。
- 主与QA生产构建分别.next/134-delivery-primary、.next/134-delivery-qa通过；保持原性能预算，initial346378、最大路由/login440326、union2123603、CSS49090、最大chunk78135字节，两产物一致。PDF独立296资产、总5938575字节，gzip core211752、worker377994、CSS25875；SDK不进入普通登录/文件首屏资源。证据.data/134-performance-delivery-{primary,qa}.log与134-assets-delivery.log。

## 视觉审阅与实际修正

只读查看用户给出的Cloudreve，文件列表为空，管理页版本4.19.1；没有向外站上传或修改配置，PDF能力依据官方文件应用说明和本地真实PDF，不声称参考站PDF逐像素比对。最终桌面、320px、深色英文截图已人工审阅，见ignored .data/134-pdf-reader-{desktop,mobile,dark-english-desktop,dark-english-mobile}.png。

集中测试发现并修正：自定义l10n必须translate使真实文字编辑器有布局；SDK编辑模式异步就绪必须等事件再允许输入；读取策略对象随后台列表刷新变化曾重开frame，现将本次会话预算固定；查找进度需等最终计数再结束pending，清空需真实findbarclose；显式外部Worker的SDK promise不代表模块已加载，现以自有bootstrap就绪后才接SDK；导出后的撤销仍需比较annotationStorage序列化hash，不能依赖一次onSetModified；工具栏窄屏横向滚动，保留页面视口。测试的跨页批注层定位和手绘目标/动作就绪也已修正，没有关闭断言或降低预算。

## 数据、运行与限制

一致备份.data/134-delivery-baseline.json。两原库0/120条目、schema12；重启后的条目数量和逐行摘要一致。QA每组独立新库；没有在主库上传夹具或批量验收。最新二进制与生产预览、普通开发前端均已重启并保持运行，主4181、开发4173，不占用其他项目4180。鉴权列表等7项、页面/代理4项、原压缩入口4项、PDF资源CSP/策略1项共16运行检查通过（.data/134-runtime-receipt.json）。凭据/Token仅ignored .data/134-preview-guide.txt与preview-access.json。

只验证Windows/Chromium；未做本批Linux运行、跨浏览器、全站423例、race或完整pnpm check，不将局部通过扩大为全部Cloudreve对齐。PDF.js预算不能保证浏览器硬堆上限或抢占同步解码；没有OCR、Office、ePub、公开分享PDF、原地保存或跨会话草稿。ACL、BT/magnet、远程节点、WebDAV锁等goal差距仍待后续批次。

收尾门禁：文档guard及本次手写前端文件格式检查通过；Next16.4.5在dev启动时将Web AGENTS自动生成块标题从一级改为二级，已核对其generate-agent-files.js，与依赖升级一起记录，不修改项目手写约束。

提交检查发现ReportLab PDF被Git当作文本；已仅将本批PDF夹具标记为binary，保留原始字节和xref偏移，不清理PDF内部空格。其余手写/生成代码的cached diff检查通过。
