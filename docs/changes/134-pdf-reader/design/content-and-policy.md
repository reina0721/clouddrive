# 内容读取、预算和资产

## 现有设施复用与有界读取

继续使用同一个createJsonClient及IAM/同源代理。将公开读取已有的流式上限/reader.cancel/release算法提炼为Host API内部有界Blob读取器，使用自有limit/取消/清理错误；公开文件读取保留FilesError映射并删除重复循环。JSON客户端增加显式maxBlobBytes读取选项与limit错误类别，仅有界消费者启用，不另建带Cookie/CSRF的fetch实现。

私有readDocument先检查source是本人有效PDF、大小及expectedRevision；有界读取后复查detail/版本和账号。长度不一致、同长度覆盖、回收或身份变化都不能交付旧请求结果。历史使用明确revision的既有内容入口，有界读取并保留原归属检查。原生下载仍使用原路径，不把阅读预算当任意文件下载禁令。

## 配置与契约

files.pdfReader集中拥有客户端reader政策，严格绑定、只允许正值并不超过默认上界，RestartRequired。默认：maxPages500、maxCanvasPixels4194304、maxImagePixels8388608、maxOutlineEntries500、maxOutlineDepth16、maxThumbnailPixels65536、maxThumbnailBytes524288、workTimeout30s、workerReadyTimeout10s。源沿用maxMediaBytes（默认32MiB），导出受同一文档字节上界。侧栏至多8个缩略图是界面批次，不代表文档页数上限。

普通Listing和VersionPage提供严格typed PDFReaderLimits，时间以ms明确传输；Surface schema拒绝缺失/非法预算，不在读取失败时自行填默认。旧测试fixture按当前契约明确补齐。无迁移，不改schema12，不清理用户数据，不新增兼容分支或第二套策略来源。原生operation总数仍154，但code-first schema及console投影必须重新生成。

## 静态资产与构建

pnpm固定安装pdfjs-dist6.4.299（实际分发engines兼容本项目Node>=22.18）。准备脚本从锁定node_modules的声明文件和目录复制必要display/viewer/worker/CMap/字体/WASM/CSS/许可，转译本项目frame源码，生成ignored public/file-viewers/pdf目录与内容摘要manifest。禁止运行时CDN、任意包目录穿透、复制sandbox或用户文件；生成前核对版本，目标必须在固定generated根内。build和dev在启动前执行同一准备路径；删除/更换版本时只清理已验证归属的生成目录，不删.next或源资源。

PDF应用的同源CSP/header由明确前缀限定，不放宽其他页面。当前全局路由435KiB、初始400KiB、chunk200KiB和CSS48KiB预算不提高。PDF仅在打开后请求的独立frame资源另受预算：核心+viewer JS gzip合计512KiB，worker gzip1MiB，样式64KiB，静态资产总40MiB；记录实际字节与来源。普通文件/登录页不得加载PDF解析器或worker。此为新增文件应用运行资源而非把原主应用CSS移到漏测目录，主应用现有检查与新增资源检查都必须运行。

## 验证与交付

全部20项接线后才开始生成、构建和测试。使用项目自有、多页、有实际文字/矢量图/内部链接/大纲的PDF以及公开测试密码的加密夹具；验证真实canvas、文字选择、搜索条件/结果、页码/旋转/比例、缩略图、大纲、内部历史、密码重试、三类标注及导出副本再解析的实际结果。不以网络mock/按钮存在替代端到端证据。

负向覆盖超源预算、压缩大图像/超页数、损坏PDF、旧nonce、Worker失败、无假Worker、流式超额及清理错误、同长度源更新、账号切换、超时终止和URL/worker/frame释放。检查禁脚本/外联与CSP、中文/英文、深色、320/390宽度、键盘与Axe。保留可诊断结果，不声称OCR或所有用户PDF本体都具备可访问结构。

运行适用Go、Host/协议、类型/lint/边界/foundation/依赖、生成物、生产构建、双重资产性能及相关原文件/版本/归档回归；只宣称实际执行范围。检查原数据库一致备份与条目摘要，按拥有的PID/启动时间重启两套最新服务，核对生产路由8120、允许来源4181、前端代理登录和新功能，保持运行。临时资料保存.data/134-preview-guide.txt等，提交显式范围并用已有reina0721凭据无交互推送，复核远端revision。

## 集中验证安全修正（R134-002）

19条现有production依赖公告命中触发已记录的依赖刷新，R134-002门禁通过。当前goal明确授权直接实施，无中途审批；S134纳入本批修正：Next全部声明16.4.5、Zod全部声明4.6.6，Ajv>fast-uri3.1.9与PostCSS>source-map-js1.2.2的窄覆盖，sharp由新Next官方范围升级。保留成熟架构与公开契约，不新增业务能力/接口或迁移。修复后重跑前端单元、类型、规范、依赖、production audit、双生产构建和性能、PDF及相关文件回归、视觉，最终重新启动最新服务。不将旧构建测试当作新依赖已验证。

R134-003门禁通过：I134的编辑命令等待真实SDK完成事件；图像预算保留SDK省略语义并在阅读窗口明示，不承诺完整还原超限图像，删除不能保证的严格失败说法。源/页数等超限保持失败，不提高任何预算。共享HTTP客户端limit保持独立错误，三个非Blob身份调用方原样传播；不引入新的身份状态。
