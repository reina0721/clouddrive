# 待人工审阅的视觉变化

保留来源仓库原有 Playwright 基线，未更新快照或提高差异阈值。当前两个测试失败，产生三组差异。需要按 [前端守则](../../../../../frontend/AGENTS.md) 人工确认后才能更新基线；规则原文：“视觉基线只能在人工确认变化合理后更新，不得用提高 diff 阈值掩盖回归。”

| 场景 | 来源基线 | 当前实际 | 差异图 |
| --- | --- | --- | --- |
| 320px 登录 | [原图](authentication-login-320-expected.png) | [实际](authentication-login-320-actual.png) | [差异](authentication-login-320-diff.png) |
| 320px 注册 | [原图](authentication-register-320-expected.png) | [实际](authentication-register-320-actual.png) | [差异](authentication-register-320-diff.png) |
| 320px 英文暗色大字号注册 | [原图](authentication-register-320-en-dark-large-expected.png) | [实际](authentication-register-320-en-dark-large-actual.png) | [差异](authentication-register-320-en-dark-large-diff.png) |

已知变化为 Community Console 品牌替换为 clouddrive、密码最少 15 字符及首次设置入口。品牌文字换行和整体高度随之变化。功能断言已通过，截图一致性尚未批准。来源历史变更目录中的图片已从原快照恢复，本次证据仅保存在 118 目录。
