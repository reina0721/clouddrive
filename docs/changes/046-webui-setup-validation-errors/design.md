# 046 WebUI Setup 输入校验错误设计

## 1. Service 错误类型

在 `webuiauth` owner 内为用户名非法和密码长度非法建立可由 `errors.Is` 识别的稳定错误。`normalizeUsername`、`validatePassword` 保留现有规则，只替换匿名 `fmt.Errorf`，不改变 15 至 128 rune 等业务语义。

不把原始输入附加到错误文本，不记录输入值。Login 保持现状，不复用这些具体错误向浏览器暴露凭据判断。

## 2. HTTP 映射

`writeServiceError` 增加两项窄映射：

| Service 错误 | HTTP | code |
| --- | --- | --- |
| 用户名非法 | 400 | `username_invalid` |
| 密码长度非法 | 400 | `password_length_invalid` |

既有 `invalid_credentials`、`setup_closed`、`account_locked` 不变；所有未知错误继续进入 `500 internal_server_error`。响应继续使用当前 WebUI Auth 的 `{code}` 形状，本任务不建立第二套全局 presenter。

## 3. Setup 页面

Setup 表单显示“密码长度为 15 至 128 个字符”，并增加适用的 `required`、`minLength` 与 `maxLength` 浏览器约束。页面建立局部、穷尽的稳定 code 到中文消息映射；未知 code 显示通用失败提示，不展示后端内部文本。

浏览器约束只改善即时反馈。Unicode 计数等最终结论仍以后端 rune 校验为准，后端返回的 `password_length_invalid` 必须可被页面正确解释。

## 4. 测试与文件影响

预计修改：

- `internal/module/auth/webuiauth/service.go`：typed validation errors；
- `internal/module/auth/webuiauth/http.go`：400 映射；
- `internal/module/auth/webuiauth/*_test.go`：规则与响应测试；
- `webui/src/pages/SetupPage.tsx`：约束说明和错误翻译；
- `docs/getting-started/webui.md`：补充 400 输入错误排障；
- 046 任务文档：确认、实施和验证证据。

验证覆盖短密码、空用户名、无效 Token、setup closed 与未知错误，随后执行 Go 全量测试和 WebUI 四项门禁。运行验收使用测试专用 Token，不输出或提交凭据。
