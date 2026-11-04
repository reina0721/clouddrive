# 第四批集中验证

F61–F80全部实现后才启动功能测试，失败按实际影响定向修复。R123-002与R123-003分别记录集中验证发现的代理和安全基线问题，不用旧失败日志冒充通过。

## 产品行为证据

| 范围 | 实际验证 |
| --- | --- |
| F61–F63、F66–F68 | Chromium从文件导航进入连接管理，在实际目录选择器选择新建目录，创建具名连接；分别复制地址/用户名/密码并核对剪贴板，关闭后不再显示或写入localStorage；改名和刷新保留服务端结果。HTTP额外检查CAS冲突与普通读取不返回密码。 |
| F64–F65 | HTTP与Chromium只读连接拒绝PUT、读取可用；点文件PUT拒绝，已有点文件子树的COPY/MOVE不能绕过策略，浅复制不带子项。 |
| F69–F72 | 浏览器停用/启用、轮换/撤销闭环，原密码失效、新密码可用；API验证撤销不可重新启用。实际地址直达Go协议端点，Next开发代理不承载整包PUT；指南明确LOCK与OS驱动限制。 |
| F73–F75 | OPTIONS仅声明当前方法与DAV1，PROPFIND目录及UTF8特殊字符href、MKCOL实际可用；33MiB真实下载SHA一致，HEAD/206/304及失败条件覆盖均检查。 |
| F76 | 未知长度33MiB流式PUT、文件覆盖与If-Match；两个真实HTTP上传交错，先完成的新内容保留，旧候选409且释放active预留。客户端真实中断流式覆盖后，原内容不变且候选预留清理完成，见`.data/123-webdav-cancel-final.log`。共用既有512MiB文件预算、暂存峰值与账号增量配额，已知旧目标内容版本CAS。未以完整512MiB文件实测冒称覆盖了所有容量边缘。 |
| F77–F79 | 真正COPY/MOVE与Overwrite:F失败、DELETE进入同一回收站及网页API恢复后再次下载；副本保留不可变对象语义，操作失败不提前删除目标。 |
| F80 | 不同IAM owner无法使用他人目录或管理凭据；跨连接Destination、路径穿越与编码斜线被拒绝；当前写权限撤回、读权限撤回、账号禁用、实际过期及根目录回收后失效。服务停止并重新装配后文件与凭据仍可使用。 |

Go证据：`internal/composition/webdav_e2e_test.go`，日志`.data/123-webdav-authority.log`、`.data/123-webdav-final.log`。Chromium证据：`frontend/file-tests/connections.spec.ts`与`.data/123-browser-all.log`（9流程、2.1分钟），安全升级后9条再次全部通过（2.0分钟），见`.data/123-security-browser-all.log`。前60项的8流程包括媒体、ZIP、分享、目录/剪贴板、双窗口编辑冲突，以及33MiB续传、503重试、跨路由、刷新错误源拒绝和下载SHA。

## 安全和工程检查

- Go1.26.10全量 `go test -p 4 ./...` 与 `go vet -p 4 ./...`通过：`.data/123-security-go-test-final.log`、`.data/123-security-vet.log`。首次安全版本全量曾触发既有Watcher取消竞态，保留失败日志；S02修正并增加100次真实ready后取消回归，不以一次重试通过替代修复。
- govulncheck1.9.0符号扫描通过：`.data/123-vulnerability-final.log`，0个当前可达漏洞；另1个导入包级、2个依赖模块级报告未命中当前调用路径，不能理解为绝对无漏洞。原扫描的17个可达问题由Go1.26.10和Excelize2.11.1维护版本升级消除。
- 前端类型、全量unit598、lint、生产构建通过：`.data/123-typecheck.log`、`.data/123-frontend-test.log`、`.data/123-lint-final.log`、`.data/123-build-final.log`；新增Host地址/版本/账号边界3项及定向lint通过，合计601项unit：`.data/123-connection-host-test.log`、`.data/123-connection-host-lint.log`。
- 架构954源码/20fixture、foundation14fixture/13workspace/12owner及Tailwind覆盖、依赖治理30项通过；前批续传/摘要库的Host职责登记在本次闭环补齐，无第二套客户端。
- frontend/docs门禁及root docs-guard通过。本次改动格式检查通过：`.data/123-affected-format.log`。全仓Prettier仍提示未修改的`frontend/docs/plugin-framework.md`；`.data/123-format-baseline.json`核实工作区与HEAD相同且HEAD原已不合格式，未混入无关格式修改。
- OpenAPI/operation inventory已重新生成，103个原生operation；独立协议声明未伪装成OpenAPI方法。新增v7三方言checksum与SQLite实际升级通过；v1–v6未改写或重置数据。

## 视觉、运行和限制

实际检查桌面及390px截图（ignored `frontend/test-results/files/connections-{desktop,mobile}.png`）：灰底白面板、蓝色主动作、目录/权限/日期/管理动作、客户端指南均可读，无横向溢出；修正顶部文件链接被挤换行。参考站仅只读观察、打开和取消对话框，没有新增账号或文件。

普通4173/8080/9090与独立4180/8120/9120均在保留数据库/文件的前提下用Go1.26.10重新构建并重启，持续运行。`.data/123-runtime-receipt.json`记录页面200及实际登录后的files/transfers/connections接口200；`go version`同时确认两份运行二进制为1.26.10。地址/账号/密码/设置令牌与会话资料仍在ignored `.data/preview-access.json`，不复制到本记录。隔离验证使用4183/8123/9123。

Windows/iOS真实驱动、外部MySQL/PostgreSQL/S3、Docker完整构建及多机没有验收；镜像digest已向官方Registry复核。未实现LOCK/UNLOCK、任意dead properties、离线下载、持久账号共享协作、版本历史及Office，整体Cloudreve对齐尚未完成。暂存审阅、提交与实际push结果由任务清单和Git/ignored交付回执记录。
