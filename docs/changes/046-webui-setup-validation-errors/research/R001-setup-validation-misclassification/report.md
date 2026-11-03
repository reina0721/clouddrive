# R001 Setup 输入错误被误报为 500

## 1. 已排除的原因

- 045 修复后，可信 Vite Origin 已能越过 CORS；不可信 Origin 仍返回 `403 cors_origin_denied`。
- 当前 `.data/app.db` 的 migration version 为 4，实际表是 `webui_users` 与 `webui_sessions`，两表均为空。旧 `admin_*` schema 已不再是本轮 500 的原因。
- 无效 Setup Token 会被 `ErrInvalidCredentials` 映射成 401，不会进入当前 500 分支。

## 2. 当前失败链

`Service.Setup` 在数据库事务前依次执行 Token、用户名和密码校验。`normalizeUsername` 与 `validatePassword` 对非法输入返回普通 `fmt.Errorf`；密码长度要求是 15 至 128 个 rune。`writeServiceError` 只识别锁定、setup 已关闭和凭据无效，其他错误全部返回 `500 internal_server_error`。

因此，空用户名、超长用户名或不满足长度的密码会被错误归类为服务端故障。用户日志中的 setup POST 为零耗时 500，与事务和密码哈希之前的输入校验路径一致；结合此前页面输入现象，短密码是当前最符合证据的触发条件。

## 3. 页面缺口

Setup 页面没有显示 15 至 128 字符要求，也没有表单长度约束。前端 API 只把响应 `code` 包装为 `Error.message`，页面直接显示机器码，用户无法区分输入错误和服务故障。

## 4. 边界

- Setup 的用户名和新密码校验可以返回明确 4xx，不涉及登录凭据枚举。
- Login 的错误仍应统一为 `invalid_credentials`，不能暴露用户名是否存在或密码规则。
- 未识别的存储、哈希、随机数和事务错误仍必须保持低敏 500，不能把内部错误文本返回浏览器。
- 本任务只修复 WebUI Auth 的窄错误契约，不借机迁移全项目 HTTP presenter。

## 5. 结论

根因已有运行态与代码双重证据，研究门禁通过。修复应建立可识别的输入校验错误、映射为稳定 400 code，并让 Setup 页面显示约束和中文提示；未知内部错误继续保持 500。
