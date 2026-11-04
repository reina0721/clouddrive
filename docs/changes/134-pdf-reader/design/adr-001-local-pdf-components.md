# ADR-001：PDF.js组件与独立文件应用资产

状态：已确认；依据当前goal直接实施授权，支撑R134-001。

选择pdfjs-dist6.4.299的成熟display/viewer组件。Host提供业务工具栏，PDFViewer/Find/Link/AnnotationEditor承担PDF算法；受控iframe隔离样式和清理范围，显式Worker承担解析，不执行嵌入脚本，不另建服务端转换器。不是通用文件应用插件框架。

未选择原生浏览器PDF，因为所需控制和测试不一致；未整体移入generic viewer，因为其完整应用生命周期、外部URL/文件打开、偏好与工具栏超出当前窄需求；未套React wrapper，因为不能替代上述业务边界。局部命令胶水有真实使用方和替换价值，禁止把第三方API全部照搬。

PDF的按需独立frame资产使用单独有限预算，原主应用预算保持。代价是新增资产准备、CSP和typed消息生命周期；收益是成熟文字/标注/查找、主应用不加载解析器、PDF CSS不污染Shell。SDK更新、安全公告、新格式/共享/原地写入或资源模型变化触发重新研究；未来替换只影响Host adapter与assets，不让Surface依赖SDK。
