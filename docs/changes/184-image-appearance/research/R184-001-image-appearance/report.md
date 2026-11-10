# R184-001 图片外观调整

Cloudreve [官方截图](https://docs.cloudreve.org/assets/file-apps-image-editor.DA9QZGmM.png)将色彩微调、滤镜和水印作为独立工具。Filerobot 官方演示确认支持浏览器滤镜与水印。截图证实入口和画布布局，具体效果不由截图推断。[Filerobot 官方演示](https://scaleflex.github.io/filerobot-image-editor/)

在 275a378，已有画布共享旋转、裁剪、标注和图片编码，标注在同一源坐标系绘制，历史快照与上传队列已可复用。复核 [R175-001](../../../175-image-editor/research/R175-001-image-workspace/report.md) 与 [R183-001](../../../183-image-annotations/research/R183-001-image-annotations/report.md) 的权限、导出及标注边界。

Filerobot 发布的 React 19 适配版本仍是 5.0.0-beta.159，带 React Konva 和 styled-components。整套编辑器可提供更多可交互图层，但引入第二套工作区、画布历史及保存集成。使用 CSS 滤镜可快速显示，Canvas 的同名 API 支持情况不同且无法统一预览、出图的行为。本批保留现有工作区，采用 WHATWG Canvas 的 ImageData、文字绘制和已有编码，依据 W3C Filter Effects 的色相、亮度、对比度、饱和度及棕褐矩阵组装有限外观操作。温度、曝光和预设作为可复核的产品规则，并非通用色彩管理。此方案单次扫描像素并限制中间分配，保持已有视图、历史及原件写入边界。[W3C Filter Effects](https://www.w3.org/TR/filter-effects-1/)

适用范围为浏览器已经能解码的本人 PNG/JPEG，输出为标准画布 RGB。HDR、可交换的图层文件、图片水印和服务器批处理需另外研究。
