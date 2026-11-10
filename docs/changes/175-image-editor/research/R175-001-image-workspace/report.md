# R175-001 图片工作区

研究的问题是如何从只读预览补齐高频编辑，又能保留原文件和现有权限边界。视觉检查使用 Cloudreve 官方[图片应用截图](https://docs.cloudreve.org/assets/file-apps-image-editor.DA9QZGmM.png)。截图内画布居中，工具独立于保存和历史控件。该截图可验证界面布局，具体交互与版本以参考产品的运行行为为准。

在 `3718e57`，`frontend/apps/web/src/files/media-view.tsx` 读取受控 Blob、验证签名、拥有媒体 URL。私人和公开分享分别装配预览，当前视频工具是已存在的按需入口。上传队列负责暂存、校验、配额、目标冲突与重新提交。沿用 R121-001 关于媒体读取与上传所有权的已知边界。

[Cloudreve 前端](https://github.com/cloudreve/frontend/blob/master/package.json) 使用 Filerobot。2026-11-10 查看其 npm 元数据，MIT 的 4.9.1 要求 React 17+、React Konva、styled-components，并依赖 Konva 和 Scaleflex UI。最新标记的 5.0.0-beta.159 要求 React 19、React Konva 19 和 styled-components，仍处于预发行。该套件适合完整编辑工作台，能覆盖滤镜、标注和水印，引入第二套设计系统与浏览器渲染依赖。本批采用 [WHATWG Canvas](https://html.spec.whatwg.org/multipage/canvas.html) 的标准裁剪、仿射变换和 PNG/JPEG 编码，使用已有 React 19 组件。决策范围限于几何编辑，新增滤镜或标注时复核专用库。标准 API 可通过真实像素和 Playwright 浏览器验证，支持情况取决于浏览器。

已知边界为浏览器编解码、客户端像素与字节预算、上传队列异步保存。参考产品的 EXIF 面板、HEIC、滤镜、标注、水印、实况图片属于后续独立范围。触发条件见 metadata。
