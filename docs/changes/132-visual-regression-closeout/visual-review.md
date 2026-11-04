# 候选截图逐图审阅

2026-11-04，先生成`.data/132-candidate-snapshots/`，通过图像工具实际显示全部8张后才复制到原基线位置。不是批量接受未知图片，也不是用户逐张人工确认；用户当前goal已明确委托直接进行视觉分析与修复。默认`updateSnapshots:none`与1%容差保持。

| 候选 | 可见检查与接受原因 |
| --- | --- |
| authentication-login-320 | clouddrive品牌、邮箱密码和登录完整；Mock三种身份、重置提示与注册入口纵向可滚动，无横向裁切；保留当前真实演示能力 |
| authentication-register-320 | 四个字段和创建按钮完整；注册说明已改clouddrive，两行自然换行，密码提示未遮挡 |
| authentication-login-1440 | 两列登录布局，品牌、说明、Mock身份区和底部演示说明完整；整页高度来自原有角色区，不为匹配短旧图删除内容 |
| authentication-register-1440 | 两列注册布局、四个字段与说明可见，当前品牌一致，控件宽度未改变 |
| authentication-register-320-en-dark-large | 大字深色英文、密码确认输入与焦点环完整，产品说明与clouddrive一致；演示邮箱/密码作为原有明确Mock示例保留，不混入真实预览凭据 |
| ui-elements-select-open | 项目现行主导航与账户工具；Select滚动列表、底部执行队列12焦点环及禁用Combobox示例保持；原控件尺寸未变化 |
| ui-elements-combobox-open | 输入Mika后仅Mika Sato候选、焦点环、选中后的执行队列12可见；Popup保持与输入框同宽 |
| reference-resources-desktop | 内容就绪后显示标题和Alpha/Beta/Gamma全部3条卡片，三条查看/编辑链接、两种状态徽标和现行导航齐全，没有将loading图作为新基线 |

这些是Next开发模式的Mock演示截图，左下角开发工具标识属于测试运行环境；真实预览仍使用生产构建和后端模式。未改变公共Token、组件或导航结构。旧基线可从Git恢复；本机`.data/132-baseline-review.json`记录8张原图/候选SHA256和复制时间。仓库只提交这8张正式基线，不提交ignored候选、报告、Cookie或真实凭据。
