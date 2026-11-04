# 第三批集中验证

本批 F41–F60 全部实施后启动集中检查；失败按影响范围修复和复测，未逐功能提前执行回归。基线为 c907155，数据备份与访问资料均在 Git 忽略目录，参考站仅只读观察。

## 功能证据

| 验收范围 | 实际证据 |
| --- | --- |
| F41–F45 | HTTP/SQLite 与 Chromium 实际传输超过 32 MiB 的内容；第一个 4 MiB 块确认后暂停，偏移错误返回409、暂停时PATCH被拒绝；继续后下载完整 SHA-256 一致。UI校验和上传进度分开，确认字节为4.0 MiB/33.0 MiB。 |
| F46 | 浏览器注入第一次 PATCH 503，tus客户端有界重试后继续，未创建重复会话；源码限制0/1/3秒重试范围，不重试认证失败和到期。 |
| F47–F50 | HTTP测试实际停止并重新创建应用服务，暂停会话保留偏移；浏览器上传中导航到传输中心不丢失活动请求，刷新重选同长度错误内容被SHA拒绝，正确源接续完成；持久记录显示真实目标目录。 |
| F51 | 浏览器刷新后在等待处理筛选内找到需重选源文件的任务；重新选择后切换已完成筛选，观察实际完成记录。分页有界，空态明确为本页匹配结果。 |
| F52 | HTTP取消未发布会话清除暂存，已完成会话取消返回409且文件仍存在；通过仅测试目录中的非空metadata目录制造真实删除失败，500保留错误，恢复后取消重试清除待办。推进本测试库单条期限验证expired、410和暂存删除。 |
| F53–F55 | Host资源测试验证3个文件最多2个摘要任务、批量暂停全部等待退出、继续可用源、取消等待项和dispose；真实拖拽流程验证两项上传、一项取消。批量失败保留逐项failure。 |
| F56 | ACK回调使用单调时间计算速率/ETA；Host测试确认暂停后速率归零、ETA为null，不使用hash字节作为确认字节。桌面/窄屏真实进度截图已检查。 |
| F57–F59 | 私有原生下载的33 MiB文件校验SHA；HTTP实际206、416、ETag304、If-Range不匹配返回完整内容。公开无Cookie短期单文件凭据下载及Range通过；密码、子树越权、撤销和分享期限回归通过。 |
| F60 | 上传后另建同名文本制造发布冲突；409后保留完整暂存，修改目标名称再提交发布，最终内容SHA不变，无需重传。 |

## 检查记录

- Go全量 `go test ./...` 通过：`.data/122-go-test-final.log`。新增期限、配额、清理失败和两owner检查定向通过：`.data/122-transfer-lifecycle.log`；原始流读错误保留与composition完整回归通过：`.data/122-stream-regression.log`。
- `go vet ./...` 通过：`.data/122-vet.log`。
- 前端全工作区类型检查通过：`.data/122-typecheck.log`；生产构建及路由/契约生成通过：`.data/122-build-final.log`。
- 全工作区Vitest通过：`.data/122-frontend-test.log`，其中surface177、web192；新增Host资源/owner两项随后通过：`.data/122-runtime-final.log`。其余workspace共227项，合计598项。
- ESLint最初发现五项产品源码问题，已修正；后续新增测试中的async/断言问题也定向修正，日志`.data/122-lint-affected-final.log`、`.data/122-test-lint.log`。不以失败记录冒充通过，收尾全量结果另记。
- 最终架构945个源码与20个边界fixture通过：`.data/122-architecture-final.log`；foundation13工作区/12契约owner、14fixture与Tailwind覆盖通过：`.data/122-foundation.log`。
- 浏览器集中8项全部通过：`.data/122-browser-final.log`（2.0分钟）。窄屏布局定向通过：`.data/122-browser-visual.log`；筛选与503/跨路由/错误源/原生下载最终定向通过：`.data/122-browser-filters-final.log`（28.3秒）。
- docs-guard通过：`.data/122-docs-guard.log`。生成契约为97个原生operation，不保留旧普通上传入口。最终diff、秘密扫描和运行回执在本文件收尾段记录。

## 失败修复与视觉复核

初次集中检查发现普通body限制截断4MiB分块、原始下载把已映射的403/404变成500、旧operation清单未更新，均按真实失败修正。ProtocolProblemError现在保留错误链；精确传输PATCH只在认证准入后应用模块chunk预算；普通JSON和其他PATCH上限不变。ServeContent内部不返回源复制错误，增加受控reader保存原始错误并在内容边界中止响应，不向文件尾追加JSON。

浏览器回归初次失败包含旧“完成”文案，以及实施期HMR导致菜单关闭；恢复既有“上传完成”文案，并在源码稳定后完整8项通过。筛选补测第一次在“等待处理”中等待已完成项，修正为切换“已完成”后验证，未改产品筛选来迁就断言。刷新失去源句柄的活跃会话纳入注意事项筛选，防止任务消失。

2026-11-03再次只读观察Cloudreve首页及后台任务；参考站保持灰底、蓝色导航、白色内容面板。本地传输中心使用现有组件和同类视觉层次，桌面与390px窄屏均检查，无横向溢出；窄屏长文件名和状态改为分行。实际截图：`frontend/test-results/files/transfers-desktop.png`、`transfers-mobile.png`，均为忽略的验收资产。

## 适用边界

真实运行验收为Windows、本机持久暂存和SQLite。S3-compatible只经过受控HTTP服务器的HEAD/Range/流/取消测试，没有外部S3/MinIO、MySQL/PostgreSQL或多主机部署验收。算法与分块读取有明确内存边界，但未做生产内存压力基准或强制杀进程恰落在publishing两资源窗口的故障注入。未运行govulncheck/gitleaks，不把官方安全页无公告当成完整漏洞扫描通过。上述限制不扩大为已支持能力。

本批是整体goal的第三批，WebDAV、离线下载、共享协作、版本和Office仍缺失。推送权限失败必须单独记录，不能将本地commit写为已远端交付。

## 收尾与运行回执

全量ESLint最终通过：`.data/122-lint-clean.log`；前端文档、插件/契约生成检查通过：`.data/122-frontend-docs.log`、`.data/122-codegen-check.log`。最终docs-guard与git diff --check通过。132个任务路径经范围复核，新增行及新文件通过已知本地凭据/私钥标记扫描；未把该扫描称为gitleaks。

普通开发4173/8080/9090、独立预览4180/8120/9120均已重启为本批最新代码，files schema实际升级到v6，原账号和文件保留。记录`.data/122-dev-restart.log`、`.data/122-preview-restart.log`；通过预览同源代理的已登录文件/传输请求200，确认512MiB/4MiB实际预算，两套页面均200，记录`.data/122-runtime-receipt.json`。访问资料`.data/preview-access.json`，交付导航`.data/122-delivery.json`，均不提交。服务保持运行。

提交前推送预检仍返回403：当前Git身份rin721没有reina0721/clouddrive写权限，证据`.data/122-push-preflight.log`。本批代码按用户要求创建本地Conventional Commit并继续尝试实际推送，实际命令回执存`.data/122-push.log`；C01在远端核验前保持未勾选，不改remote、不覆盖远端历史。
