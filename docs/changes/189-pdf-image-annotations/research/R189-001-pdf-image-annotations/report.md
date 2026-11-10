# R189-001 PDF 图片标注

[Cloudreve 官方界面](https://docs.cloudreve.org/assets/file-apps-pdf-reader.9gdBlUIa.png)将图片入口放在高亮、文字、手绘附近的阅读工具栏。对照项目 134 的桌面截图和 `e839c22`，本地工具菜单只装配文字、高亮和手绘。图片标注与导出副本是具体缺口和现有承载点。复用 [R134-003](../../../134-pdf-reader/research/R134-003-sdk-boundaries/report.md) 的 SDK 模式就绪事件和独立工作期限。

当前 [PDF.js 6.4.299](https://github.com/mozilla/pdf.js/releases/tag/v6.4.299) 的 StampEditor 支持移动、缩放、撤销和序列化。SDK 公开的 AnnotationEditorLayer.createAndAddNewEditor 支持插入对象。固定版本的 StampEditor 构造参数 `bitmapFile` 和异步初始化表现通过已安装发行包及 [同版本源文件](https://github.com/mozilla/pdf.js/blob/v6.4.299/src/display/editor/stamp.js)确认。宿主沿用 R188-001 已验证的受限栅格解码，避免直接调用 PDF.js 的无业务上限文件选择器。

浏览器 Canvas 本身不能产生标准 PDF 注释或与现有撤销、重做一致的对象。另引 PDF 写入依赖会重复当前序列化和权限、文档加密及附件边界。结论为保留项目既有 PDF.js 与 frame 装配，使用其图片编辑器，新增窄的本地导入命令，无后端、依赖、迁移或文档读权限变化。外部图片 URL、签名认证、替代文本编辑器和公开 PDF 读写需要另行研究。
