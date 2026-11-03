// Package api 保存由模块契约生成的 operation inventory（030 代码优先，不再由 openapi.yaml 生成代码）。
//
// contract-gen 从各模块 binding/http 的契约声明渲染 api/openapi.yaml 与本 inventory；
// 运行期 transport 从同一份模块声明绑定路由并加载生成的规范做请求校验。
//
// 输出路径由 .scaffold/layout.json 声明，避免生成器和质量脚本各自维护副本。
//
//go:generate go run ../../../tools/contract-gen -package api -output-json ../../../../frontend/apps/web/src/generated/native-openapi.json
package api
