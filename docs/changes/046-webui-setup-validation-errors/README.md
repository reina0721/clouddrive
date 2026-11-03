# 046 WebUI Setup 输入校验错误闭环

状态：已完成。

## 范围

本变更修复 WebUI 首次设置时，用户名或密码不符合约束却返回 `500 internal_server_error` 的错误语义，并让 Setup 页面在提交前说明密码长度要求、在失败后显示可操作的中文提示。

本变更不修改密码长度、Setup Token、Session、Cookie、Origin、数据库结构或登录凭据失败语义。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求](requirements.md)
3. [设计](design.md)
4. [任务](tasks.md)
