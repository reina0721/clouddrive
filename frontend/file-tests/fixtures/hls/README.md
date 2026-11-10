# HLS 浏览器测试样本

这些样本由 FFmpeg 的 testsrc2 彩色图案生成，包含四段各一秒的 144p 和 240p H.264 MPEG-TS，以及含初始化字节范围的 H.264 fMP4。二进制 TS 样本使用 `.bin` 扩展名，验收上传时恢复为 `.ts`。

生成时以 10 fps 取样四秒，使用 `libx264 -preset veryfast -crf 31 -pix_fmt yuv420p -g 10 -keyint_min 10 -sc_threshold 0`，HLS 分片时长 1 秒。fMP4 使用 144p、CRF 32 和 `-hls_segment_type fmp4 -hls_flags single_file`。浏览器测试运行时创建并使用临时 AES-128 密钥。
