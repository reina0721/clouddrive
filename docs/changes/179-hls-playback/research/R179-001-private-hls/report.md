# R179-001 私有视频播放列表

实际查看 [Cloudreve 官方 HLS 截图](https://docs.cloudreve.org/assets/file-apps-video-player-m3u8.DC3gscGz.png)。视频下侧为进度和播放控制，右侧清晰度列表列出自动和多档分辨率。官方说明将相对/绝对文件路径解析为账号文件。参考站浏览器连接超时，界面证据来自官方截图。

基线使用 `FileMediaView` 和原生 video，视频应用默认只关联 MP4、WebM 和 OGV。R147-001 已实现按同目录查找字幕、切换与原生 TextTrack。私有文件列表、详情和指定修订的内容接口已经验证账号和可见性，内容接口支持 HTTP Range。分页查询在服务端有账号树预算，播放器不建立无限目录缓存。

浏览器原生 HLS 在 Chromium 覆盖不足，并无法拦截自定义请求进行私有路径解析。采用 Cloudreve 同类依赖 hls.js，固定 Apache-2.0 许可的 1.7.4。官方仍维护 1.6 及以上版本，安全页未发布公告，官方有定制加载器契约，包无运行依赖，有浏览器支持矩阵和上游测试。原生视频仍作为播放及无障碍控制。Video.js 集成需要替换现有控件和生命周期，对账号路径无额外收益。项目不自研 HLS 解析、MSE 拼接或解密。无需 Go 第三方依赖。验证使用本机实媒体、固定浏览器及故障注入。升级时重核资源拦截和懒加载体积。[官方 API](https://github.com/video-dev/hls.js/blob/v1.7.4/docs/API.md) · [安全页](https://github.com/video-dev/hls.js/security)
