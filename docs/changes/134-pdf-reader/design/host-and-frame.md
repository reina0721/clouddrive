# Host与PDF frame

## 边界和职责

Surface新增FileDocumentProps/预算类型和注入组件入口，只携带条目元数据、普通策略及关闭语义，不暴露PDF.js、DOM、Worker、Blob或HTTPResponse。FilesRuntime显式注入稳定DocumentRenderer；当前文件和版本面板按PDF MIME/扩展名进入cover阅读窗口，原有文本/媒体/归档单轨保持。公开分享不注入私有文档renderer，也不宣称本批已支持。

Host的PdfReaderView懒加载，负责受控读取、版本/账号围栏、React工具栏、frame所有权与资源。内部frame只使用官方display/viewer组件，PDFViewer负责页面、文字层、查找、链接和标注，不复制PDF算法、查找或编辑器实现。界面控制只调用真实SDK命令，失败不变为成功。GenericL10n使用对应版本中文/英文Fluent原资源，保留其MPL-2.0头及源许可，与Apache-2.0 SDK资源分开说明。

frame采用本地固定HTML/ESM/CSS/字体/CMap/WASM资产，独立文档隔离样式，避免PDF样式污染主应用。允许脚本与同源是可信本地应用的装配选择，不当作攻击代码安全沙箱。CSP禁止外联、object、form和普通eval；只允许同源脚本/worker、必要的WASM编译及受控blob/data图像字体。PDFScriptingManager和sandbox执行文件不装配，XFA关闭，外部链接不启用。

## 数据与控制流

Host获取当前条目策略与受控字节，复核实际长度和PDF签名，等frame ready后以transfer list发送ArrayBuffer。只发送文档字节、语言/主题、预算和本次nonce，不发送Cookie/CSRF、内部路径、ObjectKey、下载URL或账户凭据。

postMessage为私有typed协议：会话nonce、请求ID、固定命令种类、合法数值/枚举及结构化结果。两端验证event.source、origin和当前nonce，拒绝未知消息与过期响应。密码仅对应本次loadingTask；不落URL、偏好、日志或服务器。所有错误转为固定类别，保留Host原因链，不向用户回显SDK原始错误正文。

命令覆盖页码、缩放模式、旋转、查找条件与结果、大纲目的地、内部导航、缩略图和标注/导出。大纲目的地保留在frame，仅向父级投影有界ID/标题/树，不传第三方dest对象。PDF内链接经PDFLinkService处理，内部导航历史只存本窗口的页位置。搜索使用PDFFindController，区分pending/完成/无匹配，匹配数来自真实事件。

缩略图按当前侧栏页至多8项发起，单个依次渲染，像素与PNG字节预算明确；父级只接收有界PNG字节并创建可回收URL。关闭侧栏或换页释放上一批URL。页面渲染由官方队列调度，关闭detail canvas，限制画布及图像像素，不能把500页解释成同时创建500张大画布。

## 生命周期与失败

每个reader只拥有一个明确创建的module Worker并注入PDFWorker，等待初始化；不允许PDF.js加载失败后回退主线程假Worker。读取、SDK/worker启动、解析、搜索、导出分别有截止时间；密码等待和普通阅读不等同后台工作超时。任务失败保留可诊断类别，必要时终止当前会话并提供显式重试，禁止无限重试。

关闭/账号切换/失效同时取消HTTP、销毁loadingTask和Viewer、终止Worker、移除frame/监听器/定时器、回收缩略图及导出URL；对回收失败保留主要与清理原因。frame移除是最后的强制生命周期边界。浏览器不能提供每Worker硬内存上限，页数/像素/期限是实际保证，不夸大为OS级内存隔离。

标注使用官方AnnotationEditor和AnnotationStorage，支持文字/高亮/手绘及SDK撤销/重做。修改状态以SDK annotationStorage.serializable.hash与最近已导出摘要比较，覆盖导出后的撤销/重做和既有编辑器再次修改；正在输入的未提交文字先保守保护。导出调用saveDocument，核对输出PDF签名/预算后由Host触发独立文件下载，不PUT原文件，也不增加服务器引用。存在未导出的变更时，关闭请求进入保留/明确丢弃确认；SDK缺少持久化证据不能标记F280完成。

## 文件影响

主要新增frontend/apps/web/src/files/pdf（Host adapter、frame、资源配置及协议），Surface files/pdf-contract契约和私有pdf-dialog；修改FilesRuntime注入、FilePage分派、VersionsPanel、懒加载双语资源。仅Host文件可导入SDK；frame的第三方类型不进入Surface或业务公共API。使用现有Action/字段/Drawer/Dialog，不绕过UI adapter。对应fixture及类型测试随策略变化同步。

人工视觉复核发现窄屏工具缩成竖排及阅读区域被宽边距挤压。DialogSurface增加可选workspace布局，由Adapter负责紧凑头/体/尾边距与完整可用视口，仅PDF显式使用；默认standard保持不变。阅读器内部工具条以max-content保留完整文字，在外层横向滚动，禁止压缩中文标识。此为已确认PDF视觉修正范围，不引入第二套Modal。

SDK的编辑模式setter异步完成，命令必须等待annotationeditormodechanged事件再确认，关闭取消等待，父会话操作期限覆盖等待。图像预算按R134-003确认的SDK省略语义明示，不以不可靠的stopAtErrors回执制造完整渲染保证。期限依赖浏览器/SDK协作让出，不承诺抢占单个同步绘制指令。

阅读会话固定打开时的预算快照；后台上传完成导致列表刷新不能重开frame或清空批注，新预算在下次打开时使用。
