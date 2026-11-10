# R176-001 音乐播放器

实际查看 [Cloudreve 官方图](https://docs.cloudreve.org/assets/file-apps-music-player.CDMiFagG.png)。其顶部入口展开浮层，封面和歌曲信息在上，进度、循环、前后曲、队列和音量在下。[官方说明](https://docs.cloudreve.org/zh/usage/file-apps#音乐播放器)将歌曲信息与封面数据来源区分。图示用于布局和操作对照，既有站点空目录没有可直接用于比对的测试歌曲。

本项目 `media-view.tsx` 只有私有及公开共同使用的单文件原生音频控件。`backend.ts` 的本人读取拥有会话、串行准入、大小校验及关闭信号。已有目录查询支持父级和 audio 分类。顶部账户工具由 Host 装配，文件路由布局跨子路由复用，适合保留播放器。复用 R121-001 的媒体边界及 R175-001 的预览资源约束。

保留 [HTML 媒体标准](https://html.spec.whatwg.org/multipage/media.html) 的浏览器解码和媒体事件，界面沿用现有 PopoverCard。通用播放库会重复创建解码及生命周期适配。标签解析采用 [music-metadata 12.3.5](https://github.com/Borewit/music-metadata) 的浏览器 Blob 接口，MIT，Node 22 与当前 Host 工具链相符，定期发布，有 MusicBrainz 等实际标签格式支持和上游测试。弃用的 music-metadata-browser 不采用。选定版本高于 ID3、ASF 和 EBML 已修复版本。见 [ID3 公告](https://github.com/advisories/GHSA-jjpr-9cvf-cq55)及 [EBML 公告](https://github.com/advisories/GHSA-5gfj-9q3v-qfp3)。通过窄契约接入、独立 Worker 超时、受限输入和封面签名核验约束风险。升级时复核公告和构建预算。若需服务器索引、多客户端封面或流式大文件，复核当前架构；本批只在本人浏览器中读标签。
