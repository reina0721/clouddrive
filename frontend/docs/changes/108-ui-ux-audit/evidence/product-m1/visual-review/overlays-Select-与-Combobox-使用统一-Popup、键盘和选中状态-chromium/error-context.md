# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: overlays.spec.ts >> Select 与 Combobox 使用统一 Popup、键盘和选中状态
- Location: apps\web\e2e\overlays.spec.ts:600:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  9825 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: ui-elements-select-open.png

Call log:
  - Expect "soft toHaveScreenshot(ui-elements-select-open.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 9825 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 9825 pixels (ratio 0.02 of all image pixels) are different.

```

```
Error: expect(page).toHaveScreenshot(expected) failed

  9825 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: ui-elements-combobox-open.png

Call log:
  - Expect "soft toHaveScreenshot(ui-elements-combobox-open.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 9825 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 9825 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e1]:
    - generic [ref=e2]:
        - log [ref=e3]:
            - generic [ref=e4]: 有 14 个选项可用。
            - generic [ref=e5]: 有 1 个选项可用。
        - log
    - button "Open Next.js Dev Tools" [ref=e11] [cursor=pointer]
    - alert [ref=e15]
    - link "跳到主要内容 / Skip to content" [ref=e16] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=e17]:
        - complementary [ref=e18]:
            - generic [ref=e19]:
                - generic [ref=e20]: C
                - generic [ref=e22]:
                    - paragraph [ref=e23]: clouddrive
                    - paragraph [ref=e24]: 管理工作空间
            - navigation "主导航" [ref=e25]:
                - generic [ref=e26]:
                    - paragraph [ref=e27]: 工作空间
                    - list "工作空间" [ref=e28]:
                        - listitem [ref=e29]:
                            - link "工作台" [ref=e30] [cursor=pointer]:
                                - /url: /
                - generic [ref=e38]:
                    - paragraph [ref=e39]: 个人
                    - list "个人" [ref=e40]:
                        - listitem [ref=e41]:
                            - link "个人偏好" [ref=e42] [cursor=pointer]:
                                - /url: /settings
                - generic [ref=e48]:
                    - paragraph [ref=e49]: 开发中心
                    - list "开发中心" [ref=e50]:
                        - listitem [ref=e51]:
                            - button "展开或收起UI Elements" [expanded] [ref=e52]:
                                - generic [ref=e59]: UI Elements
                            - list [ref=e62]:
                                - listitem [ref=e63]:
                                    - link "操作与选择" [ref=e64] [cursor=pointer]:
                                        - /url: /ui-elements/actions-selection
                                - listitem [ref=e73]:
                                    - link "反馈" [ref=e74] [cursor=pointer]:
                                        - /url: /ui-elements/feedback
                                - listitem [ref=e79]:
                                    - link "状态与异步" [ref=e80] [cursor=pointer]:
                                        - /url: /ui-elements/status-async
                                - listitem [ref=e85]:
                                    - link "身份与展示" [ref=e86] [cursor=pointer]:
                                        - /url: /ui-elements/identity-display
                                - listitem [ref=e93]:
                                    - link "导航" [ref=e94] [cursor=pointer]:
                                        - /url: /ui-elements/navigation
                                - listitem [ref=e104]:
                                    - link "数据展示" [ref=e105] [cursor=pointer]:
                                        - /url: /ui-elements/data
                                - listitem [ref=e110]:
                                    - link "表面与卡片" [ref=e111] [cursor=pointer]:
                                        - /url: /ui-elements/surfaces
                                - listitem [ref=e116]:
                                    - link "表单控件" [ref=e117] [cursor=pointer]:
                                        - /url: /ui-elements/forms
                                - listitem [ref=e123]:
                                    - link "浮层与弹出界面" [ref=e124] [cursor=pointer]:
                                        - /url: /ui-elements/overlays
                        - listitem [ref=e131]:
                            - button "展开或收起Page Patterns" [ref=e132]:
                                - generic [ref=e139]: Page Patterns
                        - listitem [ref=e142]:
                            - button "展开或收起Page Archetypes" [ref=e143]:
                                - generic [ref=e147]: Page Archetypes
                        - listitem [ref=e150]:
                            - link "参考资源" [ref=e151] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=e156]:
                            - link "Icon 大全" [ref=e157] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=e164]:
                            - link "基座能力" [ref=e165] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=e178]:
                            - link "Motion" [ref=e179] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=e188]:
                            - link "状态体系" [ref=e189] [cursor=pointer]:
                                - /url: /states
        - generic [ref=e196]:
            - banner [ref=e198]:
                - button "收起侧栏" [ref=e200] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=e202] [cursor=pointer]
                - generic [ref=e203]:
                    - generic [ref=e204]:
                        - button "切换语言" [ref=e205] [cursor=pointer]
                        - button "切换主题" [ref=e206] [cursor=pointer]
                    - button "通知" [ref=e207]
                    - button "当前用户" [ref=e211] [cursor=pointer]:
                        - generic [ref=e213]:
                            - generic "Rin" [ref=e216]: RI
                            - generic [ref=e217]: Rin
            - main [ref=e221]:
                - generic [ref=e223]:
                    - generic [ref=e224]:
                        - list "面包屑导航" [ref=e225]:
                            - listitem [ref=e226]:
                                - link "基座验证" [ref=e227] [cursor=pointer]
                                - generic [ref=e228]: /
                            - listitem [ref=e229]:
                                - link "UI Elements" [ref=e230] [cursor=pointer]
                                - generic [ref=e231]: /
                            - listitem [ref=e232]:
                                - link "Fields 与 Pickers" [disabled]
                        - generic [ref=e234]:
                            - paragraph [ref=e235]: UI Elements · Catalog
                            - heading "Fields 与 Pickers" [level=1] [ref=e236]
                            - paragraph [ref=e237]: 同时覆盖默认、错误、禁用、Popup、选中和长文本状态。
                    - generic [ref=e238]:
                        - generic [ref=e239]:
                            - generic [ref=e240]: 展示密度
                            - button "舒适 展示密度" [ref=e241] [cursor=pointer]:
                                - generic [ref=e242]: 舒适
                            - combobox [ref=e249]
                        - generic [ref=e251] [cursor=pointer]:
                            - switch "扩展文本" [ref=e253]
                            - generic [ref=e254]:
                                - generic [ref=e255]: 扩展文本
                                - generic [ref=e256]: 切换到极长内容以验证传播范围。
                        - generic [ref=e260] [cursor=pointer]:
                            - switch "English Locale" [ref=e262]
                            - generic [ref=e263]:
                                - generic [ref=e264]: English Locale
                                - generic [ref=e265]: 切换中英文并观察文本扩张与布局。
                    - region "UI Elements 分类导航" [ref=e269]:
                        - generic [ref=e270]:
                            - generic [ref=e271]:
                                - paragraph [ref=e272]: 公开契约目录
                                - heading "Fields 与 Pickers" [level=2] [ref=e273]
                                - paragraph [ref=e274]: 同时覆盖默认、错误、禁用、Popup、选中和长文本状态。
                            - generic [ref=e275]: 10 / 公开 Element 46 / 46
                        - navigation "UI Elements 分类导航" [ref=e277]:
                            - link "操作与选择 · 3" [ref=e278] [cursor=pointer]:
                                - /url: /ui-elements/actions-selection
                            - link "反馈 · 4" [ref=e281] [cursor=pointer]:
                                - /url: /ui-elements/feedback
                            - link "状态与异步 · 7" [ref=e284] [cursor=pointer]:
                                - /url: /ui-elements/status-async
                            - link "身份与展示 · 4" [ref=e287] [cursor=pointer]:
                                - /url: /ui-elements/identity-display
                            - link "导航 · 7" [ref=e290] [cursor=pointer]:
                                - /url: /ui-elements/navigation
                            - link "数据展示 · 1" [ref=e293] [cursor=pointer]:
                                - /url: /ui-elements/data
                            - link "表面与卡片 · 2" [ref=e296] [cursor=pointer]:
                                - /url: /ui-elements/surfaces
                            - link "表单控件 · 10" [ref=e299] [cursor=pointer]:
                                - /url: /ui-elements/forms
                            - link "浮层与弹出界面 · 8" [ref=e302] [cursor=pointer]:
                                - /url: /ui-elements/overlays
                    - navigation "本页区段" [ref=e305]:
                        - link "Fields 与 Pickers" [ref=e306] [cursor=pointer]:
                            - /url: /ui-elements/forms#forms
                        - link "TextField" [ref=e307] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-textfield
                        - link "PasswordField" [ref=e308] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-passwordfield
                        - link "TextAreaField" [ref=e309] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-textareafield
                        - link "SearchBox" [ref=e310] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-searchbox
                        - link "SelectField" [ref=e311] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-selectfield
                        - link "ComboField" [ref=e312] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-combofield
                        - link "DatePickerField" [ref=e313] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-datepickerfield
                        - link "CheckboxField" [ref=e314] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-checkboxfield
                        - link "RadioGroupField" [ref=e315] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-radiogroupfield
                        - link "SwitchField" [ref=e316] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-switchfield
                        - link "FormErrorSummary" [ref=e317] [cursor=pointer]:
                            - /url: /ui-elements/forms#element-formerrorsummary
                    - generic [ref=e319]:
                        - generic [ref=e321]:
                            - heading "Fields 与 Pickers" [level=2] [ref=e322]
                            - paragraph [ref=e323]: 同时覆盖默认、错误、禁用、Popup、选中和长文本状态。
                        - generic [ref=e325]:
                            - generic [ref=e326]:
                                - generic [ref=e327]:
                                    - generic [ref=e328]:
                                        - heading "TextField" [level=3] [ref=e329]
                                        - generic "TextField 状态" [ref=e330]:
                                            - generic [ref=e331]: 默认
                                            - generic [ref=e333]: 提示
                                            - generic [ref=e335]: 无效
                                            - generic [ref=e337]: 禁用
                                            - generic [ref=e339]: 占位文本
                                            - generic [ref=e341]: 长内容
                                    - paragraph [ref=e343]: TextField 保持 Label、Control、Hint 与 Error 的单一 Field owner。
                                - generic [ref=e345]:
                                    - generic [ref=e346]:
                                        - generic [ref=e347]: 文本输入
                                        - textbox "文本输入" [ref=e348]:
                                            - /placeholder: 请输入内容
                                        - generic [ref=e349]: 帮助文本必须与输入状态保持可读关联。
                                    - generic [ref=e350]:
                                        - generic [ref=e351]: 错误输入
                                        - textbox "错误输入" [invalid] [ref=e352]: x
                                        - generic [ref=e353]: 该值不满足当前契约。
                                    - generic [ref=e354]:
                                        - generic: 禁用输入
                                        - textbox "禁用输入" [disabled]: readonly
                            - generic [ref=e355]:
                                - generic [ref=e356]:
                                    - generic [ref=e357]:
                                        - heading "PasswordField" [level=3] [ref=e358]
                                        - generic "PasswordField 状态" [ref=e359]:
                                            - generic [ref=e360]: 默认
                                            - generic [ref=e362]: 密码可见
                                            - generic [ref=e364]: 无效
                                            - generic [ref=e366]: 禁用
                                            - generic [ref=e368]: 键盘
                                            - generic [ref=e370]: 自动填充
                                    - paragraph [ref=e372]: 复用 HeroUI InputGroup，提供密码显示、自动填充、错误与禁用语义。
                                - generic [ref=e374]:
                                    - generic [ref=e375]:
                                        - generic [ref=e376]: 密码输入
                                        - textbox "密码输入" [ref=e377]
                                        - button "显示密码" [ref=e379] [cursor=pointer]
                                        - generic [ref=e380]: 帮助文本必须与输入状态保持可读关联。
                                    - generic [ref=e381]:
                                        - generic [ref=e382]: 错误输入
                                        - textbox "错误输入" [invalid] [ref=e383]
                                        - button "显示密码" [ref=e385] [cursor=pointer]
                                        - generic [ref=e386]: 该值不满足当前契约。
                                    - generic [ref=e387]:
                                        - generic: 禁用输入
                                        - textbox "禁用输入" [disabled]
                                        - generic:
                                            - button "显示密码" [disabled]
                            - generic [ref=e388]:
                                - generic [ref=e389]:
                                    - generic [ref=e390]:
                                        - heading "TextAreaField" [level=3] [ref=e391]
                                        - generic "TextAreaField 状态" [ref=e392]:
                                            - generic [ref=e393]: 默认
                                            - generic [ref=e395]: 提示与错误
                                            - generic [ref=e397]: 禁用
                                            - generic [ref=e399]: 数据行
                                            - generic [ref=e401]: 尺寸调整
                                            - generic [ref=e403]: 长内容
                                    - paragraph [ref=e405]: TextAreaField 复用 Field 状态，并保留多行、长内容和调整高度能力。
                                - generic [ref=e407]:
                                    - generic [ref=e408]: 多行文本
                                    - textbox "多行文本" [ref=e409]: 这是用于验证正常内容节奏的短说明。
                                    - generic [ref=e410]: 帮助文本必须与输入状态保持可读关联。
                            - generic [ref=e411]:
                                - generic [ref=e412]:
                                    - generic [ref=e413]:
                                        - heading "SearchBox" [level=3] [ref=e414]
                                        - generic "SearchBox 状态" [ref=e415]:
                                            - generic [ref=e416]: 值
                                            - generic [ref=e418]: 清除
                                            - generic [ref=e420]: 禁用
                                            - generic [ref=e422]: 无障碍标签
                                    - paragraph [ref=e424]: SearchBox 是搜索交互组合，拥有搜索图标、清除动作和可访问名称。
                                - generic [ref=e426]:
                                    - group [ref=e428]:
                                        - searchbox "搜索 UI Elements 数据" [ref=e429]: UI
                                        - button "Close" [ref=e430] [cursor=pointer]
                                    - generic [ref=e431]:
                                        - group:
                                            - searchbox "禁用搜索" [disabled]
                                            - button "Close" [disabled]
                            - generic [ref=e432]:
                                - generic [ref=e433]:
                                    - generic [ref=e434]:
                                        - heading "SelectField" [level=3] [ref=e435]
                                        - generic "SelectField 状态" [ref=e436]:
                                            - generic [ref=e437]: 选中
                                            - generic [ref=e439]: 禁用选项
                                            - generic [ref=e441]: 禁用字段
                                            - generic [ref=e443]: 弹出层滚动
                                            - generic [ref=e445]: 键盘
                                    - paragraph [ref=e447]: Select 从有限集合选择值；Popup、Selection 与 Keyboard 由 HeroUI 管理。
                                - generic [ref=e449]:
                                    - generic [ref=e450]:
                                        - generic [ref=e451]: Select
                                        - button "执行队列 12 Select" [ref=e452] [cursor=pointer]:
                                            - generic [ref=e453]: 执行队列 12
                                        - generic [ref=e458]: 打开后验证大量选项、内部滚动、键盘 Focus、Selected 与 Disabled。
                                        - combobox [ref=e461]
                                    - generic [ref=e462]:
                                        - generic: 禁用输入
                                        - button "引导执行 禁用输入" [disabled]:
                                            - generic: 引导执行
                                        - combobox [disabled] [ref=e465]
                            - generic [ref=e466]:
                                - generic [ref=e467]:
                                    - generic [ref=e468]:
                                        - heading "ComboField" [level=3] [ref=e469]
                                        - generic "ComboField 状态" [ref=e470]:
                                            - generic [ref=e471]: 筛选
                                            - generic [ref=e473]: 选中
                                            - generic [ref=e475]: 禁用选项
                                            - generic [ref=e477]: 禁用字段
                                            - generic [ref=e479]: 弹出层滚动
                                    - paragraph [ref=e481]: ComboField 允许筛选候选，不与普通 Select 或 Command Menu 混用。
                                - generic [ref=e483]:
                                    - generic [ref=e484]:
                                        - generic [ref=e485]: Combobox
                                        - group [ref=e486]:
                                            - combobox "Combobox" [active] [ref=e487]: Mika Sato
                                            - button "显示建议 Combobox" [ref=e488] [cursor=pointer]
                                        - generic [ref=e491]: 打开后验证大量选项、内部滚动、键盘 Focus、Selected 与 Disabled。
                                    - generic [ref=e492]:
                                        - generic: 禁用输入
                                        - group [ref=e493]:
                                            - combobox "禁用输入" [disabled]
                                            - button "显示建议 禁用输入" [disabled] [ref=e494]
                            - generic [ref=e497]:
                                - generic [ref=e498]:
                                    - generic [ref=e499]:
                                        - heading "DatePickerField" [level=3] [ref=e500]
                                        - generic "DatePickerField 状态" [ref=e501]:
                                            - generic [ref=e502]: 日期分段
                                            - generic [ref=e504]: 弹出层
                                            - generic [ref=e506]: 选中日期
                                            - generic [ref=e508]: 禁用
                                            - generic [ref=e510]: 键盘
                                    - paragraph [ref=e512]: DatePickerField 组合可编辑日期段和日历 Popup，并保留键盘与禁用状态。
                                - generic [ref=e514]:
                                    - generic [ref=e515]:
                                        - generic [ref=e516]: DatePicker
                                        - group [ref=e517]:
                                            - spinbutton "年, DatePicker" [ref=e518]: 年
                                            - generic [ref=e519]: /
                                            - spinbutton "月, DatePicker" [ref=e520]: 月
                                            - generic [ref=e521]: /
                                            - spinbutton "日, DatePicker" [ref=e522]: 日
                                            - button "日历 DatePicker" [ref=e524] [cursor=pointer]
                                        - generic [ref=e528]: 打开后检查 Popup 的主题、Focus、Selected 与 Disabled 状态。
                                    - textbox [ref=e530]
                                    - generic [ref=e531]:
                                        - generic: 禁用输入
                                        - group "禁用输入" [disabled]:
                                            - spinbutton "年, 禁用输入" [disabled]: 年
                                            - generic: /
                                            - spinbutton "月, 禁用输入" [disabled]: 月
                                            - generic: /
                                            - spinbutton "日, 禁用输入" [disabled]: 日
                                            - generic [ref=e532]:
                                                - button "日历 禁用输入" [disabled]
                                    - textbox [disabled] [ref=e534]
                            - generic [ref=e535]:
                                - generic [ref=e536]:
                                    - generic [ref=e537]:
                                        - heading "CheckboxField" [level=3] [ref=e538]
                                        - generic "CheckboxField 状态" [ref=e539]:
                                            - generic [ref=e540]: 选中
                                            - generic [ref=e542]: 未选中
                                            - generic [ref=e544]: 说明
                                            - generic [ref=e546]: 禁用
                                    - paragraph [ref=e548]: CheckboxField 表达独立布尔值，Label 与说明只出现一次。
                                - generic [ref=e550]:
                                    - generic [ref=e552] [cursor=pointer]:
                                        - checkbox "复选项" [checked] [ref=e554]
                                        - generic [ref=e555]: ✓
                                        - generic [ref=e556]:
                                            - generic [ref=e557]: 复选项
                                            - generic [ref=e558]: 验证标签、说明与 Control 的组合。
                                    - generic:
                                        - generic:
                                            - generic:
                                                - checkbox "禁用复选项" [disabled]
                                            - generic: ✓
                                            - generic: 禁用复选项
                            - generic [ref=e559]:
                                - generic [ref=e560]:
                                    - generic [ref=e561]:
                                        - heading "RadioGroupField" [level=3] [ref=e562]
                                        - generic "RadioGroupField 状态" [ref=e563]:
                                            - generic [ref=e564]: 选中
                                            - generic [ref=e566]: 禁用选项
                                            - generic [ref=e568]: 提示与错误
                                            - generic [ref=e570]: 键盘
                                    - paragraph [ref=e572]: RadioGroupField 表达表单单选值，与即时 ToggleGroup 保持职责分离。
                                - generic [ref=e573]:
                                    - radiogroup "反馈密度" [ref=e574]:
                                        - generic [ref=e578]:
                                            - generic [ref=e580] [cursor=pointer]:
                                                - radio "仅观察" [ref=e582]
                                                - generic [ref=e584]: 仅观察
                                            - generic [ref=e587] [cursor=pointer]:
                                                - radio "引导执行" [ref=e589]
                                                - generic [ref=e591]: 引导执行
                                            - generic:
                                                - generic:
                                                    - generic:
                                                        - radio "自动执行" [disabled]
                                                    - generic: 自动执行
                                    - radiogroup "图标选择卡片" [ref=e593]:
                                        - generic [ref=e599]:
                                            - generic [ref=e600]: 图标选择卡片
                                            - generic [ref=e601]: RadioGroupField 表达表单单选值，与即时 ToggleGroup 保持职责分离。
                                        - generic [ref=e602]:
                                            - generic [ref=e604] [cursor=pointer]:
                                                - radio "仅观察" [ref=e606]
                                                - generic [ref=e611]: 仅观察
                                            - generic [ref=e614] [cursor=pointer]:
                                                - radio "引导执行" [ref=e616]
                                                - generic [ref=e621]: 引导执行
                                            - generic:
                                                - generic:
                                                    - generic:
                                                        - radio "自动执行" [disabled]
                                                    - generic: 自动执行
                                    - radiogroup "简短选项" [ref=e623]:
                                        - generic [ref=e627]:
                                            - generic [ref=e629] [cursor=pointer]:
                                                - radio "仅观察" [ref=e631]
                                                - generic [ref=e633]: 仅观察
                                            - generic [ref=e636] [cursor=pointer]:
                                                - radio "引导执行" [ref=e638]
                                                - generic [ref=e640]: 引导执行
                                            - generic:
                                                - generic:
                                                    - generic:
                                                        - radio "自动执行" [disabled]
                                                    - generic: 自动执行
                                    - radiogroup "比较预览" [ref=e642]:
                                        - generic [ref=e644]:
                                            - generic [ref=e645]: 比较预览
                                            - generic [ref=e646]: RadioGroupField 表达表单单选值，与即时 ToggleGroup 保持职责分离。
                                        - generic [ref=e647]:
                                            - generic [ref=e649] [cursor=pointer]:
                                                - radio "仅观察" [ref=e651]
                                                - generic [ref=e652]: 仅观察
                                            - generic [ref=e655] [cursor=pointer]:
                                                - radio "引导执行" [ref=e657]
                                                - generic [ref=e658]: 引导执行
                                            - generic:
                                                - generic:
                                                    - generic:
                                                        - radio "自动执行" [disabled]
                                                    - generic: 自动执行
                            - generic [ref=e660]:
                                - generic [ref=e661]:
                                    - generic [ref=e662]:
                                        - heading "SwitchField" [level=3] [ref=e663]
                                        - generic "SwitchField 状态" [ref=e664]:
                                            - generic [ref=e665]: 开启
                                            - generic [ref=e667]: 关闭
                                            - generic [ref=e669]: 禁用
                                            - generic [ref=e671]: 说明
                                    - paragraph [ref=e673]: SwitchField 表达立即生效的开关状态，并在相邻说明中解释影响。
                                - generic [ref=e675]:
                                    - generic [ref=e677] [cursor=pointer]:
                                        - switch "扩展文本" [ref=e679]
                                        - generic [ref=e680]:
                                            - generic [ref=e681]: 扩展文本
                                            - generic [ref=e682]: 切换到极长内容以验证传播范围。
                                    - generic:
                                        - generic:
                                            - generic:
                                                - switch "不可用" [disabled]
                                            - generic:
                                                - generic: 不可用
                                                - generic: 禁用状态保留清晰标签和原因说明。
                                    - generic [ref=e686] [cursor=pointer]:
                                        - switch "设置行开关" [ref=e688]
                                        - generic [ref=e689]:
                                            - generic [ref=e690]: 设置行开关
                                            - generic [ref=e691]: 切换到极长内容以验证传播范围。
                            - generic [ref=e694]:
                                - generic [ref=e695]:
                                    - generic [ref=e696]:
                                        - heading "FormErrorSummary" [level=3] [ref=e697]
                                        - generic "FormErrorSummary 状态" [ref=e698]:
                                            - generic [ref=e699]: 空状态
                                            - generic [ref=e701]: 多个错误
                                            - generic [ref=e703]: 焦点恢复
                                            - generic [ref=e705]: 动态警示
                                    - paragraph [ref=e707]: 提交失败时汇总错误并定位字段；字段保留就地错误。
                                - alert [ref=e709]:
                                    - heading "请修正以下字段" [level=2] [ref=e710]
                                    - list [ref=e711]:
                                        - listitem [ref=e712]:
                                            - link "场景名称：请输入 3 至 80 个字符。" [ref=e713] [cursor=pointer]:
                                                - /url: '#name'
                                        - listitem [ref=e714]:
                                            - link "负责人：请选择负责人。" [ref=e715] [cursor=pointer]:
                                                - /url: '#owner'
```

# Test source

```ts
  532 |     const wrap = item.querySelector('span.grid');
  533 |     if (!(wrap instanceof HTMLElement)) return null;
  534 |     const s = getComputedStyle(wrap);
  535 |     return {
  536 |       bg: s.backgroundColor,
  537 |       borderW: s.borderTopWidth,
  538 |       radius: s.borderRadius,
  539 |       shadow: s.boxShadow,
  540 |     };
  541 |   });
  542 |   expect(inner).not.toBeNull();
  543 |   expect(inner?.bg).toBe('rgba(0, 0, 0, 0)');
  544 |   expect(inner?.borderW).toBe('0px');
  545 |   expect(inner?.shadow).toContain('none');
  546 |
  547 |   // icon wrapper 内 svg 四向 margin = 0（vendor 纵向 margin 被清理，保证与文字共轴）
  548 |   const iconSvgMargin = await toggleItem
  549 |     .locator('svg')
  550 |     .first()
  551 |     .evaluate((svg) => getComputedStyle(svg).margin);
  552 |   expect(iconSvgMargin).toBe('0px');
  553 |
  554 |   // single：连续 segmented（容器 gap 0，不拆散）
  555 |   const singleGroup = page.getByRole('radiogroup', { name: '视图模式' });
  556 |   await expect(singleGroup).toHaveCSS('gap', '0px');
  557 |   const singleItemRadius = await toggleItem.evaluate((el) => getComputedStyle(el).borderRadius);
  558 |   expect(singleItemRadius).not.toBe('0px'); // 保留自身语义 radius（无 attached 裁剪）
  559 |
  560 |   // multiple：每个 item 独立几何 + 语义 gap（可见列）
  561 |   const multiGroup = page.getByRole('toolbar', { name: '可见列' });
  562 |   await expect(multiGroup).not.toHaveCSS('gap', '0px');
  563 |   const multiGeom = await multiGroup.evaluate((group) => {
  564 |     const items = [...group.querySelectorAll('[data-slot="toggle-button"]')] as HTMLElement[];
  565 |     return items.map((it, index) => {
  566 |       const cs = getComputedStyle(it);
  567 |       const r = it.getBoundingClientRect();
  568 |       const prev = items[index - 1];
  569 |       const gap = prev
  570 |         ? Math.round(
  571 |             r.left - (prev.getBoundingClientRect().left + prev.getBoundingClientRect().width),
  572 |           )
  573 |         : 0;
  574 |       return {
  575 |         label: (it.textContent || '').trim().slice(0, 6),
  576 |         radius: cs.borderRadius,
  577 |         borderTop: cs.borderTopWidth,
  578 |         borderRight: cs.borderRightWidth,
  579 |         borderBottom: cs.borderBottomWidth,
  580 |         borderLeft: cs.borderLeftWidth,
  581 |         gapToPrev: gap,
  582 |       };
  583 |     });
  584 |   });
  585 |   expect(multiGeom.length).toBeGreaterThanOrEqual(2);
  586 |   for (const item of multiGeom) {
  587 |     // 独立几何：四边 border 完整、radius 完整（无 attached 中间项/首尾裁剪）
  588 |     expect(item.borderTop).not.toBe('0px');
  589 |     expect(item.borderRight).not.toBe('0px');
  590 |     expect(item.borderBottom).not.toBe('0px');
  591 |     expect(item.borderLeft).not.toBe('0px');
  592 |     expect(item.radius).not.toBe('0px');
  593 |   }
  594 |   // items 之间有 semantic gap（> 0）
  595 |   for (let i = 1; i < multiGeom.length; i += 1) {
  596 |     expect(multiGeom[i]?.gapToPrev ?? 0).toBeGreaterThan(0);
  597 |   }
  598 | });
  599 |
  600 | test('Select 与 Combobox 使用统一 Popup、键盘和选中状态', async ({ page }) => {
  601 |   await page.goto('/ui-elements/forms');
  602 |   await page.getByRole('button', { name: '引导执行 Select' }).click();
  603 |   const selectListbox = page.getByRole('listbox');
  604 |   await expect(selectListbox).toBeVisible();
  605 |   await expect(page.getByRole('option', { name: '自动执行' })).toBeDisabled();
  606 |   await assertMatchesTriggerWidth(page, 'select-popover');
  607 |   await assertListboxScrolls(page);
  608 |   await expect(page.getByRole('option', { name: '执行队列 12' })).toBeVisible();
  609 |   await expect.soft(page).toHaveScreenshot('ui-elements-select-open.png');
  610 |   await page.keyboard.press('Enter');
  611 |   await expect(page.getByRole('button', { name: '执行队列 12 Select' })).toBeVisible();
  612 |
  613 |   const combo = page.getByRole('combobox', { name: 'Combobox' });
  614 |   await combo.click();
  615 |   await expect(page.getByRole('option', { name: 'Omar Haddad' })).toBeDisabled();
  616 |   await assertMatchesTriggerWidth(page, 'combo-box-popover');
  617 |   await assertListboxScrolls(page);
  618 |
  619 |   // ComboField 只有一个 Field Surface：InputGroup 不承担边框/阴影，边框落在内部 Input 上
  620 |   const comboInputGroup = page.locator('[data-slot="combo-box-input-group"]').first();
  621 |   await expect(comboInputGroup).not.toHaveClass(/ui-field-control/);
  622 |   const comboSurface = page
  623 |     .locator('[data-slot="combo-box-input-group"] [data-slot="input"]')
  624 |     .first();
  625 |   await expect(comboSurface).toHaveClass(/ui-field-control/);
  626 |
  627 |   await page.keyboard.press('Escape');
  628 |   await combo.click();
  629 |   await combo.fill('Mika');
  630 |   await expect(page.getByRole('option', { name: 'Mika Sato' })).toBeVisible();
  631 |   await assertMatchesTriggerWidth(page, 'combo-box-popover');
> 632 |   await expect.soft(page).toHaveScreenshot('ui-elements-combobox-open.png');
      |                           ^ Error: expect(page).toHaveScreenshot(expected) failed
  633 |   await page.keyboard.press('ArrowDown');
  634 |   await page.keyboard.press('Enter');
  635 |   await expect(combo).toHaveValue('Mika Sato');
  636 |   await assertOverlayAccessibility(page);
  637 | });
  638 |
  639 | test('Dropdown、Popover 与 Tooltip 展开面进入视觉回归', async ({ page }) => {
  640 |   await page.goto('/ui-elements/overlays');
  641 |   const menuTrigger = page.getByRole('button', { name: 'Reference 操作菜单' });
  642 |   await menuTrigger.click();
  643 |   await expect(page.getByRole('menu')).toBeVisible();
  644 |   await expect.soft(page).toHaveScreenshot('ui-elements-menu-open.png');
  645 |   await page.keyboard.press('Escape');
  646 |   await expect(menuTrigger).toBeFocused();
  647 |
  648 |   const popoverTrigger = page.getByRole('button', { name: 'Popover' });
  649 |   const pageHeightBeforeOpen = await page
  650 |     .locator('html')
  651 |     .evaluate((element) => element.scrollHeight);
  652 |   await popoverTrigger.click();
  653 |   const popover = page.getByRole('dialog', { name: '组合提示' });
  654 |   await expect(popover).toBeVisible();
  655 |   // The reference grows as capabilities are added; collision handling may flip the overlay above.
  656 |   await expect
  657 |     .poll(async () => {
  658 |       const anchor = await popoverTrigger.evaluate((element) => element.getBoundingClientRect());
  659 |       const overlay = await popover.evaluate((element) => element.getBoundingClientRect());
  660 |       const viewport = page.viewportSize();
  661 |       return (
  662 |         viewport !== null &&
  663 |         overlay.left >= 0 &&
  664 |         overlay.right <= viewport.width &&
  665 |         overlay.top >= 0 &&
  666 |         overlay.bottom <= viewport.height &&
  667 |         (overlay.top >= anchor.bottom || overlay.bottom <= anchor.top)
  668 |       );
  669 |     })
  670 |     .toBe(true);
  671 |   await expect(popover).toBeFocused();
  672 |   const pageHeightAfterOpen = await page
  673 |     .locator('html')
  674 |     .evaluate((element) => element.scrollHeight);
  675 |   expect(pageHeightAfterOpen).toBe(pageHeightBeforeOpen);
  676 |   await expect.soft(page).toHaveScreenshot('ui-elements-popover-open.png');
  677 |   await page.keyboard.press('Escape');
  678 |   await expect(popover).toBeHidden();
  679 |   await expect(popoverTrigger).toBeFocused();
  680 |
  681 |   const tooltipTrigger = page.getByRole('button', { name: 'Tooltip' });
  682 |   await tooltipTrigger.focus();
  683 |   await expect(page.getByRole('tooltip')).toBeVisible();
  684 |   await expect.soft(page).toHaveScreenshot('ui-elements-tooltip-open.png');
  685 | });
  686 |
  687 | test('DatePicker 与 Command 展开面支持键盘及无障碍扫描', async ({ page }) => {
  688 |   await page.goto('/ui-elements/forms');
  689 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  690 |   const datePickerTrigger = page.getByRole('button', { name: '日历 DatePicker' });
  691 |   // Focus entry stabilizes the project's Reveal before measuring the offscreen anchor.
  692 |   await datePickerTrigger.focus();
  693 |   // 触发元素位于首屏之外：先滚动进入视口再点击，避免打开弹层时的滚动定位竞态
  694 |   // （页面转场组件加入后，点击视口外触发器会偶发改变锚点测量结果）
  695 |   await datePickerTrigger.evaluate((element) =>
  696 |     element.scrollIntoView({ behavior: 'instant', block: 'center' }),
  697 |   );
  698 |   await datePickerTrigger.click();
  699 |   await expect(page.getByRole('dialog')).toBeVisible();
  700 |   await expect(page.getByRole('dialog').getByRole('grid')).toBeVisible();
  701 |   await waitForVisualReadiness(page);
  702 |   await expect.soft(page).toHaveScreenshot('ui-elements-date-picker-open.png');
  703 |   await page.keyboard.press('Escape');
  704 |
  705 |   await page.goto('/ui-elements/overlays');
  706 |   await page.getByRole('button', { name: 'Command' }).click();
  707 |   const commandDialog = page.getByRole('dialog');
  708 |   await expect(commandDialog).toContainText('快速跳转');
  709 |   // CommandMenu 复用 SearchBox：输入框是 SearchField.Input，不再出现嵌套的通用 data-slot="input"
  710 |   await expect(commandDialog.locator('[data-slot="search-field-input"]')).toHaveCount(1);
  711 |   await expect(commandDialog.locator('[data-slot="input"]')).toHaveCount(0);
  712 |   await page.getByLabel('搜索命令').fill('状态');
  713 |   await expect(page.getByRole('option', { name: /状态体系/ })).toBeVisible();
  714 |   await assertOverlayAccessibility(page);
  715 |   await expect.soft(page).toHaveScreenshot('ui-elements-command-open.png');
  716 | });
  717 |
  718 | test('Dialog 与 Drawer 锁定焦点并支持 Escape 恢复 Trigger', async ({ page }) => {
  719 |   await page.goto('/ui-elements/overlays');
  720 |   const dialogTrigger = page.getByRole('button', { name: 'Dialog' });
  721 |   await dialogTrigger.click();
  722 |   const dialog = page.getByRole('dialog');
  723 |   await expect(dialog).toBeVisible();
  724 |   await page.keyboard.press('Tab');
  725 |   await expect(dialog.locator(':focus')).toHaveCount(1);
  726 |   await waitForVisualReadiness(page);
  727 |   await expect.soft(page).toHaveScreenshot('ui-elements-dialog-open.png');
  728 |   await page.keyboard.press('Escape');
  729 |   await expect(dialogTrigger).toBeFocused();
  730 |
  731 |   const drawerTrigger = page.getByRole('button', { name: 'Drawer' });
  732 |   await drawerTrigger.click();
```
