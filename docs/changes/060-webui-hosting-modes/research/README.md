# 060 研究索引

## 研究范围

本任务需要回答的问题：

1. 当前 WebUI 的交付链现状：构建产物在哪里、什么工具在产出、CI/release/Docker 是否托管，Go Service 当前是否提供任何静态文件能力。
2. Go Service 的 HTTP 组成与配置 ownership：静态托管应接入的位置、中间件边界、Session/Origin 语义对同一 origin 模式下是否成立。
3. 托管模式的候选方案对比：运行期目录托管与编译期 `go:embed` 的取舍，SPA fallback 与安全语义，托管前构建脚本的执行方式。

## 记录索引

- [R001 当前 WebUI 交付链与 Go 服务托管缺口](R001-current-webui-delivery-and-hosting-gap/report.md)：当前事实快照。
- [R002 WebUI 托管模式与构建脚本设计方案](R002-webui-hosting-design-options/report.md)：候选与推断。

## 检索方式

```bash
rg -l "webui|hosting|static|托管" docs/changes/060-webui-hosting-modes/research -g metadata.yaml
```