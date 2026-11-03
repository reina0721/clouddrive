# 设计

复用 Page、outlined Section、DescriptionList、StatusPill、FoundationForm 和 Action。资料 embedded UserForm 只负责表单及普通动作行；外层账户 Section 组织只读身份摘要。密码表单最大阅读宽度使用已有 max-w-2xl，手机占满可用宽度。页面离开与会话撤销继续使用原 ConfirmDialog。

不扩展公共 Adapter／Foundation API；撤回旧弹层编辑尝试。Mock 与 Backend 接口、安全规则保持原版。
