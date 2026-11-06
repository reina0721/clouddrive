# R142-001 当前会话密码复核

## 问题、方法与范围

定向读取IAM Login/Resolve/ChangePassword、Repository事务、console IdentityAccess、前端unlock/LockScreen/useIdleLock。检索metadata命中R077-001和历史R003：前者的失败预算可复用，后者描述的是旧WebUI且明确不包含新端点，不能用作现接口证据。前端与当前Go代码为03577cf快照。

## 当前事实

- `auth/unlock.ts`真实部署直接返回unsupported；mock分支仅验证演示凭据。LockScreen虽显示密码输入，真实部署必须退出重登。
- IAM已有PasswordHasher窄契约、持久FailedAttempts/LockedUntil、账号版本更新和会话安全revision。Login会创建会话、可能启动MFA，不能拿来做解锁。
- Resolve会在正常活动时刷新空闲期限；本任务不应承诺整个HTTP链路只读或冻结空闲时间。新用例本身不刷新会话，沿用HTTP正常活动规则，绝对期限不变。
- 客户端锁状态按标签页sessionStorage持久化；ApplicationChrome已对背景使用inert。清除本地状态仍可绕过，不能宣称服务端授权边界。
- 2026-11-06实际打开参考Cloudreve `/home`，账户菜单仅观察到管理面板、个人主页、退出登录；没有观察到参考站密码锁屏，故此任务是修复本项目已公开缺口，不伪称复制参考站同名功能。

## 候选与结论

当前实现分类：密码哈希为成熟第三方经项目窄契约封装；锁屏密码复核是项目应用用例。保留现有Hasher、事务和预算；不用浏览器摘要验证真实凭据，不调用Login，不新增哈希库/通用认证框架。Go标准库仅负责输入长度与错误组合。现有IAM服务及composition足以承载，无新Capability、客户端或后台资源，无架构重构收益。

[OWASP指南](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)复核了统一失败反馈和持久限流的必要性；不能只靠界面禁用提交。其高风险再认证要求不套用于此客户端遮挡：复核结果不签发授权票据、不轮换或提高会话等级，MFA账号仍须已有有效登录会话。本任务不能用该接口绕过新登录MFA。

## 目标设计与推断

只接受当前会话及password，不接受目标账号。事务重读会话和账号、撤销/到期/revision；共享登录失败预算，成功重置错误计数，失败落库后返回错误。达到预算后即使密码正确也须等待既有锁定时间。客户端对离开/重锁/切换账号的迟到响应失效。失败不注销、不创建新Cookie，不把密码落入持久状态或日志。

## 局限、适用与刷新

适用于当前本地IAM。外部身份、服务端锁、可信再认证凭证均不在范围。普通请求的空闲续期和账号锁定并发遵循现有Repository乐观并发；冲突应显式失败、不得悄悄重试错误密码。实现后需集中验证并记录真实HTTP、移动英文深色与会话不更换的证据。未验证前不把目标设计写成已完成。
