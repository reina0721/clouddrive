# OpenAPI 后端导航声明

本目录保留 Go 模块的 WebUI 元数据，`binding.go` 声明 `/openapi` 工作区、导航、语言资源和访问操作。它不是当前浏览器页面的源码目录，也不负责生成或部署前端。

当前 API 工作台实现位于 [Surface 契约与 Port](../../../../../frontend/surfaces/src/api-workbench/README.md)及其私有插件，浏览器路由由 [Plugin Framework](../../../../../frontend/docs/plugin-framework.md)生成装配。原生 API 的事实源与生成入口以 [API 说明](../../../../../api/README.md)为准。

旧 `webui/src`、`OpenAPIPage.tsx` 和 mock 源路径是此声明保留的来源元数据，不能作为当前可执行页面位置。调整后端导航声明时，先核对实际 composition 使用方与前端目录，避免把历史声明误认为第二套浏览器运行时。
