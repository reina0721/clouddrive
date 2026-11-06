# 会话与界面

## 边界与协议

IAM Service拥有VerifySessionPassword(ctx,sessionID,password)；console使用方窄契约由composition转换。原生POST `/api/v1/iam/self/password/verify`使用本人读取权限、Cookie、Origin和CSRF；console POST `/api/console/v1/auth/password/verify`沿用同一认证链。请求仅password，成功`{verified:true}`，no-store，不写Set-Cookie。错误密码401、锁定429、会话失效401、权限限制403、输入422、存储错误500；console提供可区分错误原因供锁屏提示，但不提供账号查询接口。

事务中重读当前session与account/credential；检查撤销、两个期限、安全revision、账号状态、强制改密/密码到期及锁定期限。错误共享FailedAttempts；通过outcome延迟错误使失败计数提交，不把业务失败回滚。成功只重置账号失败状态，不触碰session/MFA/credential。采用现有版本CAS；冲突显式传播。没有新表、迁移、配置、资源、goroutine或重试循环。

## 界面与所有权

unlock函数真实分支复用createJsonClient超时、Cookie和CSRF，不调用AuthService.login；输入不含email，账号仅从服务端会话读取。保留mock边界以支持展示测试，不回退mock。错误增加locked/expired/forbidden，与凭据和网络失败分离。

LockScreen每次锁定建立AbortController；解锁前比对userId与lockedAt快照，清理时取消，重锁不接受旧响应。密码只在组件内存，提交完成清空；异步结果不得更新已卸载组件。背景继续inert，保留Enter、显隐密码与退出登录。无新增全局状态、样式系统或第三方依赖。

## 文件与验证

影响IAM service/http、console契约/http、composition投影、原生生成契约、前端auth/unlock、LockScreen、中英词条、定向Go/单元/浏览器用例以及现行操作说明。20项接通后集中运行失败预算、会话不更换、撤销/到期/跨账号/CSRF、重复及迟到提交、手机深色无障碍；再执行必要Go与前端质量检查。构建并依照PID+启动时间归属重启三个现有预览，不动其他进程。保留两库与存储，访问资料写入忽略的.data文件。
