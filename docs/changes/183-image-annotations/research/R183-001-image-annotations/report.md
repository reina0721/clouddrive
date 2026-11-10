# R183-001 图片标注

Cloudreve [官方截图](https://docs.cloudreve.org/assets/file-apps-image-editor.DA9QZGmM.png)中的图片编辑器有独立标注入口、底部形状工具、画布上的多边形选择框及颜色控制。当前代码有裁剪、镜像、旋转、尺寸和历史快照，但没有图层或标注工具。复用 [R175-001](../../../175-image-editor/research/R175-001-image-workspace/report.md) 的原件边界、Canvas 和副本上传原则，针对 698f933 复核编辑器状态和导出入口。

浏览器的 Canvas 2D 已能进行路径构造、透明合成、文字绘制、命中和编码。Konva 和 Fabric 提供成熟的交互舞台和对象序列化，适用于独立场景编辑器；接入此任务会重复承载裁剪坐标、历史、Canvas 生命周期与导出，无法直接复用现有几何契约。Cloudreve 使用 react-filerobot-image-editor，替换现有编辑器需要迁移现有副本命名、权限、上传队列和错误状态。本批采用标准 Canvas 加入有界的图片专用标注状态，保留现有一个编辑器和一套输出流程。不引入图层文件格式、项目级新框架或依赖。以后需要互操作图层格式时重新评估。

另行复核 HEIC 候选。heic-to 1.6.7 的 `package/src/lib/libheif-without-unsafe-eval.js` 编译注释标明 libheif 1.23.7 和 libde265 1.0.16。libde265 1.0.17 已修复 CVE-2026-33164 和 CVE-2026-33165，HEIC 解码继续独立选型。[libde265 上游发行记录](https://github.com/strukturag/libde265/releases)
