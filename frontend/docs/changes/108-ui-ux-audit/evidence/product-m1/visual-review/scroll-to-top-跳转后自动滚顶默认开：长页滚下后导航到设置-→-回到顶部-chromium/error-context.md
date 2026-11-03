# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scroll-to-top.spec.ts >> 跳转后自动滚顶默认开：长页滚下后导航到设置 → 回到顶部
- Location: apps\web\e2e\scroll-to-top.spec.ts:17:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('navigation', { name: '主导航' }).getByRole('link', { name: /^设置$/ })

```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
    - button "Open Next.js Dev Tools" [ref=f2e7] [cursor=pointer]
    - alert [ref=f2e11]
    - link "跳到主要内容 / Skip to content" [ref=f2e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=f2e13]:
        - complementary [ref=f2e14]:
            - generic [ref=f2e15]:
                - generic [ref=f2e16]: C
                - generic [ref=f2e18]:
                    - paragraph [ref=f2e19]: clouddrive
                    - paragraph [ref=f2e20]: 管理工作空间
            - navigation "主导航" [ref=f2e21]:
                - generic [ref=f2e22]:
                    - paragraph [ref=f2e23]: 工作空间
                    - list "工作空间" [ref=f2e24]:
                        - listitem [ref=f2e25]:
                            - link "工作台" [ref=f2e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=f2e34]:
                    - paragraph [ref=f2e35]: 个人
                    - list "个人" [ref=f2e36]:
                        - listitem [ref=f2e37]:
                            - link "个人偏好" [ref=f2e38] [cursor=pointer]:
                                - /url: /settings
                - generic [ref=f2e44]:
                    - paragraph [ref=f2e45]: 开发中心
                    - list "开发中心" [ref=f2e46]:
                        - listitem [ref=f2e47]:
                            - button "展开或收起UI Elements" [ref=f2e48]:
                                - generic [ref=f2e55]: UI Elements
                        - listitem [ref=f2e58]:
                            - button "展开或收起Page Patterns" [ref=f2e59]:
                                - generic [ref=f2e66]: Page Patterns
                        - listitem [ref=f2e69]:
                            - button "展开或收起Page Archetypes" [expanded] [ref=f2e70]:
                                - generic [ref=f2e74]: Page Archetypes
                            - list [ref=f2e77]:
                                - listitem [ref=f2e78]:
                                    - link "总览原型" [ref=f2e79] [cursor=pointer]:
                                        - /url: /page-archetypes/overview
                                - listitem [ref=f2e84]:
                                    - link "数据工作台" [ref=f2e85] [cursor=pointer]:
                                        - /url: /page-archetypes/resource-list
                                - listitem [ref=f2e90]:
                                    - link "详情页" [ref=f2e91] [cursor=pointer]:
                                        - /url: /page-archetypes/detail
                                - listitem [ref=f2e96]:
                                    - link "创建与编辑" [ref=f2e97] [cursor=pointer]:
                                        - /url: /page-archetypes/create-edit
                                - listitem [ref=f2e102]:
                                    - link "设置页" [ref=f2e103] [cursor=pointer]:
                                        - /url: /page-archetypes/settings
                                - listitem [ref=f2e108]:
                                    - link "主从视图" [ref=f2e109] [cursor=pointer]:
                                        - /url: /page-archetypes/master-detail
                                - listitem [ref=f2e114]:
                                    - link "操作任务" [ref=f2e115] [cursor=pointer]:
                                        - /url: /page-archetypes/operation
                        - listitem [ref=f2e120]:
                            - link "参考资源" [ref=f2e121] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=f2e126]:
                            - link "Icon 大全" [ref=f2e127] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=f2e134]:
                            - link "基座能力" [ref=f2e135] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f2e148]:
                            - link "Motion" [ref=f2e149] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f2e158]:
                            - link "状态体系" [ref=f2e159] [cursor=pointer]:
                                - /url: /states
        - generic [ref=f2e166]:
            - banner [ref=f2e168]:
                - button "收起侧栏" [ref=f2e170] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f2e172] [cursor=pointer]
                - generic [ref=f2e173]:
                    - generic [ref=f2e174]:
                        - button "切换语言" [ref=f2e175] [cursor=pointer]
                        - button "切换主题" [ref=f2e176] [cursor=pointer]
                    - button "通知" [ref=f2e177]
                    - button "当前用户" [ref=f2e181] [cursor=pointer]:
                        - generic [ref=f2e183]:
                            - generic "Rin" [ref=f2e186]: RI
                            - generic [ref=f2e187]: Rin
            - main [ref=f2e191]:
                - generic [ref=f2e193]:
                    - generic [ref=f2e194]:
                        - list "面包屑导航" [ref=f2e195]:
                            - listitem [ref=f2e196]:
                                - link "基座验证" [ref=f2e197] [cursor=pointer]
                                - generic [ref=f2e198]: /
                            - listitem [ref=f2e199]:
                                - link "数据工作台" [disabled]
                        - generic [ref=f2e200]:
                            - generic [ref=f2e201]:
                                - paragraph [ref=f2e202]: Reference · Workspace
                                - heading "高密度数据工作台" [level=1] [ref=f2e203]
                                - paragraph [ref=f2e204]: 使用 48 条本地基准数据验证 Dashboard、筛选、Table、Master-Detail、Tabs、Drawer、Dialog 与非正常状态的协作边界。
                            - generic [ref=f2e205]:
                                - button "打开活动侧栏" [ref=f2e206] [cursor=pointer]
                                - button "打开确认对话框" [ref=f2e207] [cursor=pointer]
                    - generic [ref=f2e208]:
                        - generic [ref=f2e209]:
                            - paragraph [ref=f2e210]: 总工作流
                            - paragraph [ref=f2e211]: '48'
                        - generic [ref=f2e212]:
                            - paragraph [ref=f2e213]: 需关注
                            - paragraph [ref=f2e214]: '16'
                        - generic [ref=f2e215]:
                            - paragraph [ref=f2e216]: 高风险
                            - paragraph [ref=f2e217]: '16'
                        - generic [ref=f2e218]:
                            - paragraph [ref=f2e219]: 筛选结果
                            - paragraph [ref=f2e220]: '48'
                    - toolbar "页面工具栏" [ref=f2e221]:
                        - generic [ref=f2e224]:
                            - group [ref=f2e226]:
                                - searchbox "搜索 Reference 数据" [ref=f2e227]
                                - button "Close"
                            - button "搜索" [ref=f2e228] [cursor=pointer]
                        - button "导出快照" [ref=f2e231] [cursor=pointer]
                    - generic [ref=f2e234]:
                        - generic [ref=f2e235]:
                            - generic [ref=f2e236]: 状态
                            - button "全部 状态" [ref=f2e237] [cursor=pointer]:
                                - generic [ref=f2e238]: 全部
                            - combobox [ref=f2e245]
                        - generic [ref=f2e246]:
                            - generic [ref=f2e247]: 区域
                            - button "全部 区域" [ref=f2e248] [cursor=pointer]:
                                - generic [ref=f2e249]: 全部
                            - combobox [ref=f2e256]
                        - generic [ref=f2e257]:
                            - generic [ref=f2e258]: 表格密度
                            - button "舒适 表格密度" [ref=f2e259] [cursor=pointer]:
                                - generic [ref=f2e260]: 舒适
                            - combobox [ref=f2e267]
                        - generic [ref=f2e268]:
                            - generic [ref=f2e269]: 场景状态
                            - button "正常 场景状态" [ref=f2e270] [cursor=pointer]:
                                - generic [ref=f2e271]: 正常
                            - combobox [ref=f2e278]
                    - region "Reference 工作流数据表" [ref=f2e279]:
                        - generic [ref=f2e281]:
                            - generic [ref=f2e283]:
                                - generic [ref=f2e284]:
                                    - generic [ref=f2e285]:
                                        - heading "工作流列表" [level=2] [ref=f2e286]
                                        - paragraph [ref=f2e287]: 当前展示 48 条记录；数据量用于验证滚动、密度与溢出。
                                    - button "列设置" [ref=f2e290]
                                - generic [ref=f2e291]:
                                    - grid "Reference 工作流数据表" [ref=f2e295]:
                                        - rowgroup [ref=f2e296]:
                                            - row [ref=f2e297]:
                                                - columnheader [ref=f2e298] [cursor=pointer]:
                                                    - generic [ref=f2e299]: 工作流
                                                    - slider "尺寸调整器 工作流" [ref=f2e300]: '102'
                                                - columnheader [ref=f2e301] [cursor=pointer]:
                                                    - generic [ref=f2e302]: 负责人
                                                    - slider "尺寸调整器 负责人" [ref=f2e303]: '101'
                                                - columnheader [ref=f2e304] [cursor=pointer]:
                                                    - generic [ref=f2e305]: 状态
                                                    - slider "尺寸调整器 状态" [ref=f2e306]: '102'
                                                - columnheader [ref=f2e307] [cursor=pointer]:
                                                    - generic [ref=f2e308]: 区域
                                                    - slider "尺寸调整器 区域" [ref=f2e309]: '101'
                                                - columnheader [ref=f2e310] [cursor=pointer]:
                                                    - generic [ref=f2e311]: 完成度
                                                    - slider "尺寸调整器 完成度" [ref=f2e312]: '102'
                                                - columnheader [ref=f2e313] [cursor=pointer]:
                                                    - generic [ref=f2e314]: 更新时间
                                                    - slider "尺寸调整器 更新时间" [ref=f2e317]: '101'
                                        - rowgroup [ref=f2e318]:
                                            - row [ref=f2e319] [cursor=pointer]:
                                                - rowheader [ref=f2e320]:
                                                    - generic [ref=f2e321]:
                                                        - paragraph [ref=f2e322]: North Star analytics 1
                                                        - paragraph [ref=f2e323]: REF-001
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f2e324]:
                                                    - generic [ref=f2e325]:
                                                        - generic "Lin Chen" [ref=f2e328]: LC
                                                        - generic [ref=f2e329]:
                                                            - generic [ref=f2e330]: Lin Chen
                                                            - generic [ref=f2e331]: 亚太
                                                - gridcell "健康" [ref=f2e332]
                                                - gridcell "亚太" [ref=f2e335]
                                                - gridcell [ref=f2e336]:
                                                    - progressbar "35%" [ref=f2e338]
                                                - gridcell "2026-08-29" [ref=f2e343]
                                            - row [ref=f2e344] [cursor=pointer]:
                                                - rowheader [ref=f2e345]:
                                                    - generic [ref=f2e346]:
                                                        - paragraph [ref=f2e347]: Creator support operations 13
                                                        - paragraph [ref=f2e348]: REF-013
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f2e349]:
                                                    - generic [ref=f2e350]:
                                                        - generic "Lin Chen" [ref=f2e353]: LC
                                                        - generic [ref=f2e354]:
                                                            - generic [ref=f2e355]: Lin Chen
                                                            - generic [ref=f2e356]: 亚太
                                                - gridcell "健康" [ref=f2e357]
                                                - gridcell "亚太" [ref=f2e360]
                                                - gridcell [ref=f2e361]:
                                                    - progressbar "63%" [ref=f2e363]
                                                - gridcell "2026-08-29" [ref=f2e368]
                                            - row [ref=f2e369] [cursor=pointer]:
                                                - rowheader [ref=f2e370]:
                                                    - generic [ref=f2e371]:
                                                        - paragraph [ref=f2e372]: North Star analytics 25
                                                        - paragraph [ref=f2e373]: REF-025
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f2e374]:
                                                    - generic [ref=f2e375]:
                                                        - generic "Lin Chen" [ref=f2e378]: LC
                                                        - generic [ref=f2e379]:
                                                            - generic [ref=f2e380]: Lin Chen
                                                            - generic [ref=f2e381]: 亚太
                                                - gridcell "健康" [ref=f2e382]
                                                - gridcell "亚太" [ref=f2e385]
                                                - gridcell [ref=f2e386]:
                                                    - progressbar "91%" [ref=f2e388]
                                                - gridcell "2026-08-29" [ref=f2e393]
                                            - row [ref=f2e394] [cursor=pointer]:
                                                - rowheader [ref=f2e395]:
                                                    - generic [ref=f2e396]:
                                                        - paragraph [ref=f2e397]: Creator support operations 37
                                                        - paragraph [ref=f2e398]: REF-037
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f2e399]:
                                                    - generic [ref=f2e400]:
                                                        - generic "Lin Chen" [ref=f2e403]: LC
                                                        - generic [ref=f2e404]:
                                                            - generic [ref=f2e405]: Lin Chen
                                                            - generic [ref=f2e406]: 亚太
                                                - gridcell "健康" [ref=f2e407]
                                                - gridcell "亚太" [ref=f2e410]
                                                - gridcell [ref=f2e411]:
                                                    - progressbar "55%" [ref=f2e413]
                                                - gridcell "2026-08-29" [ref=f2e418]
                                            - row [ref=f2e419] [cursor=pointer]:
                                                - rowheader [ref=f2e420]:
                                                    - generic [ref=f2e421]:
                                                        - paragraph [ref=f2e422]: Partner onboarding 2
                                                        - paragraph [ref=f2e423]: REF-002
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f2e424]:
                                                    - generic [ref=f2e425]:
                                                        - generic "Avery Morgan" [ref=f2e428]: AM
                                                        - generic [ref=f2e429]:
                                                            - generic [ref=f2e430]: Avery Morgan
                                                            - generic [ref=f2e431]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e432]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e435]
                                                - gridcell [ref=f2e436]:
                                                    - progressbar "48%" [ref=f2e438]
                                                - gridcell "2026-08-28" [ref=f2e443]
                                            - row [ref=f2e444] [cursor=pointer]:
                                                - rowheader [ref=f2e445]:
                                                    - generic [ref=f2e446]:
                                                        - paragraph [ref=f2e447]: Moderation quality signals 14
                                                        - paragraph [ref=f2e448]: REF-014
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f2e449]:
                                                    - generic [ref=f2e450]:
                                                        - generic "Avery Morgan" [ref=f2e453]: AM
                                                        - generic [ref=f2e454]:
                                                            - generic [ref=f2e455]: Avery Morgan
                                                            - generic [ref=f2e456]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e457]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e460]
                                                - gridcell [ref=f2e461]:
                                                    - progressbar "76%" [ref=f2e463]
                                                - gridcell "2026-08-28" [ref=f2e468]
                                            - row [ref=f2e469] [cursor=pointer]:
                                                - rowheader [ref=f2e470]:
                                                    - generic [ref=f2e471]:
                                                        - paragraph [ref=f2e472]: Partner onboarding 26
                                                        - paragraph [ref=f2e473]: REF-026
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f2e474]:
                                                    - generic [ref=f2e475]:
                                                        - generic "Avery Morgan" [ref=f2e478]: AM
                                                        - generic [ref=f2e479]:
                                                            - generic [ref=f2e480]: Avery Morgan
                                                            - generic [ref=f2e481]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e482]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e485]
                                                - gridcell [ref=f2e486]:
                                                    - progressbar "40%" [ref=f2e488]
                                                - gridcell "2026-08-28" [ref=f2e493]
                                            - row [ref=f2e494] [cursor=pointer]:
                                                - rowheader [ref=f2e495]:
                                                    - generic [ref=f2e496]:
                                                        - paragraph [ref=f2e497]: Moderation quality signals 38
                                                        - paragraph [ref=f2e498]: REF-038
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f2e499]:
                                                    - generic [ref=f2e500]:
                                                        - generic "Avery Morgan" [ref=f2e503]: AM
                                                        - generic [ref=f2e504]:
                                                            - generic [ref=f2e505]: Avery Morgan
                                                            - generic [ref=f2e506]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e507]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e510]
                                                - gridcell [ref=f2e511]:
                                                    - progressbar "68%" [ref=f2e513]
                                                - gridcell "2026-08-28" [ref=f2e518]
                                            - row [ref=f2e519] [cursor=pointer]:
                                                - rowheader [ref=f2e520]:
                                                    - generic [ref=f2e521]:
                                                        - paragraph [ref=f2e522]: Trust review pipeline 3
                                                        - paragraph [ref=f2e523]: REF-003
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f2e524]:
                                                    - generic [ref=f2e525]:
                                                        - generic "Mika Sato" [ref=f2e528]: MS
                                                        - generic [ref=f2e529]:
                                                            - generic [ref=f2e530]: Mika Sato
                                                            - generic [ref=f2e531]: 美洲
                                                - gridcell "已暂停" [ref=f2e532]
                                                - gridcell "美洲" [ref=f2e535]
                                                - gridcell [ref=f2e536]:
                                                    - progressbar "61%" [ref=f2e538]
                                                - gridcell "2026-08-27" [ref=f2e543]
                                            - row [ref=f2e544] [cursor=pointer]:
                                                - rowheader [ref=f2e545]:
                                                    - generic [ref=f2e546]:
                                                        - paragraph [ref=f2e547]: Billing reconciliation 15
                                                        - paragraph [ref=f2e548]: REF-015
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f2e549]:
                                                    - generic [ref=f2e550]:
                                                        - generic "Mika Sato" [ref=f2e553]: MS
                                                        - generic [ref=f2e554]:
                                                            - generic [ref=f2e555]: Mika Sato
                                                            - generic [ref=f2e556]: 美洲
                                                - gridcell "已暂停" [ref=f2e557]
                                                - gridcell "美洲" [ref=f2e560]
                                                - gridcell [ref=f2e561]:
                                                    - progressbar "89%" [ref=f2e563]
                                                - gridcell "2026-08-27" [ref=f2e568]
                                            - row [ref=f2e569] [cursor=pointer]:
                                                - rowheader [ref=f2e570]:
                                                    - generic [ref=f2e571]:
                                                        - paragraph [ref=f2e572]: Trust review pipeline 27
                                                        - paragraph [ref=f2e573]: REF-027
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f2e574]:
                                                    - generic [ref=f2e575]:
                                                        - generic "Mika Sato" [ref=f2e578]: MS
                                                        - generic [ref=f2e579]:
                                                            - generic [ref=f2e580]: Mika Sato
                                                            - generic [ref=f2e581]: 美洲
                                                - gridcell "已暂停" [ref=f2e582]
                                                - gridcell "美洲" [ref=f2e585]
                                                - gridcell [ref=f2e586]:
                                                    - progressbar "53%" [ref=f2e588]
                                                - gridcell "2026-08-27" [ref=f2e593]
                                            - row [ref=f2e594] [cursor=pointer]:
                                                - rowheader [ref=f2e595]:
                                                    - generic [ref=f2e596]:
                                                        - paragraph [ref=f2e597]: Billing reconciliation 39
                                                        - paragraph [ref=f2e598]: REF-039
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f2e599]:
                                                    - generic [ref=f2e600]:
                                                        - generic "Mika Sato" [ref=f2e603]: MS
                                                        - generic [ref=f2e604]:
                                                            - generic [ref=f2e605]: Mika Sato
                                                            - generic [ref=f2e606]: 美洲
                                                - gridcell "已暂停" [ref=f2e607]
                                                - gridcell "美洲" [ref=f2e610]
                                                - gridcell [ref=f2e611]:
                                                    - progressbar "81%" [ref=f2e613]
                                                - gridcell "2026-08-27" [ref=f2e618]
                                            - row [ref=f2e619] [cursor=pointer]:
                                                - rowheader [ref=f2e620]:
                                                    - generic [ref=f2e621]:
                                                        - paragraph [ref=f2e622]: Regional release readiness 4
                                                        - paragraph [ref=f2e623]: REF-004
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f2e624]:
                                                    - generic [ref=f2e625]:
                                                        - generic "Sam Rivera" [ref=f2e628]: SR
                                                        - generic [ref=f2e629]:
                                                            - generic [ref=f2e630]: Sam Rivera
                                                            - generic [ref=f2e631]: 亚太
                                                - gridcell "健康" [ref=f2e632]
                                                - gridcell "亚太" [ref=f2e635]
                                                - gridcell [ref=f2e636]:
                                                    - progressbar "74%" [ref=f2e638]
                                                - gridcell "2026-08-26" [ref=f2e643]
                                            - row [ref=f2e644] [cursor=pointer]:
                                                - rowheader [ref=f2e645]:
                                                    - generic [ref=f2e646]:
                                                        - paragraph [ref=f2e647]: Content lifecycle governance 16
                                                        - paragraph [ref=f2e648]: REF-016
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f2e649]:
                                                    - generic [ref=f2e650]:
                                                        - generic "Sam Rivera" [ref=f2e653]: SR
                                                        - generic [ref=f2e654]:
                                                            - generic [ref=f2e655]: Sam Rivera
                                                            - generic [ref=f2e656]: 亚太
                                                - gridcell "健康" [ref=f2e657]
                                                - gridcell "亚太" [ref=f2e660]
                                                - gridcell [ref=f2e661]:
                                                    - progressbar "38%" [ref=f2e663]
                                                - gridcell "2026-08-26" [ref=f2e668]
                                            - row [ref=f2e669] [cursor=pointer]:
                                                - rowheader [ref=f2e670]:
                                                    - generic [ref=f2e671]:
                                                        - paragraph [ref=f2e672]: Regional release readiness 28
                                                        - paragraph [ref=f2e673]: REF-028
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f2e674]:
                                                    - generic [ref=f2e675]:
                                                        - generic "Sam Rivera" [ref=f2e678]: SR
                                                        - generic [ref=f2e679]:
                                                            - generic [ref=f2e680]: Sam Rivera
                                                            - generic [ref=f2e681]: 亚太
                                                - gridcell "健康" [ref=f2e682]
                                                - gridcell "亚太" [ref=f2e685]
                                                - gridcell [ref=f2e686]:
                                                    - progressbar "66%" [ref=f2e688]
                                                - gridcell "2026-08-26" [ref=f2e693]
                                            - row [ref=f2e694] [cursor=pointer]:
                                                - rowheader [ref=f2e695]:
                                                    - generic [ref=f2e696]:
                                                        - paragraph [ref=f2e697]: Content lifecycle governance 40
                                                        - paragraph [ref=f2e698]: REF-040
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f2e699]:
                                                    - generic [ref=f2e700]:
                                                        - generic "Sam Rivera" [ref=f2e703]: SR
                                                        - generic [ref=f2e704]:
                                                            - generic [ref=f2e705]: Sam Rivera
                                                            - generic [ref=f2e706]: 亚太
                                                - gridcell "健康" [ref=f2e707]
                                                - gridcell "亚太" [ref=f2e710]
                                                - gridcell [ref=f2e711]:
                                                    - progressbar "94%" [ref=f2e713]
                                                - gridcell "2026-08-26" [ref=f2e718]
                                            - row [ref=f2e719] [cursor=pointer]:
                                                - rowheader [ref=f2e720]:
                                                    - generic [ref=f2e721]:
                                                        - paragraph [ref=f2e722]: Creator support operations 5
                                                        - paragraph [ref=f2e723]: REF-005
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f2e724]:
                                                    - generic [ref=f2e725]:
                                                        - generic "Lin Chen" [ref=f2e728]: LC
                                                        - generic [ref=f2e729]:
                                                            - generic [ref=f2e730]: Lin Chen
                                                            - generic [ref=f2e731]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e732]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e735]
                                                - gridcell [ref=f2e736]:
                                                    - progressbar "87%" [ref=f2e738]
                                                - gridcell "2026-08-25" [ref=f2e743]
                                            - row [ref=f2e744] [cursor=pointer]:
                                                - rowheader [ref=f2e745]:
                                                    - generic [ref=f2e746]:
                                                        - paragraph [ref=f2e747]: North Star analytics 17
                                                        - paragraph [ref=f2e748]: REF-017
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f2e749]:
                                                    - generic [ref=f2e750]:
                                                        - generic "Lin Chen" [ref=f2e753]: LC
                                                        - generic [ref=f2e754]:
                                                            - generic [ref=f2e755]: Lin Chen
                                                            - generic [ref=f2e756]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e757]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e760]
                                                - gridcell [ref=f2e761]:
                                                    - progressbar "51%" [ref=f2e763]
                                                - gridcell "2026-08-25" [ref=f2e768]
                                            - row [ref=f2e769] [cursor=pointer]:
                                                - rowheader [ref=f2e770]:
                                                    - generic [ref=f2e771]:
                                                        - paragraph [ref=f2e772]: Creator support operations 29
                                                        - paragraph [ref=f2e773]: REF-029
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f2e774]:
                                                    - generic [ref=f2e775]:
                                                        - generic "Lin Chen" [ref=f2e778]: LC
                                                        - generic [ref=f2e779]:
                                                            - generic [ref=f2e780]: Lin Chen
                                                            - generic [ref=f2e781]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e782]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e785]
                                                - gridcell [ref=f2e786]:
                                                    - progressbar "79%" [ref=f2e788]
                                                - gridcell "2026-08-25" [ref=f2e793]
                                            - row [ref=f2e794] [cursor=pointer]:
                                                - rowheader [ref=f2e795]:
                                                    - generic [ref=f2e796]:
                                                        - paragraph [ref=f2e797]: North Star analytics 41
                                                        - paragraph [ref=f2e798]: REF-041
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f2e799]:
                                                    - generic [ref=f2e800]:
                                                        - generic "Lin Chen" [ref=f2e803]: LC
                                                        - generic [ref=f2e804]:
                                                            - generic [ref=f2e805]: Lin Chen
                                                            - generic [ref=f2e806]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e807]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e810]
                                                - gridcell [ref=f2e811]:
                                                    - progressbar "43%" [ref=f2e813]
                                                - gridcell "2026-08-25" [ref=f2e818]
                                    - navigation "Reference 列表分页" [ref=f2e820]:
                                        - list [ref=f2e821]:
                                            - listitem [ref=f2e822]:
                                                - button "上一页" [disabled]:
                                                    - generic: ‹
                                            - listitem [ref=f2e823]:
                                                - button "第 1 页" [ref=f2e824] [cursor=pointer]: '1'
                                            - listitem [ref=f2e825]:
                                                - button "第 2 页" [ref=f2e826] [cursor=pointer]: '2'
                                            - listitem [ref=f2e827]:
                                                - button "第 3 页" [ref=f2e828] [cursor=pointer]: '3'
                                            - listitem [ref=f2e829]:
                                                - button "下一页" [ref=f2e830] [cursor=pointer]:
                                                    - generic [ref=f2e831]: ›
                            - complementary [ref=f2e832]:
                                - generic [ref=f2e833]:
                                    - generic [ref=f2e835]:
                                        - generic [ref=f2e836]:
                                            - paragraph [ref=f2e837]: REF-001
                                            - heading "North Star analytics 1" [level=2] [ref=f2e838]
                                        - generic [ref=f2e839]: 健康
                                    - generic [ref=f2e843]:
                                        - tablist "工作流详情" [ref=f2e844]:
                                            - tab "摘要" [selected] [ref=f2e845] [cursor=pointer]
                                            - tab "活动" [ref=f2e847] [cursor=pointer]
                                            - tab "风险" [ref=f2e849] [cursor=pointer]
                                        - tabpanel "摘要" [ref=f2e851]:
                                            - generic [ref=f2e853]:
                                                - paragraph [ref=f2e854]: 本地参考数据用于验证长内容、状态组合、响应式布局和浏览器交互，不依赖后端。
                                                - generic "工作流详情" [ref=f2e855]:
                                                    - generic [ref=f2e856]:
                                                        - term [ref=f2e857]: 负责人
                                                        - definition [ref=f2e858]:
                                                            - generic [ref=f2e859]:
                                                                - generic "Lin Chen" [ref=f2e862]: LC
                                                                - generic [ref=f2e863]:
                                                                    - generic [ref=f2e864]: Lin Chen
                                                                    - generic [ref=f2e865]: 亚太
                                                    - generic [ref=f2e866]:
                                                        - term [ref=f2e867]: 更新时间
                                                        - definition [ref=f2e868]: 2026年8月29日
```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | import { expect, test } from '@playwright/test';
  3  |
  4  | async function resetPreferences(page: Page) {
  5  |   await page.goto('/settings/navigation');
  6  |   await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  7  |   await page.reload();
  8  |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  9  | }
  10 |
  11 | async function spaToSettings(page: Page) {
  12 |   const nav = page.getByRole('navigation', { name: '主导航' });
> 13 |   await nav.getByRole('link', { name: /^设置$/ }).click();
     |                                                 ^ Error: locator.click: Test timeout of 30000ms exceeded.
  14 |   await page.waitForURL(/\/settings$/);
  15 | }
  16 |
  17 | test('跳转后自动滚顶默认开：长页滚下后导航到设置 → 回到顶部', async ({ page }) => {
  18 |   await resetPreferences(page);
  19 |   await page.goto('/page-archetypes/resource-list');
  20 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  21 |   await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
  22 |   await page.evaluate(() => window.scrollTo(0, 800));
  23 |   await page.waitForTimeout(300);
  24 |   const before = await page.evaluate(() => window.scrollY);
  25 |   expect(before).toBeGreaterThan(100);
  26 |   await spaToSettings(page);
  27 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  28 |   await page.waitForTimeout(500);
  29 |   const after = await page.evaluate(() => window.scrollY);
  30 |   expect(after).toBeLessThan(50);
  31 | });
  32 |
  33 | test('关闭 跳转后自动滚顶：长页滚下后导航保持滚动位置', async ({ page }) => {
  34 |   await resetPreferences(page);
  35 |   // 设置 → 导航 → 跳转后自动滚顶 = 关。
  36 |   await page.goto('/settings/navigation');
  37 |   await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  38 |   const scrollPref = page.getByRole('switch', { name: '跳转后自动滚动到顶部' });
  39 |   await scrollPref.focus();
  40 |   await page.keyboard.press('Space');
  41 |   await expect(scrollPref).not.toBeChecked();
  42 |   await page.waitForTimeout(300);
  43 |
  44 |   await page.goto('/page-archetypes/resource-list');
  45 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  46 |   await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
  47 |   await page.evaluate(() => window.scrollTo(0, 800));
  48 |   await page.waitForTimeout(300);
  49 |   await spaToSettings(page);
  50 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  51 |   await page.waitForTimeout(500);
  52 |   const after = await page.evaluate(() => window.scrollY);
  53 |   expect(after).toBeGreaterThan(100);
  54 | });
  55 |
```
