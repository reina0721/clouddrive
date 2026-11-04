# 第二批集中验证

日期：2026-11-03（America/New_York）。基线 `998f63ca9ddee3f11de3e30fb96bfb2c78e7b3fe`；用户已明确取消中途审批。本记录描述本批证据，不代表 Cloudreve 全量对齐。

## 需求证据

| ID | 证据 |
| --- | --- |
| F21/F22 | service 复制树/回收项排除/循环/预算/失败无半棵树；浏览器右键复制文件和目录、复制后编辑不影响原件 |
| F23/F24 | 浏览器真实创建文本与 Markdown，自动补全扩展名，内容实际写入并能刷新/预览 |
| F25 | 两窗口读取同一版本，一窗保存后另一窗返回冲突且保留编辑缓冲；service 并发 CAS 恰好一个成功，一个冲突，非法 UTF-8/NUL 拒绝 |
| F26/F27 | 实际目录选择器上传 PNG、WebM 与子目录 WAV，复制后层级仍在；原生 ClipboardEvent 文件进入同一队列，刷新后仍存在 |
| F28–F31 | 浏览器生成真实 PNG/WebM 与标准 WAV，原图 naturalWidth=320，音视频实际解码并推进播放时间，画廊显示真实图片；改名为 PNG 的 SVG/脚本被拒绝；关闭后 Blob URL 被释放，解绑的播放器 paused=true 且 src 已移除 |
| F32/F33 | 文件菜单替代多排按钮，右键打开同一 HeroUI 菜单；F2 与搜索快捷键、键盘复选、浮层内编辑不误触发文件命令 |
| F34 | ZIP service 解包核验层级和完整字节、祖先去重、回收内容排除、跨 owner/超预算拒绝；浏览器实际下载 ZIP 并核验两份独立文本内容 |
| F35–F38 | 真正匿名浏览器密码解锁、目录浏览和字节下载；真实 HTTP 检查可信 Origin、错误密码/票据、服务端到期、尝试窗口及重启后分享/票据持久化 |
| F39/F40 | 浏览器撤销后已登录访客票据同样不可用；真实两个 IAM owner 的跨对象创建/撤销拒绝，真实存在的分享外文件 ID 无法下载，回收祖先使链接不可访问 |

## 已执行命令

- `go test ./...`：最终源码全量通过，`.data/121-go-full.log`（composition 21.734 秒，files/service 0.768 秒）。包含文本替换后将原非文本 MIME 规范为文本的回归用例，避免改名编辑后仍按图片分类。加强的真实分享安全用例定向通过，`.data/121-sharing-security.log`，包括 2 次尝试上限、恶意 Origin、准确到期、两 owner 与重启持久化。
- `go vet ./...`：通过，`.data/121-go-vet.log`。
- surface/web typecheck、受影响源码 ESLint、架构与 foundation governance：通过；最终收尾检查结果继续记录在本文件。
- surface/web Vitest：21 文件/177 用例与 34 文件/192 用例全部通过，`.data/121-frontend-unit.log`。UI Adapter workspace 没有独立 test script，未将它算成额外通过的单测。
- Next production build：通过，`.data/121-web-build.log`；公开分享 Host 组修正后的构建亦已通过，最终源码构建记录 `.data/121-web-build-final.log`。
- 浏览器集中 7 项：全部通过（1.3 分钟），`.data/121-browser-concentrated.log`。随后公开分享视觉/路由定向复测通过（1 passed，19.1 秒），`.data/121-public-visual-recheck.log`。
- 最终 `go run ./internal/tools/docs-guard --config docs/documentation.yaml` 与 `git diff --check`：通过。文档门禁最初指出 frontend/module authority 路径和 startup 影响决策遗漏，已修正影响记录并同步模块入口后复核通过；未更改门禁规则。94 个任务文件已按路径复核，新增内容通过已知本地凭据与私钥标记扫描；未运行 gitleaks，不将该扫描视为完整秘密检测。

实现全部 20 项后才启动集中功能检查。失败没有被隐藏或通过提高阈值掩盖：最初的公共 policy 错带 Action 被门禁拒绝；分享密码字段需显式可选；测试客户端不能把业务 token 覆盖 CSRF；菜单退出动画与 Next announcer 需语义定位；剪贴板测试需原生 ClipboardEvent。上述问题均已定位修正。

视觉复核进一步发现 `(public)` 已有 AuthFrame，改用独立 `(file-shares)`，访客页验证只有一个 main；导航期间禁止旧目录命令，防止快速操作写入过时目录。媒体 ref 在 effect 清理前可能解绑，StrictMode 又会模拟解绑，因此保留自有节点直到 effect 清理，避免提前移除正在使用的 src，也避免关闭后继续播放。加强资源与恶意图片验证通过，`.data/121-media-resource-recheck.log`（1 passed，15.5 秒）。

非法名称明确呈现输入错误并保留编辑内容，`.data/121-editor-input-recheck.log`（1 passed，18.3 秒）。分享默认有效期改为由服务端策略决定，避免较小合法配置下所有客户端预设都超限；刷新发现撤销时立即清空旧目录内容。最新公开页复测通过，`.data/121-public-visual-recheck.log`（1 passed，17.1 秒）。没有逐功能启动全量回归，修复后只复测受影响范围。

## 数据与运行

两个本地 SQLite 的一致性备份在忽略的 `.data/backups/*before-121*`；实施基线在 `.data/121-baseline.json`。未重置账号/数据库，参考站只读。2026-11-03 21:01（America/New_York）普通开发与专用预览均以最终源码重启，files v4 状态 compatible、dirty=false；预览登录资料已刷新，日志 `.data/121-dev-restart.log`、`.data/121-preview-restart.log`。4173/8080/9090 与 4180/8120/9120 六个端口均在监听，交付后保持运行。

预览 `http://127.0.0.1:4180/home`，私有分享管理 `/home/shares`。账号、密码、设置令牌、有效期 Cookie/CSRF 在 `.data/preview-access.json`，参考站资料在 `.data/reference-access.json`，测试分享资料在 `.data/121-preview-sample.json`（该用例结束后已撤销）。这些文件、数据库、截图和 trace 不进入提交。

已查看桌面和窄屏截图，卡片没有重复选择标签/多排按钮，访客分享页去除了登录品牌框架且无横向溢出。低敏图片位于 `frontend/test-results/files-rich-desktop.png`、`files-rich-mobile.png`、`file-share-desktop.png`、`file-share-mobile.png`，不把截图当成外部功能的证明。

## 未验证与剩余范围

没有验收外部 MySQL/PostgreSQL/S3/MinIO 实例、生产部署或 race detector。当前 bytes 契约仍限小文件，目录上传不保留空目录或跨刷新续传；媒体依赖浏览器编解码，未提供字幕/转码。逻辑配额不等于物理磁盘占用，旧不可变对象不自动 GC。挂载、离线下载、账号共享协作、版本历史界面、Office 和分片续传仍未完成。Git 远端写权限问题尚未解除，提交/推送以最终实际结果为准。

## 本地提交与推送回执

功能提交：`bf66da5ac1874461d5af63d20c8368e6cb725680 feat(files): add sharing and rich file operations`，94 文件。提交后工作树干净；4173 与 4180 的 `/home` 实际 HTTP 均为 200，开发进程保持运行。

`git -c credential.interactive=never push -u origin codex/cloud-drive` 退出 128，GitHub 返回 `Permission to reina0721/clouddrive.git denied to rin721` 和 HTTP 403，日志 `.data/121-push.log`。未更换 origin、重写历史或以其他写入 API 冒充推送。解除仓库写权限或切换有权 Git 身份后仍需重新推送并核验，C01 不勾选。
