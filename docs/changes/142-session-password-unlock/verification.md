# 142 验证记录

## 结果与边界

F421–F440的20项使用行为已接通并集中验证；这是当前会话密码解锁一个能力的行为集合，不增加20个独立功能。BT、远程下载节点、脱离链接的账号挂载共享和Office仍未实现，不宣称Cloudreve全量对齐。

研究基线03577cf到实施入口无外部变更，未命中刷新条件。未改依赖、配置或SQL；files保持v16。原两库一致性备份与所有files表全部列/行摘要见忽略的`.data/142-original-baseline.json`、`.data/142-data-receipt-v16.json`；最终核对一致，不仅是行数一致。

## 行为证据

| 行为 | 实际证据 |
| --- | --- |
| F421 手动锁定 | 新浏览器场景1、原workspace账户场景、主预览实际菜单 |
| F422 正确密码 | 场景1真实服务解锁、主预览本人密码实际恢复48项文件列表 |
| F423 错误遮挡 | 场景1、3错误反馈可见 |
| F424 会话保留 | 场景1及Go真实HTTP前后sessionId一致 |
| F425 重试 | 场景1同一会话错误后输入正确密码 |
| F426 空密码 | 场景1请求计数为0 |
| F427 输入边界 | Go空串及129个汉字、真实HTTP空串和未知accountId拒绝 |
| F428 键盘和背景 | Enter提交、原workspace背景inert与焦点、Axe |
| F429 防重复 | 场景2挂起请求、按钮禁用且有名称、Enter不增加请求 |
| F430 密码清理 | 场景1失败后输入为空，场景2新账号遮挡为空；凭据只在组件内存 |
| F431 刷新 | 场景1刷新后仍有遮挡且输入聚焦 |
| F432 空闲/后台 | 两个hook用例：手动锁取消旧计时，解锁后重启计时；后台锁、换账号和卸载 |
| F433 失败预算 | Go将Login与Verify的错误合计到持久账号预算，失败结果返回后后续事务仍看到计数 |
| F434 锁定期 | Go达到预算后正确密码仍返回ErrAccountLocked |
| F435 当前身份 | Go无session拒绝；真实HTTP未知目标账号字段拒绝，成功请求只含password |
| F436 会话失效 | Go撤销、过期、security revision、禁用和强制改密各自拒绝 |
| F437 CSRF/来源 | 真实HTTP不可信Origin、错误CSRF均403；原生入口同一有效会话成功 |
| F438 网络恢复 | 场景2实际请求中断后提示并继续下一次校验 |
| F439 迟到响应 | 场景2挂起第一账号请求、退出、登录第二个不同账号、重新锁定，旧请求结束不解除新遮挡，第二账号密码成功 |
| F440 语言移动 | 场景3英文深色320px，无横向溢出、错误在视口内、Axe通过及可退出 |

## 集中检查

- Go最终`go test -p 1 ./... -count=1`通过，`GOMAXPROCS=4`、`CGO_ENABLED=0`；证据`.data/142-go-all-r3.log`。此前完整composition单独通过，最终全仓包含该包。`go vet ./...`通过（`.data/142-vet.log`）。未运行race，环境无CGO工具链。
- Web单元58文件、308例通过：`.data/142-units-r3.log`。Web类型检查、全前端eslint、定向Prettier通过；两个最终Next生产构建也执行TypeScript。最后改动的浏览器测试再做定向eslint。
- 新增真实浏览器3例最终通过：`.data/142-browser-r5.log`；相关workspace 8例通过：`.data/142-browser-workspace.log`。共11个不同场景，不把中间复跑累计为新增例数，未重跑全站423例或其他系统浏览器。
- foundation、architecture、dependency及plugins/backend/contracts/design生成一致性检查全部通过，文档治理通过。
- 主与QA实际生产目录分别为142-primary和142-qa-final；未放宽预算，initial350882、最大route444471、union2265062、CSS49148/49152、最大块81366、rawJS7015850字节。两份performance记录均通过。
- `.data/142-runtime-receipt.json`含21项真实原有文件/偏好/受众/分享/PDF/DAV/健康检查及两个实际代理目标；`.data/142-processes.json`记录三个后端均运行142可执行文件且PID/启动时间归属一致。
- 主、开发和QA前端均重启，保持运行；主预览视觉截图`.data/142-primary-lock.png`，自动化窄屏截图位于忽略的测试报告。没有更新视觉golden。

## 中间失败及修复

1. 初次前端单元命令用了不支持的过滤参数，未执行测试；改为真实Web完整单元命令，不把参数错误记成测试通过。
2. exactOptionalPropertyTypes拒绝显式undefined信号，改为仅存在时传入。
3. HTTP测试工具覆盖了自定义Origin/CSRF，修正工具默认值与显式覆盖顺序；密码尝试会增加账号version，资料测试读取实际版本，不放宽产品CAS。
4. 忙碌按钮的status子树不提供按钮名称，改为普通按钮文字和独立读屏status，保留禁用及请求去重；最终真实浏览器检查通过。
5. hook卸载测试起初断言全局timer数量，不能将测试环境其他计时器都归属于该hook；改为卸载后推进时间并确认实际锁状态不会变化。React act回调明确不返回其他库对象，eslint通过。
6. 第二轮高并行全仓Go因既有离线下载测试未在期限内离开queued而失败。未更改产品或测试等待阈值；构建结束后限制包并行的全仓完整检查通过。
7. 迟到请求夹具初期吞掉所有continue错误；最终只处理并断言Playwright已处理路由这一明确取消状态，其他错误失败，并等待该回调完成。最后3例全部通过。

## 本地交付与剩余限制

访问地址、用户名、密码、设置令牌和Cookie/CSRF引用保存到`.data/142-preview-guide.txt`，`.data/latest-preview.txt`指向该文件。真实密码只复核当前会话；没有新登录、授权票据或MFA提升。HTTP正常活动仍可续空闲期限，绝对期限不变；客户端遮挡可被清除本地状态绕过。

构建和验证结束后只执行官方`go clean -cache`，预先校验缓存绝对位置且无Go进程；释放1728733184字节，剩余约3.09GB十进制。未删除.data、数据库、存储、正在运行的构建或任何旧可执行文件，未停止无关应用。未验证PostgreSQL/MySQL运行实例；本批无SQL变更。

代码与文档检查已完成，代码提交`5e3ec52b97afaa1a25902ee2d80539d366092c5b`（`feat(auth): support password unlock for active sessions`）已推送并与远端main核对一致；完成清单见[任务清单](tasks.md)。后续文档收口不改变已运行的程序。
