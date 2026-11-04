# 首批 20 项验证记录

验证日期：2026-11-03（本地）；研究基线为 `557757f6f7009eeed7950d79ced3f9d9be49b5da`。此记录只证明首批实现，不表示 Cloudreve 全量对齐。

## 数据与实施基线

开始时保存的既有路径/hash 位于忽略的 `.data/120-original-*`；实施期间出现 `init` 基线后按实际 Git diff 收敛范围。当前任务未修改历史 119 方案。原 SQLite 已用在线备份保存到忽略的 `.data/backups/`；原账号未重置，独立预览使用 `.data/file-preview/`。运行资料与截图/trace 均被 Git 忽略。

## 功能证据

| 需求 | 实际验证 |
| --- | --- |
| F01–F03 | 真实登录进入 `/home`、创建目录、进入目录/返回根目录、刷新保留路由；服务用例覆盖名称规范化、冲突和非法父项 |
| F04–F06 | 浏览器多文件队列、真实 2 MiB 上传、拖拽、确定性等待项取消；HTTP 用例覆盖同时上传、空文件、幂等；服务覆盖取消、大小和准入限制 |
| F07–F09 | 下载字节精确比较、重命名、目标目录移动；服务覆盖自身/后代/他人目标拒绝 |
| F10–F11 | 多选移入回收站与恢复；HTTP/服务覆盖祖先回收后子项不可见/不可下载、恢复冲突 |
| F12–F16 | 浏览器名称搜索、类型分类、排序和列表/网格切换及刷新；服务覆盖分类规则、稳定排序和不可见项过滤 |
| F17 | 两项目标移动，一项自循环失败而另一项成功；逐项失败保留、刷新核实成功项；键盘 Space 选择与鼠标 label 选择 |
| F18–F20 | 浏览器真实属性、空间占用与脚本按文字预览；服务覆盖并发配额、完整性、所有者隔离和失败补偿 |

真实 HTTP 测试使用 SQLite、两名 IAM 用户及文件权限，不伪造认证主体；覆盖 CSRF 拒绝、并发上传、停止后重新构造 Coordinator 的持久化读取、存在文件时拒绝更换存储位置。

## 命令与结果

- `go test ./...`：通过；之后新增排序/过滤用例，定向 `go test ./internal/module/files/service` 通过。完整日志 `.data/120-go-full.log`。
- `go vet ./...`：通过。
- `pnpm --filter @clouddrive/surface --filter @clouddrive/web typecheck`、根测试配置 `tsc --noEmit -p tsconfig.json`：通过。
- 两个受影响 workspace 的 Vitest：surface 21 文件/177 用例、web 34 文件/192 用例，全部通过；日志 `.data/120-frontend-unit.log`。
- 受影响源码及浏览器测试 ESLint（零 warning）：通过；架构检查 916 文件、foundation governance 13 workspace/12 contract owner：通过。
- Next production build、插件/后端目录/console contract 生成物新鲜度、frontend 文档检查：通过。
- `go run ./internal/tools/docs-guard --config docs/documentation.yaml --base HEAD` 与 `git diff --check`：通过。
- 浏览器首轮 4 项中 3 项通过；文件闭环在登录加载前发生 Chromium `ERR_NO_BUFFER_SPACE`，trace 显示开发脚本加载失败。保留失败事实，未添加自动重试掩盖；单独复跑受影响闭环通过（1 passed，16.1s）。其余通过项覆盖部分失败、视觉/2 MiB/匿名拒绝、拖拽/等待取消。日志分别为 `.data/120-browser-final.log` 和 `.data/120-browser-recheck.log`。

桌面 1440×960 与窄屏 390×844 已人工查看截图；修复窄屏搜索输入框与导航图标尺寸，检查无横向溢出。证据在忽略的 `frontend/test-results/files-desktop.png`、`files-mobile.png`。长列表仍可滚动，不将视觉相近等同于功能齐全。

## 运行与限制

原开发环境和独立预览均已以最新源码重启并验证就绪，交付后保持运行。独立预览为 `http://127.0.0.1:4180/home`，登录资料和有时效的调试会话在 `.data/preview-access.json`。

未执行外部 MySQL/PostgreSQL/S3/MinIO 实例验收、生产部署和竞态检测；未宣称这些检查通过。当前完整 bytes 存储契约限制为 32 MiB 小文件，取消无法撤销已经完成的提交；强制终止时的孤立对象回收尚未实现。后续功能缺口见本目录任务清单和当前运行 authority。

## 提交与远端交付

本地提交为 `a5293d59d90148f91ce6e7a44d5cd997436d974a`，信息 `feat(files): add private file management and cloud drive workspace`。精确暂存 97 个任务路径，排除了运行态 next-env、数据、凭据和测试产物；新增内容与忽略文件中的已知凭据匹配为零。

推送返回 GitHub 403：当前 Git 身份 `rin721` 无目标仓库写权限；指定仓库所有者登录时，本机没有其可用凭据。GitHub connector 可读取目标仓库，但返回远端仓库为空，不能据此宣称 Git 推送成功。已请求用户修复本机登录或写权限，C01 保持未完成；本地提交和持续预览可继续使用。
