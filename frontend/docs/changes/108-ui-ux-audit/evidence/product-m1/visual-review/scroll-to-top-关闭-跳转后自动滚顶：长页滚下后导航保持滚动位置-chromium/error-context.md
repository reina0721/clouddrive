# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scroll-to-top.spec.ts >> 关闭 跳转后自动滚顶：长页滚下后导航保持滚动位置
- Location: apps\web\e2e\scroll-to-top.spec.ts:33:1

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
- generic [active] [ref=f3e1]:
    - button "Open Next.js Dev Tools" [ref=f3e7] [cursor=pointer]
    - alert [ref=f3e11]
    - link "跳到主要内容 / Skip to content" [ref=f3e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=f3e13]:
        - complementary [ref=f3e14]:
            - generic [ref=f3e15]:
                - generic [ref=f3e16]: C
                - generic [ref=f3e18]:
                    - paragraph [ref=f3e19]: clouddrive
                    - paragraph [ref=f3e20]: 管理工作空间
            - navigation "主导航" [ref=f3e21]:
                - generic [ref=f3e22]:
                    - paragraph [ref=f3e23]: 工作空间
                    - list "工作空间" [ref=f3e24]:
                        - listitem [ref=f3e25]:
                            - link "工作台" [ref=f3e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=f3e34]:
                    - paragraph [ref=f3e35]: 个人
                    - list "个人" [ref=f3e36]:
                        - listitem [ref=f3e37]:
                            - link "个人偏好" [ref=f3e38] [cursor=pointer]:
                                - /url: /settings
                - generic [ref=f3e44]:
                    - paragraph [ref=f3e45]: 开发中心
                    - list "开发中心" [ref=f3e46]:
                        - listitem [ref=f3e47]:
                            - button "展开或收起UI Elements" [ref=f3e48]:
                                - generic [ref=f3e55]: UI Elements
                        - listitem [ref=f3e58]:
                            - button "展开或收起Page Patterns" [ref=f3e59]:
                                - generic [ref=f3e66]: Page Patterns
                        - listitem [ref=f3e69]:
                            - button "展开或收起Page Archetypes" [expanded] [ref=f3e70]:
                                - generic [ref=f3e74]: Page Archetypes
                            - list [ref=f3e77]:
                                - listitem [ref=f3e78]:
                                    - link "总览原型" [ref=f3e79] [cursor=pointer]:
                                        - /url: /page-archetypes/overview
                                - listitem [ref=f3e84]:
                                    - link "数据工作台" [ref=f3e85] [cursor=pointer]:
                                        - /url: /page-archetypes/resource-list
                                - listitem [ref=f3e90]:
                                    - link "详情页" [ref=f3e91] [cursor=pointer]:
                                        - /url: /page-archetypes/detail
                                - listitem [ref=f3e96]:
                                    - link "创建与编辑" [ref=f3e97] [cursor=pointer]:
                                        - /url: /page-archetypes/create-edit
                                - listitem [ref=f3e102]:
                                    - link "设置页" [ref=f3e103] [cursor=pointer]:
                                        - /url: /page-archetypes/settings
                                - listitem [ref=f3e108]:
                                    - link "主从视图" [ref=f3e109] [cursor=pointer]:
                                        - /url: /page-archetypes/master-detail
                                - listitem [ref=f3e114]:
                                    - link "操作任务" [ref=f3e115] [cursor=pointer]:
                                        - /url: /page-archetypes/operation
                        - listitem [ref=f3e120]:
                            - link "参考资源" [ref=f3e121] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=f3e126]:
                            - link "Icon 大全" [ref=f3e127] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=f3e134]:
                            - link "基座能力" [ref=f3e135] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f3e148]:
                            - link "Motion" [ref=f3e149] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f3e158]:
                            - link "状态体系" [ref=f3e159] [cursor=pointer]:
                                - /url: /states
        - generic [ref=f3e166]:
            - banner [ref=f3e168]:
                - button "收起侧栏" [ref=f3e170] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f3e172] [cursor=pointer]
                - generic [ref=f3e173]:
                    - generic [ref=f3e174]:
                        - button "切换语言" [ref=f3e175] [cursor=pointer]
                        - button "切换主题" [ref=f3e176] [cursor=pointer]
                    - button "通知" [ref=f3e177]
                    - button "当前用户" [ref=f3e181] [cursor=pointer]:
                        - generic [ref=f3e183]:
                            - generic "Rin" [ref=f3e186]: RI
                            - generic [ref=f3e187]: Rin
            - main [ref=f3e191]:
                - generic [ref=f3e193]:
                    - generic [ref=f3e194]:
                        - list "面包屑导航" [ref=f3e195]:
                            - listitem [ref=f3e196]:
                                - link "基座验证" [ref=f3e197] [cursor=pointer]
                                - generic [ref=f3e198]: /
                            - listitem [ref=f3e199]:
                                - link "数据工作台" [disabled]
                        - generic [ref=f3e200]:
                            - generic [ref=f3e201]:
                                - paragraph [ref=f3e202]: Reference · Workspace
                                - heading "高密度数据工作台" [level=1] [ref=f3e203]
                                - paragraph [ref=f3e204]: 使用 48 条本地基准数据验证 Dashboard、筛选、Table、Master-Detail、Tabs、Drawer、Dialog 与非正常状态的协作边界。
                            - generic [ref=f3e205]:
                                - button "打开活动侧栏" [ref=f3e206] [cursor=pointer]
                                - button "打开确认对话框" [ref=f3e207] [cursor=pointer]
                    - generic [ref=f3e208]:
                        - generic [ref=f3e209]:
                            - paragraph [ref=f3e210]: 总工作流
                            - paragraph [ref=f3e211]: '48'
                        - generic [ref=f3e212]:
                            - paragraph [ref=f3e213]: 需关注
                            - paragraph [ref=f3e214]: '16'
                        - generic [ref=f3e215]:
                            - paragraph [ref=f3e216]: 高风险
                            - paragraph [ref=f3e217]: '16'
                        - generic [ref=f3e218]:
                            - paragraph [ref=f3e219]: 筛选结果
                            - paragraph [ref=f3e220]: '48'
                    - toolbar "页面工具栏" [ref=f3e221]:
                        - generic [ref=f3e224]:
                            - group [ref=f3e226]:
                                - searchbox "搜索 Reference 数据" [ref=f3e227]
                                - button "Close"
                            - button "搜索" [ref=f3e228] [cursor=pointer]
                        - button "导出快照" [ref=f3e231] [cursor=pointer]
                    - generic [ref=f3e234]:
                        - generic [ref=f3e235]:
                            - generic [ref=f3e236]: 状态
                            - button "全部 状态" [ref=f3e237] [cursor=pointer]:
                                - generic [ref=f3e238]: 全部
                            - combobox [ref=f3e245]
                        - generic [ref=f3e246]:
                            - generic [ref=f3e247]: 区域
                            - button "全部 区域" [ref=f3e248] [cursor=pointer]:
                                - generic [ref=f3e249]: 全部
                            - combobox [ref=f3e256]
                        - generic [ref=f3e257]:
                            - generic [ref=f3e258]: 表格密度
                            - button "舒适 表格密度" [ref=f3e259] [cursor=pointer]:
                                - generic [ref=f3e260]: 舒适
                            - combobox [ref=f3e267]
                        - generic [ref=f3e268]:
                            - generic [ref=f3e269]: 场景状态
                            - button "正常 场景状态" [ref=f3e270] [cursor=pointer]:
                                - generic [ref=f3e271]: 正常
                            - combobox [ref=f3e278]
                    - region "Reference 工作流数据表" [ref=f3e279]:
                        - generic [ref=f3e281]:
                            - generic [ref=f3e283]:
                                - generic [ref=f3e284]:
                                    - generic [ref=f3e285]:
                                        - heading "工作流列表" [level=2] [ref=f3e286]
                                        - paragraph [ref=f3e287]: 当前展示 48 条记录；数据量用于验证滚动、密度与溢出。
                                    - button "列设置" [ref=f3e290]
                                - generic [ref=f3e291]:
                                    - grid "Reference 工作流数据表" [ref=f3e295]:
                                        - rowgroup [ref=f3e296]:
                                            - row [ref=f3e297]:
                                                - columnheader [ref=f3e298] [cursor=pointer]:
                                                    - generic [ref=f3e299]: 工作流
                                                    - slider "尺寸调整器 工作流" [ref=f3e300]: '102'
                                                - columnheader [ref=f3e301] [cursor=pointer]:
                                                    - generic [ref=f3e302]: 负责人
                                                    - slider "尺寸调整器 负责人" [ref=f3e303]: '101'
                                                - columnheader [ref=f3e304] [cursor=pointer]:
                                                    - generic [ref=f3e305]: 状态
                                                    - slider "尺寸调整器 状态" [ref=f3e306]: '102'
                                                - columnheader [ref=f3e307] [cursor=pointer]:
                                                    - generic [ref=f3e308]: 区域
                                                    - slider "尺寸调整器 区域" [ref=f3e309]: '101'
                                                - columnheader [ref=f3e310] [cursor=pointer]:
                                                    - generic [ref=f3e311]: 完成度
                                                    - slider "尺寸调整器 完成度" [ref=f3e312]: '102'
                                                - columnheader [ref=f3e313] [cursor=pointer]:
                                                    - generic [ref=f3e314]: 更新时间
                                                    - slider "尺寸调整器 更新时间" [ref=f3e317]: '101'
                                        - rowgroup [ref=f3e318]:
                                            - row [ref=f3e319] [cursor=pointer]:
                                                - rowheader [ref=f3e320]:
                                                    - generic [ref=f3e321]:
                                                        - paragraph [ref=f3e322]: North Star analytics 1
                                                        - paragraph [ref=f3e323]: REF-001
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f3e324]:
                                                    - generic [ref=f3e325]:
                                                        - generic "Lin Chen" [ref=f3e328]: LC
                                                        - generic [ref=f3e329]:
                                                            - generic [ref=f3e330]: Lin Chen
                                                            - generic [ref=f3e331]: 亚太
                                                - gridcell "健康" [ref=f3e332]
                                                - gridcell "亚太" [ref=f3e335]
                                                - gridcell [ref=f3e336]:
                                                    - progressbar "35%" [ref=f3e338]
                                                - gridcell "2026-08-29" [ref=f3e343]
                                            - row [ref=f3e344] [cursor=pointer]:
                                                - rowheader [ref=f3e345]:
                                                    - generic [ref=f3e346]:
                                                        - paragraph [ref=f3e347]: Creator support operations 13
                                                        - paragraph [ref=f3e348]: REF-013
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f3e349]:
                                                    - generic [ref=f3e350]:
                                                        - generic "Lin Chen" [ref=f3e353]: LC
                                                        - generic [ref=f3e354]:
                                                            - generic [ref=f3e355]: Lin Chen
                                                            - generic [ref=f3e356]: 亚太
                                                - gridcell "健康" [ref=f3e357]
                                                - gridcell "亚太" [ref=f3e360]
                                                - gridcell [ref=f3e361]:
                                                    - progressbar "63%" [ref=f3e363]
                                                - gridcell "2026-08-29" [ref=f3e368]
                                            - row [ref=f3e369] [cursor=pointer]:
                                                - rowheader [ref=f3e370]:
                                                    - generic [ref=f3e371]:
                                                        - paragraph [ref=f3e372]: North Star analytics 25
                                                        - paragraph [ref=f3e373]: REF-025
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f3e374]:
                                                    - generic [ref=f3e375]:
                                                        - generic "Lin Chen" [ref=f3e378]: LC
                                                        - generic [ref=f3e379]:
                                                            - generic [ref=f3e380]: Lin Chen
                                                            - generic [ref=f3e381]: 亚太
                                                - gridcell "健康" [ref=f3e382]
                                                - gridcell "亚太" [ref=f3e385]
                                                - gridcell [ref=f3e386]:
                                                    - progressbar "91%" [ref=f3e388]
                                                - gridcell "2026-08-29" [ref=f3e393]
                                            - row [ref=f3e394] [cursor=pointer]:
                                                - rowheader [ref=f3e395]:
                                                    - generic [ref=f3e396]:
                                                        - paragraph [ref=f3e397]: Creator support operations 37
                                                        - paragraph [ref=f3e398]: REF-037
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f3e399]:
                                                    - generic [ref=f3e400]:
                                                        - generic "Lin Chen" [ref=f3e403]: LC
                                                        - generic [ref=f3e404]:
                                                            - generic [ref=f3e405]: Lin Chen
                                                            - generic [ref=f3e406]: 亚太
                                                - gridcell "健康" [ref=f3e407]
                                                - gridcell "亚太" [ref=f3e410]
                                                - gridcell [ref=f3e411]:
                                                    - progressbar "55%" [ref=f3e413]
                                                - gridcell "2026-08-29" [ref=f3e418]
                                            - row [ref=f3e419] [cursor=pointer]:
                                                - rowheader [ref=f3e420]:
                                                    - generic [ref=f3e421]:
                                                        - paragraph [ref=f3e422]: Partner onboarding 2
                                                        - paragraph [ref=f3e423]: REF-002
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f3e424]:
                                                    - generic [ref=f3e425]:
                                                        - generic "Avery Morgan" [ref=f3e428]: AM
                                                        - generic [ref=f3e429]:
                                                            - generic [ref=f3e430]: Avery Morgan
                                                            - generic [ref=f3e431]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e432]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e435]
                                                - gridcell [ref=f3e436]:
                                                    - progressbar "48%" [ref=f3e438]
                                                - gridcell "2026-08-28" [ref=f3e443]
                                            - row [ref=f3e444] [cursor=pointer]:
                                                - rowheader [ref=f3e445]:
                                                    - generic [ref=f3e446]:
                                                        - paragraph [ref=f3e447]: Moderation quality signals 14
                                                        - paragraph [ref=f3e448]: REF-014
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f3e449]:
                                                    - generic [ref=f3e450]:
                                                        - generic "Avery Morgan" [ref=f3e453]: AM
                                                        - generic [ref=f3e454]:
                                                            - generic [ref=f3e455]: Avery Morgan
                                                            - generic [ref=f3e456]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e457]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e460]
                                                - gridcell [ref=f3e461]:
                                                    - progressbar "76%" [ref=f3e463]
                                                - gridcell "2026-08-28" [ref=f3e468]
                                            - row [ref=f3e469] [cursor=pointer]:
                                                - rowheader [ref=f3e470]:
                                                    - generic [ref=f3e471]:
                                                        - paragraph [ref=f3e472]: Partner onboarding 26
                                                        - paragraph [ref=f3e473]: REF-026
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f3e474]:
                                                    - generic [ref=f3e475]:
                                                        - generic "Avery Morgan" [ref=f3e478]: AM
                                                        - generic [ref=f3e479]:
                                                            - generic [ref=f3e480]: Avery Morgan
                                                            - generic [ref=f3e481]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e482]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e485]
                                                - gridcell [ref=f3e486]:
                                                    - progressbar "40%" [ref=f3e488]
                                                - gridcell "2026-08-28" [ref=f3e493]
                                            - row [ref=f3e494] [cursor=pointer]:
                                                - rowheader [ref=f3e495]:
                                                    - generic [ref=f3e496]:
                                                        - paragraph [ref=f3e497]: Moderation quality signals 38
                                                        - paragraph [ref=f3e498]: REF-038
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f3e499]:
                                                    - generic [ref=f3e500]:
                                                        - generic "Avery Morgan" [ref=f3e503]: AM
                                                        - generic [ref=f3e504]:
                                                            - generic [ref=f3e505]: Avery Morgan
                                                            - generic [ref=f3e506]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e507]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e510]
                                                - gridcell [ref=f3e511]:
                                                    - progressbar "68%" [ref=f3e513]
                                                - gridcell "2026-08-28" [ref=f3e518]
                                            - row [ref=f3e519] [cursor=pointer]:
                                                - rowheader [ref=f3e520]:
                                                    - generic [ref=f3e521]:
                                                        - paragraph [ref=f3e522]: Trust review pipeline 3
                                                        - paragraph [ref=f3e523]: REF-003
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f3e524]:
                                                    - generic [ref=f3e525]:
                                                        - generic "Mika Sato" [ref=f3e528]: MS
                                                        - generic [ref=f3e529]:
                                                            - generic [ref=f3e530]: Mika Sato
                                                            - generic [ref=f3e531]: 美洲
                                                - gridcell "已暂停" [ref=f3e532]
                                                - gridcell "美洲" [ref=f3e535]
                                                - gridcell [ref=f3e536]:
                                                    - progressbar "61%" [ref=f3e538]
                                                - gridcell "2026-08-27" [ref=f3e543]
                                            - row [ref=f3e544] [cursor=pointer]:
                                                - rowheader [ref=f3e545]:
                                                    - generic [ref=f3e546]:
                                                        - paragraph [ref=f3e547]: Billing reconciliation 15
                                                        - paragraph [ref=f3e548]: REF-015
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f3e549]:
                                                    - generic [ref=f3e550]:
                                                        - generic "Mika Sato" [ref=f3e553]: MS
                                                        - generic [ref=f3e554]:
                                                            - generic [ref=f3e555]: Mika Sato
                                                            - generic [ref=f3e556]: 美洲
                                                - gridcell "已暂停" [ref=f3e557]
                                                - gridcell "美洲" [ref=f3e560]
                                                - gridcell [ref=f3e561]:
                                                    - progressbar "89%" [ref=f3e563]
                                                - gridcell "2026-08-27" [ref=f3e568]
                                            - row [ref=f3e569] [cursor=pointer]:
                                                - rowheader [ref=f3e570]:
                                                    - generic [ref=f3e571]:
                                                        - paragraph [ref=f3e572]: Trust review pipeline 27
                                                        - paragraph [ref=f3e573]: REF-027
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f3e574]:
                                                    - generic [ref=f3e575]:
                                                        - generic "Mika Sato" [ref=f3e578]: MS
                                                        - generic [ref=f3e579]:
                                                            - generic [ref=f3e580]: Mika Sato
                                                            - generic [ref=f3e581]: 美洲
                                                - gridcell "已暂停" [ref=f3e582]
                                                - gridcell "美洲" [ref=f3e585]
                                                - gridcell [ref=f3e586]:
                                                    - progressbar "53%" [ref=f3e588]
                                                - gridcell "2026-08-27" [ref=f3e593]
                                            - row [ref=f3e594] [cursor=pointer]:
                                                - rowheader [ref=f3e595]:
                                                    - generic [ref=f3e596]:
                                                        - paragraph [ref=f3e597]: Billing reconciliation 39
                                                        - paragraph [ref=f3e598]: REF-039
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f3e599]:
                                                    - generic [ref=f3e600]:
                                                        - generic "Mika Sato" [ref=f3e603]: MS
                                                        - generic [ref=f3e604]:
                                                            - generic [ref=f3e605]: Mika Sato
                                                            - generic [ref=f3e606]: 美洲
                                                - gridcell "已暂停" [ref=f3e607]
                                                - gridcell "美洲" [ref=f3e610]
                                                - gridcell [ref=f3e611]:
                                                    - progressbar "81%" [ref=f3e613]
                                                - gridcell "2026-08-27" [ref=f3e618]
                                            - row [ref=f3e619] [cursor=pointer]:
                                                - rowheader [ref=f3e620]:
                                                    - generic [ref=f3e621]:
                                                        - paragraph [ref=f3e622]: Regional release readiness 4
                                                        - paragraph [ref=f3e623]: REF-004
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f3e624]:
                                                    - generic [ref=f3e625]:
                                                        - generic "Sam Rivera" [ref=f3e628]: SR
                                                        - generic [ref=f3e629]:
                                                            - generic [ref=f3e630]: Sam Rivera
                                                            - generic [ref=f3e631]: 亚太
                                                - gridcell "健康" [ref=f3e632]
                                                - gridcell "亚太" [ref=f3e635]
                                                - gridcell [ref=f3e636]:
                                                    - progressbar "74%" [ref=f3e638]
                                                - gridcell "2026-08-26" [ref=f3e643]
                                            - row [ref=f3e644] [cursor=pointer]:
                                                - rowheader [ref=f3e645]:
                                                    - generic [ref=f3e646]:
                                                        - paragraph [ref=f3e647]: Content lifecycle governance 16
                                                        - paragraph [ref=f3e648]: REF-016
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f3e649]:
                                                    - generic [ref=f3e650]:
                                                        - generic "Sam Rivera" [ref=f3e653]: SR
                                                        - generic [ref=f3e654]:
                                                            - generic [ref=f3e655]: Sam Rivera
                                                            - generic [ref=f3e656]: 亚太
                                                - gridcell "健康" [ref=f3e657]
                                                - gridcell "亚太" [ref=f3e660]
                                                - gridcell [ref=f3e661]:
                                                    - progressbar "38%" [ref=f3e663]
                                                - gridcell "2026-08-26" [ref=f3e668]
                                            - row [ref=f3e669] [cursor=pointer]:
                                                - rowheader [ref=f3e670]:
                                                    - generic [ref=f3e671]:
                                                        - paragraph [ref=f3e672]: Regional release readiness 28
                                                        - paragraph [ref=f3e673]: REF-028
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f3e674]:
                                                    - generic [ref=f3e675]:
                                                        - generic "Sam Rivera" [ref=f3e678]: SR
                                                        - generic [ref=f3e679]:
                                                            - generic [ref=f3e680]: Sam Rivera
                                                            - generic [ref=f3e681]: 亚太
                                                - gridcell "健康" [ref=f3e682]
                                                - gridcell "亚太" [ref=f3e685]
                                                - gridcell [ref=f3e686]:
                                                    - progressbar "66%" [ref=f3e688]
                                                - gridcell "2026-08-26" [ref=f3e693]
                                            - row [ref=f3e694] [cursor=pointer]:
                                                - rowheader [ref=f3e695]:
                                                    - generic [ref=f3e696]:
                                                        - paragraph [ref=f3e697]: Content lifecycle governance 40
                                                        - paragraph [ref=f3e698]: REF-040
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f3e699]:
                                                    - generic [ref=f3e700]:
                                                        - generic "Sam Rivera" [ref=f3e703]: SR
                                                        - generic [ref=f3e704]:
                                                            - generic [ref=f3e705]: Sam Rivera
                                                            - generic [ref=f3e706]: 亚太
                                                - gridcell "健康" [ref=f3e707]
                                                - gridcell "亚太" [ref=f3e710]
                                                - gridcell [ref=f3e711]:
                                                    - progressbar "94%" [ref=f3e713]
                                                - gridcell "2026-08-26" [ref=f3e718]
                                            - row [ref=f3e719] [cursor=pointer]:
                                                - rowheader [ref=f3e720]:
                                                    - generic [ref=f3e721]:
                                                        - paragraph [ref=f3e722]: Creator support operations 5
                                                        - paragraph [ref=f3e723]: REF-005
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f3e724]:
                                                    - generic [ref=f3e725]:
                                                        - generic "Lin Chen" [ref=f3e728]: LC
                                                        - generic [ref=f3e729]:
                                                            - generic [ref=f3e730]: Lin Chen
                                                            - generic [ref=f3e731]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e732]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e735]
                                                - gridcell [ref=f3e736]:
                                                    - progressbar "87%" [ref=f3e738]
                                                - gridcell "2026-08-25" [ref=f3e743]
                                            - row [ref=f3e744] [cursor=pointer]:
                                                - rowheader [ref=f3e745]:
                                                    - generic [ref=f3e746]:
                                                        - paragraph [ref=f3e747]: North Star analytics 17
                                                        - paragraph [ref=f3e748]: REF-017
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f3e749]:
                                                    - generic [ref=f3e750]:
                                                        - generic "Lin Chen" [ref=f3e753]: LC
                                                        - generic [ref=f3e754]:
                                                            - generic [ref=f3e755]: Lin Chen
                                                            - generic [ref=f3e756]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e757]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e760]
                                                - gridcell [ref=f3e761]:
                                                    - progressbar "51%" [ref=f3e763]
                                                - gridcell "2026-08-25" [ref=f3e768]
                                            - row [ref=f3e769] [cursor=pointer]:
                                                - rowheader [ref=f3e770]:
                                                    - generic [ref=f3e771]:
                                                        - paragraph [ref=f3e772]: Creator support operations 29
                                                        - paragraph [ref=f3e773]: REF-029
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f3e774]:
                                                    - generic [ref=f3e775]:
                                                        - generic "Lin Chen" [ref=f3e778]: LC
                                                        - generic [ref=f3e779]:
                                                            - generic [ref=f3e780]: Lin Chen
                                                            - generic [ref=f3e781]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e782]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e785]
                                                - gridcell [ref=f3e786]:
                                                    - progressbar "79%" [ref=f3e788]
                                                - gridcell "2026-08-25" [ref=f3e793]
                                            - row [ref=f3e794] [cursor=pointer]:
                                                - rowheader [ref=f3e795]:
                                                    - generic [ref=f3e796]:
                                                        - paragraph [ref=f3e797]: North Star analytics 41
                                                        - paragraph [ref=f3e798]: REF-041
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f3e799]:
                                                    - generic [ref=f3e800]:
                                                        - generic "Lin Chen" [ref=f3e803]: LC
                                                        - generic [ref=f3e804]:
                                                            - generic [ref=f3e805]: Lin Chen
                                                            - generic [ref=f3e806]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e807]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e810]
                                                - gridcell [ref=f3e811]:
                                                    - progressbar "43%" [ref=f3e813]
                                                - gridcell "2026-08-25" [ref=f3e818]
                                    - navigation "Reference 列表分页" [ref=f3e820]:
                                        - list [ref=f3e821]:
                                            - listitem [ref=f3e822]:
                                                - button "上一页" [disabled]:
                                                    - generic: ‹
                                            - listitem [ref=f3e823]:
                                                - button "第 1 页" [ref=f3e824] [cursor=pointer]: '1'
                                            - listitem [ref=f3e825]:
                                                - button "第 2 页" [ref=f3e826] [cursor=pointer]: '2'
                                            - listitem [ref=f3e827]:
                                                - button "第 3 页" [ref=f3e828] [cursor=pointer]: '3'
                                            - listitem [ref=f3e829]:
                                                - button "下一页" [ref=f3e830] [cursor=pointer]:
                                                    - generic [ref=f3e831]: ›
                            - complementary [ref=f3e832]:
                                - generic [ref=f3e833]:
                                    - generic [ref=f3e835]:
                                        - generic [ref=f3e836]:
                                            - paragraph [ref=f3e837]: REF-001
                                            - heading "North Star analytics 1" [level=2] [ref=f3e838]
                                        - generic [ref=f3e839]: 健康
                                    - generic [ref=f3e843]:
                                        - tablist "工作流详情" [ref=f3e844]:
                                            - tab "摘要" [selected] [ref=f3e845] [cursor=pointer]
                                            - tab "活动" [ref=f3e847] [cursor=pointer]
                                            - tab "风险" [ref=f3e849] [cursor=pointer]
                                        - tabpanel "摘要" [ref=f3e851]:
                                            - generic [ref=f3e853]:
                                                - paragraph [ref=f3e854]: 本地参考数据用于验证长内容、状态组合、响应式布局和浏览器交互，不依赖后端。
                                                - generic "工作流详情" [ref=f3e855]:
                                                    - generic [ref=f3e856]:
                                                        - term [ref=f3e857]: 负责人
                                                        - definition [ref=f3e858]:
                                                            - generic [ref=f3e859]:
                                                                - generic "Lin Chen" [ref=f3e862]: LC
                                                                - generic [ref=f3e863]:
                                                                    - generic [ref=f3e864]: Lin Chen
                                                                    - generic [ref=f3e865]: 亚太
                                                    - generic [ref=f3e866]:
                                                        - term [ref=f3e867]: 更新时间
                                                        - definition [ref=f3e868]: 2026年8月29日
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
