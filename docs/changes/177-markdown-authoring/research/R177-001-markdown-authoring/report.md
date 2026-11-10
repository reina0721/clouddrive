# R177-001 Markdown 编写

实际查看 [Cloudreve 官方截图](https://docs.cloudreve.org/assets/file-apps-markdown-editor.BOHreTCc.png)。撤销、格式、链接、图片和表格在同一编辑工具栏。其[手册](https://docs.cloudreve.org/zh/usage/file-apps#markdown-编辑器)确认本地选择的图片存到文档同一目录。视觉参考来自官方实例截图。

R166-001 的源码输入、React Markdown 和 GFM 预览、安全图片读取与文本版本保存仍有效。本地图片有按名限定的直接父目录解析，约束单图 2 MiB，限制 8 张。`transfer-runtime.ts` 在现有 TUS 会话完成发布后公开结果条目 ID；文件列表会随完成计数刷新。目前 `TextDialog` 依赖实时列表，上传完成可以卸载编辑器。现有读取授权和路径约束由 R121-001 支撑。

保留已有解析库和文本保存，不接管持久文件格式。MDXEditor 或其他所见即所得编辑器会新增 Markdown 双向解析、浏览器依赖和保存等价性风险；本批用受控文本的显式变换，依据 [GFM 规范](https://github.github.com/gfm/)生成格式，并复用现有传输与签名检查。若后续接入所见即所得、剪贴板图像或跨目录引用，复核格式丢失和权限边界。无新增依赖、数据库及 API。
