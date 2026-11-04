# PDF承载研究

## 问题、方法与快照

当前goal要求向Cloudreve补齐真实能力，每20项全部接通后测试、提交推送并保留最新预览。先检查Git与根范围authority，定向读取FilePage预览分派、FileMediaView、FilesRuntime、版本预览、createJsonClient和公开内容有界读取，再复核官方PDF应用、PDF.js6.4.299源码/发布、安全公告及npm实际分发元数据。没有先安装依赖、修改实现、生成或运行新功能测试。

## 已证事实

- 基线78b41c6的FilePage只把image/audio/video送到FileMedia；其余送文字，PDF没有独立渲染。FileMediaView只支持受控栅格及浏览器原生音视频。版本预览也按相同MIME分派。不存在PDF依赖或reader实例，不能把下载PDF称为阅读。
- Host通过FilesRuntime注入renderer，拥有Content读取、账号围栏与浏览器资源；Surface公共契约不应携带第三方PDF对象。当前私有readMedia只在完整Blob后比较长度，不适合直接作为新增PDF的流式预算证明；公开readPublicBlob已有受控读取、cancel/release及主/清理错误保留，可提炼为Host传输内部能力，不能另建认证客户端。
- Cloudreve官方说明有PDF.js阅读器；参考站本人目录当前为空，不能假称已浏览其真实PDF。参考站只读，不上传验收文件。官方截图/应用说明作为文件应用视觉和行为依据。
- Mozilla6.4.299于2026-10-03发布，现为latest，Apache-2.0。源码构建项目要求Node至少22.22.3，但npm分发包实际engines为至少22.13.0或24；本项目>=22.18满足分发包，当前Node24.19.0满足，不因源码构建工具链要求擅自升级项目Node下界。npm无必需runtime依赖，有可选@napi-rs/canvas；浏览器接入不执行Node canvas分支。
- 2026公告CVE-2026-16633在6.2.108修复，涉及开启PDF scripting且缺少CSP。本方案选择更高版本并不接入PDFScriptingManager，不复制sandbox执行模块，关闭XFA，frame采用禁止普通eval及外联的CSP；不把固定版本单独称为完整隔离。
- 官方PDFViewer、PDFFindController、PDFLinkService、AnnotationEditor和PDFDocument.saveDocument已覆盖渲染、文字、搜索、导航、标注及副本字节。Viewer支持画布像素限制，并要求定位明确的容器。GenericL10n可读取本地Fluent资源，保留中文/英文资源来源及许可证。

## 选型与承载比较（推断/决策）

| 候选 | 判断 |
| --- | --- |
| 浏览器原生PDF嵌入 | 无新依赖，但浏览器功能、密码和页面命令不一致，不能可靠提供本批行为；不作为默认。 |
| PDF.js完整generic viewer发布包 | 功能成熟，但为受控会话/预算/账号切换及本项目toolbar接入需引入额外发布zip/完整UI生命周期，成本大于复用其组件；不重造解析，但不用整套generic应用。 |
| pdfjs-dist display + viewer组件 | 维护/修复明确，Firefox使用的成熟技术；官方组件负责PDF算法、文字层、查找及标注，本项目只负责真实所需命令、状态、预算和Host注入，选用。 |
| React wrapper或其他PDF框架 | React wrapper仍需同一PDF.js及业务控制；增加依赖和生命周期分歧而无当前收益，不默认引入。 |
| Go/服务端转换 | 标准库没有PDF渲染，需要额外引擎和进程/平台/许可证治理；当前浏览器用例不获益，不把133受限归档worker扩成万能转换器。 |

保留IAM、Storage、版本和同源客户端；新增官方pdfjs-dist6.4.299、Host专属窄frame协议；提炼已有有界Blob读取到Host API内部并复用公开读取，单轨删除重复循环；静态资产按锁定依赖在build/dev准备，不从运行时CDN或外部文档服务读取。现有架构适合承载，但需要明确独立样式frame及资产生命周期，见设计和ADR。

## 资源、安全和适用边界

服务端files拥有配置及提供的reader预算；源沿用maxMediaBytes（默认32MiB），新增PDF页数、画布、图像、outline、缩略图和工作期限。Host先有界读取并复核当前源版本或旧版身份，再传可转移ArrayBuffer给frame，不把Cookie、CSRF、文件路径或下载URL交给PDF.js。一个窗口一套显式Worker，禁止假Worker静默回退；关闭、账号切换、超时必须销毁loadingTask、Viewer、Worker、frame、监听器、URL与定时器。

frame主要隔离样式/生命周期，不把同源allow-scripts+allow-same-origin称为安全沙箱；SDK不执行PDF脚本、外部链接/导航受控，文本只按文字呈现。浏览器Worker没有操作系统硬堆内存上限；像素/并发/页数和截止时间是实际限制，不能声称恶意PDF永远无法引起浏览器内存压力。嵌入式脚本不属于阅读能力，不提供启用开关。

现有主应用性能预算保持不变。PDF核心/worker/字体/CMap/WASM/CSS是仅打开文档才加载、在frame中使用的独立文件应用资源，应单列受控资产预算（不通过提高原435KiB路由或48KiB全局CSS预算接入），并验证普通文件页无PDF脚本/worker请求。npm总展开34.9MB提供初始分发体积证据，资产复制只允许声明目录/文件并记录sha与实际尺寸；完整源映射和未用sandbox不作为必需资源。

剩余运行差异（SDK分发导出、中文FTL、注解编辑事件、iframe销毁和浏览器实际字节）在全部20项接线后集中验证；若证据推翻接入路径或安全前提，定向返回研究并更新方案，不以空组件或禁用按钮冒充完成。研究门禁通过：当前缺口、使用方、成熟组件与资源接入路径已有可复核证据，剩余问题可由实施验证解决。
