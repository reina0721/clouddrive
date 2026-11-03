# R078-002 研究报告：MFA/TOTP 技术选型

## 1. 研究问题

用户追加「能否实现 MFA」；本报告回答 TOTP 的实现路径与技术选型（第三方库 vs 自研 RFC 6238）、与现有登录/会话/审计的衔接边界，以及实施范围建议。

## 2. 标准与事实

- **RFC 6238（IETF 官方标准，实现唯一权威依据）**：TOTP = HOTP(K, T) with T = (unix_time − T0) / X（默认 T0=0、X=30s）；HOTP 为 RFC 4226：HMAC-SHA1(secret, counter) 取动态二进位（8 字节）截断为 6 位数字。密钥为 RFC 4648 base32 编码随机字节（推荐 20 字节/160-bit）。校验通常允许 ±1 步时钟容差并做防重放（记录最近通过的时间步）。
- **互操作是硬要求**：目标是与 Google Authenticator 等标准验证器互通 → 必须严格遵循上述参数的 otpauth URI（`otpauth://totp/<issuer>:<user>?secret=<base32>&issuer=<issuer>&algorithm=SHA1&digits=6&period=30`）。
- **RFC 6238 附录 B 提供官方测试向量**（key `12345678901234567890`、时间与预期码列表），可自动化验证实现与外部验证器互通。
- **第三方候选 `pquerna/otp`**：业界成熟、Apache-2.0、提供密钥生成/otpauth URI/校验窗口；但**本次会话 web 检索通道不可用（认证失败），无法按 AGENTS 3.2 用其官方源码/文档/release/安全公告复核当前维护活跃度、版本与安全记录**——候选不能以不可复核的默认身份引入。

## 3. 方案对比

| 方案 | 做法 | 结论 |
| --- | --- | --- |
| A（推荐）**自研 RFC 6238 实现** | 标准库（crypto/hmac、crypto/sha1、crypto/rand、encoding/base32）：secret 生成→base32→otpauth URI；校验 HMAC-SHA1+30s 窗口±1+防重放；RFC 6238 附录 B 向量做互通测试；恢复码（一次性随机，sha256 存储） | 算法是公开标准、互操作有官方向量可验证、零第三方依赖与维护风险、安全边界完全可控；符合 AGENTS 3.2「候选无法复核时不以之为默认」 |
| B（不采纳）`pquerna/otp` | 引入第三方做全部 TOTP 原语 | 成熟但本次无法复核维护状态；引入后协议变化/替换成本高于本场景收益（本项目只做标准 TOTP，无多样式需求） |
| C（不采纳）短信/邮件 OTP | 依赖外部通道，非时间同步 | 需外部服务与用户手机号/邮箱体系，超出本地账号闭环，列为候选 |

## 4. 与既有体系的衔接边界（实施阶段）

- **登录第二步**：密码通过后若账号已绑定 TOTP → 不直接建会话，返回 `mfa_required`（稳定错误码）+ 一次性 `mfa_challenge`（短 TTL、单次）；`POST /api/v1/iam/login/mfa-verify {challenge, code}` 校验通过后建立会话并标记 `mfa_verified`（Session 元数据字段或新列，migration 00000x）。
- **绑定/解绑（自助）**：`POST /api/v1/iam/self/mfa/enroll`（生成 secret+URI 预览，未激活）、`POST .../confirm {code}`（验证码激活）、`POST .../disable {code|currentPassword}`（解绑需复核）；权限用 `iam:account:self:*` 既有自助键（不新增，或按需新增 `iam:self:mfa:*`——待需求确认）。
- **配置**：`iam.local.mfa`（`mode: optional|required`，默认 optional）与恢复码数量；required 模式对存量账号的宽限（产品决策）。
- **审计**：绑定/解绑/验证成功/失败接入既有 Auth 认证审计；恢复码使用记录。
- **受控边界**：不改变 iam-rbac 授权权威；MFA 只加强认证（会话建立前提）。
- **QR 呈现**：WebUI 安全页生成 otpauth URI 供扫码；QR 编码建议前端轻量方案（是否引入 qrcode 依赖另项评估），最小可用「显示 base32 key + URI 文本」。

## 5. 适用 / 不适用

- 适用：本地账号 + 标准验证器（GAuth 等）的双因素增强；与 077 口令治理互补。
- 不适用：无验证器场景的强制 MFA（需要短信/邮件外源，候选）；作为授权模型的一部分（MFA 只影响认证）。

## 6. 对本任务的影响

MFA/TOTP 实现路径确定为**自研 RFC 6238（方案 A）**；实施体量 M+（migration/绑定确认/登录两步/恢复码/会话标记/审计/WebUI/向量测试），涉及登录流程与 WebUI，建议作为独立变更（079）承接，不并入 078（API-Token）以免两件大工程互相拖累；本报告即其前置选型归档。