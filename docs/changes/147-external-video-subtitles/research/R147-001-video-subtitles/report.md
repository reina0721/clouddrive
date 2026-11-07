# R147-001 视频外挂字幕

## 证据

- 参考账号的“视频”分类为空。官方文档及截图显示播放器标题附近有字幕菜单，支持自动加载同目录同名 ASS/SRT/VTT、切换轨道和关闭，ASS 样式不随文本转换保留。参考站和官方截图保存在本地忽略目录。[Cloudreve 文档](https://docs.cloudreve.org/en/usage/file-apps#external-subtitles)
- 本项目 Host 的 `FileMediaView` 使用原生 video/audio，支持当前视频、历史预览和公开分享渲染。私有 Host 已能在同一账号查找指定目录的后缀文件，也能按流实际读取字节及取消。当前无字幕。
- HTML 原生 TextTrack/VTTCue 负责播放时间、暂停、跳转和全屏字幕。标准 API 不解码 SRT/ASS，也没有单独的外部服务依赖。[WHATWG HTML](https://html.spec.whatwg.org/multipage/media.html#text-track-api)

## 选型与局限

保留原生播放器和私有 Host 文件访问。Cloudreve 使用的 ArtPlayer 具有字幕及播放器插件生态，替换现有生命周期会扩大公共与历史预览、键盘及媒体控制改动。只采用其产品交互证据。[ArtPlayer](https://github.com/zhw2590582/ArtPlayer)

固定 MIT 许可的 `subsrt-ts@2.1.3`，官方 npm 包 2026-10-28 发布，含 TypeScript 声明、纯 ESM、零运行依赖和发布证明，已查看实际 SRT、VTT、ASS 解析源码。独立第三方部署采用量有限。GitHub 安全页未发布公告，解析器仍有已注明的回溯风险，因此在可强制终止的独立 Worker 内处理有限输入，禁止 verbose 日志，丢弃元数据及样式，输出项目自有纯文本和时间契约。节点或 Go 无新增依赖。只覆盖 SRT 和 WebVTT 的 subtitle.js 不能满足 ASS；自研各格式解析没有产品专属价值。[npm 发布包](https://www.npmjs.com/package/subsrt-ts/v/2.1.3) · [安全页](https://github.com/rakuzen25/subsrt-ts/security)

自动选取当前视频同目录同基本名的字幕，保持浏览器播放控件。参考账号无媒体，实际非空视觉比较使用官方截图和本项目真实视频。样式设置、HLS、章节和内嵌字幕独立评估。
