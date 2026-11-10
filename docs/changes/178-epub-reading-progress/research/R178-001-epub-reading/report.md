# R178-001 EPUB 续读与翻页

视觉检查使用 [Cloudreve 官方 EPUB 截图](https://docs.cloudreve.org/assets/file-apps-epub-reader.DYaT79St.png)，可见侧栏目录及双栏正文。其[文件应用文档](https://docs.cloudreve.org/zh/usage/file-apps#epub-阅读器)确认浏览器保留进度。参考账号没有可用于此批对照的书籍，实际界面证据来自官方截图。

R165-001 的 ZIP、spine、目录、栅格图片和文本节点边界已实现。`epub-dialog.tsx` 只有滚动、章节切换和本次打开内的字号，没有跨会话位置。文件 Host 已有按账号的设备偏好边界。

保留 ZIP 与可审查的节点模型。重新采用完整 EPUB 引擎会改变已核验的脚本隔离、样式和读取生命周期；原书 CFI 不能直接用于现有白名单转换后的 DOM。使用浏览器 CSS 多栏翻页、章节内相对位置和有界本机记录。跨设备同步或要求出版物原样式时复核引擎和协议。本机保存仅含位置、字体和书签，储存异常显式降级。依据 [EPUB 3.3](https://www.w3.org/TR/epub-33/)、[CSS 多栏](https://www.w3.org/TR/css-multicol-1/)和 [Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html)。
