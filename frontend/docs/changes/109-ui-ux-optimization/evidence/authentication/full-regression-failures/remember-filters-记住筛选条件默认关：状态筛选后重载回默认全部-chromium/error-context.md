# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: remember-filters.spec.ts >> 记住筛选条件默认关：状态筛选后重载回默认全部
- Location: apps\web\e2e\remember-filters.spec.ts:18:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 21
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
                    - paragraph [ref=f3e19]: Community
                    - paragraph [ref=f3e20]: 统一前端基座
            - navigation "主导航" [ref=f3e21]:
                - generic [ref=f3e22]:
                    - paragraph [ref=f3e23]: Universal Foundation
                    - list [ref=f3e24]:
                        - listitem [ref=f3e25]:
                            - link "总览" [ref=f3e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=f3e33]:
                    - paragraph [ref=f3e34]: 系统
                    - list [ref=f3e35]:
                        - listitem [ref=f3e36]:
                            - link "设置" [ref=f3e37] [cursor=pointer]:
                                - /url: /settings
                        - listitem [ref=f3e42]:
                            - link "Icon 大全" [ref=f3e43] [cursor=pointer]:
                                - /url: /system-tools/icons
                - generic [ref=f3e48]:
                    - paragraph [ref=f3e49]: 参考资源
                    - list [ref=f3e50]:
                        - listitem [ref=f3e51]:
                            - link "参考资源" [ref=f3e52] [cursor=pointer]:
                                - /url: /reference-resources
                - generic [ref=f3e56]:
                    - paragraph [ref=f3e57]: 开发
                    - list [ref=f3e58]:
                        - listitem [ref=f3e59]:
                            - link "基座能力" [ref=f3e60] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f3e72]:
                            - link "Motion" [ref=f3e73] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f3e77]:
                            - button "展开或收起Page Archetypes" [expanded] [ref=f3e78]:
                                - generic [ref=f3e81]: Page Archetypes
                            - list [ref=f3e84]:
                                - listitem [ref=f3e85]:
                                    - link "总览原型" [ref=f3e86] [cursor=pointer]:
                                        - /url: /page-archetypes/overview
                                - listitem [ref=f3e90]:
                                    - link "数据工作台" [ref=f3e91] [cursor=pointer]:
                                        - /url: /page-archetypes/resource-list
                                - listitem [ref=f3e95]:
                                    - link "详情页" [ref=f3e96] [cursor=pointer]:
                                        - /url: /page-archetypes/detail
                                - listitem [ref=f3e100]:
                                    - link "创建与编辑" [ref=f3e101] [cursor=pointer]:
                                        - /url: /page-archetypes/create-edit
                                - listitem [ref=f3e105]:
                                    - link "设置页" [ref=f3e106] [cursor=pointer]:
                                        - /url: /page-archetypes/settings
                                - listitem [ref=f3e110]:
                                    - link "主从视图" [ref=f3e111] [cursor=pointer]:
                                        - /url: /page-archetypes/master-detail
                                - listitem [ref=f3e115]:
                                    - link "操作任务" [ref=f3e116] [cursor=pointer]:
                                        - /url: /page-archetypes/operation
                        - listitem [ref=f3e120]:
                            - button "展开或收起Page Patterns" [ref=f3e121]:
                                - generic [ref=f3e127]: Page Patterns
                        - listitem [ref=f3e130]:
                            - link "状态体系" [ref=f3e131] [cursor=pointer]:
                                - /url: /states
                        - listitem [ref=f3e137]:
                            - button "展开或收起UI Elements" [ref=f3e138]:
                                - generic [ref=f3e144]: UI Elements
            - generic [ref=f3e147]:
                - generic [ref=f3e148]: Architecture Preview
                - paragraph [ref=f3e153]: React 19 · HeroUI · Tailwind CSS v4
        - generic [ref=f3e154]:
            - banner [ref=f3e156]:
                - button "收起侧栏" [ref=f3e158] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f3e160] [cursor=pointer]
                - generic [ref=f3e161]:
                    - generic [ref=f3e162]:
                        - button "切换语言" [ref=f3e163] [cursor=pointer]
                        - button "切换主题" [ref=f3e164] [cursor=pointer]
                    - button "通知" [ref=f3e165]
                    - button "当前用户" [ref=f3e169] [cursor=pointer]:
                        - generic [ref=f3e171]:
                            - generic "Rin" [ref=f3e174]: RI
                            - generic [ref=f3e175]: Rin
            - main [ref=f3e179]:
                - generic [ref=f3e181]:
                    - generic [ref=f3e182]:
                        - list "面包屑导航" [ref=f3e183]:
                            - listitem [ref=f3e184]:
                                - link "基座验证" [ref=f3e185] [cursor=pointer]
                                - generic [ref=f3e186]: /
                            - listitem [ref=f3e187]:
                                - link "数据工作台" [disabled]
                        - generic [ref=f3e188]:
                            - generic [ref=f3e189]:
                                - paragraph [ref=f3e190]: Reference · Workspace
                                - heading "高密度数据工作台" [level=1] [ref=f3e191]
                                - paragraph [ref=f3e192]: 使用 48 条本地基准数据验证 Dashboard、筛选、Table、Master-Detail、Tabs、Drawer、Dialog 与非正常状态的协作边界。
                            - generic [ref=f3e193]:
                                - button "打开活动侧栏" [ref=f3e194] [cursor=pointer]
                                - button "打开确认对话框" [ref=f3e195] [cursor=pointer]
                    - generic [ref=f3e196]:
                        - generic [ref=f3e197]:
                            - paragraph [ref=f3e198]: 总工作流
                            - paragraph [ref=f3e199]: '48'
                        - generic [ref=f3e200]:
                            - paragraph [ref=f3e201]: 需关注
                            - paragraph [ref=f3e202]: '16'
                        - generic [ref=f3e203]:
                            - paragraph [ref=f3e204]: 高风险
                            - paragraph [ref=f3e205]: '16'
                        - generic [ref=f3e206]:
                            - paragraph [ref=f3e207]: 筛选结果
                            - paragraph [ref=f3e208]: '48'
                    - toolbar "页面工具栏" [ref=f3e209]:
                        - generic [ref=f3e212]:
                            - group [ref=f3e214]:
                                - searchbox "搜索 Reference 数据" [ref=f3e215]
                                - button "Close"
                            - button "搜索" [ref=f3e216] [cursor=pointer]
                        - button "导出快照" [ref=f3e219] [cursor=pointer]
                    - generic [ref=f3e222]:
                        - generic [ref=f3e223]:
                            - generic [ref=f3e224]: 状态
                            - button "全部 状态" [ref=f3e225] [cursor=pointer]:
                                - generic [ref=f3e226]: 全部
                            - combobox [ref=f3e233]
                        - generic [ref=f3e234]:
                            - generic [ref=f3e235]: 区域
                            - button "全部 区域" [ref=f3e236] [cursor=pointer]:
                                - generic [ref=f3e237]: 全部
                            - combobox [ref=f3e244]
                        - generic [ref=f3e245]:
                            - generic [ref=f3e246]: 表格密度
                            - button "舒适 表格密度" [ref=f3e247] [cursor=pointer]:
                                - generic [ref=f3e248]: 舒适
                            - combobox [ref=f3e255]
                        - generic [ref=f3e256]:
                            - generic [ref=f3e257]: 场景状态
                            - button "正常 场景状态" [ref=f3e258] [cursor=pointer]:
                                - generic [ref=f3e259]: 正常
                            - combobox [ref=f3e266]
                    - region "Reference 工作流数据表" [ref=f3e267]:
                        - generic [ref=f3e269]:
                            - generic [ref=f3e271]:
                                - generic [ref=f3e272]:
                                    - generic [ref=f3e273]:
                                        - heading "工作流列表" [level=2] [ref=f3e274]
                                        - paragraph [ref=f3e275]: 当前展示 48 条记录；数据量用于验证滚动、密度与溢出。
                                    - button "列设置" [ref=f3e278]
                                - generic [ref=f3e279]:
                                    - grid "Reference 工作流数据表" [ref=f3e283]:
                                        - rowgroup [ref=f3e284]:
                                            - row [ref=f3e285]:
                                                - columnheader [ref=f3e286] [cursor=pointer]:
                                                    - generic [ref=f3e287]: 工作流
                                                    - slider "尺寸调整器 工作流" [ref=f3e288]: '102'
                                                - columnheader [ref=f3e289] [cursor=pointer]:
                                                    - generic [ref=f3e290]: 负责人
                                                    - slider "尺寸调整器 负责人" [ref=f3e291]: '101'
                                                - columnheader [ref=f3e292] [cursor=pointer]:
                                                    - generic [ref=f3e293]: 状态
                                                    - slider "尺寸调整器 状态" [ref=f3e294]: '102'
                                                - columnheader [ref=f3e295] [cursor=pointer]:
                                                    - generic [ref=f3e296]: 区域
                                                    - slider "尺寸调整器 区域" [ref=f3e297]: '101'
                                                - columnheader [ref=f3e298] [cursor=pointer]:
                                                    - generic [ref=f3e299]: 完成度
                                                    - slider "尺寸调整器 完成度" [ref=f3e300]: '102'
                                                - columnheader [ref=f3e301] [cursor=pointer]:
                                                    - generic [ref=f3e302]: 更新时间
                                                    - slider "尺寸调整器 更新时间" [ref=f3e305]: '101'
                                        - rowgroup [ref=f3e306]:
                                            - row [ref=f3e307] [cursor=pointer]:
                                                - rowheader [ref=f3e308]:
                                                    - generic [ref=f3e309]:
                                                        - paragraph [ref=f3e310]: North Star analytics 1
                                                        - paragraph [ref=f3e311]: REF-001
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f3e312]:
                                                    - generic [ref=f3e313]:
                                                        - generic "Lin Chen" [ref=f3e316]: LC
                                                        - generic [ref=f3e317]:
                                                            - generic [ref=f3e318]: Lin Chen
                                                            - generic [ref=f3e319]: 亚太
                                                - gridcell "健康" [ref=f3e320]
                                                - gridcell "亚太" [ref=f3e323]
                                                - gridcell [ref=f3e324]:
                                                    - progressbar "35%" [ref=f3e326]
                                                - gridcell "2026-08-29" [ref=f3e331]
                                            - row [ref=f3e332] [cursor=pointer]:
                                                - rowheader [ref=f3e333]:
                                                    - generic [ref=f3e334]:
                                                        - paragraph [ref=f3e335]: Creator support operations 13
                                                        - paragraph [ref=f3e336]: REF-013
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f3e337]:
                                                    - generic [ref=f3e338]:
                                                        - generic "Lin Chen" [ref=f3e341]: LC
                                                        - generic [ref=f3e342]:
                                                            - generic [ref=f3e343]: Lin Chen
                                                            - generic [ref=f3e344]: 亚太
                                                - gridcell "健康" [ref=f3e345]
                                                - gridcell "亚太" [ref=f3e348]
                                                - gridcell [ref=f3e349]:
                                                    - progressbar "63%" [ref=f3e351]
                                                - gridcell "2026-08-29" [ref=f3e356]
                                            - row [ref=f3e357] [cursor=pointer]:
                                                - rowheader [ref=f3e358]:
                                                    - generic [ref=f3e359]:
                                                        - paragraph [ref=f3e360]: North Star analytics 25
                                                        - paragraph [ref=f3e361]: REF-025
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f3e362]:
                                                    - generic [ref=f3e363]:
                                                        - generic "Lin Chen" [ref=f3e366]: LC
                                                        - generic [ref=f3e367]:
                                                            - generic [ref=f3e368]: Lin Chen
                                                            - generic [ref=f3e369]: 亚太
                                                - gridcell "健康" [ref=f3e370]
                                                - gridcell "亚太" [ref=f3e373]
                                                - gridcell [ref=f3e374]:
                                                    - progressbar "91%" [ref=f3e376]
                                                - gridcell "2026-08-29" [ref=f3e381]
                                            - row [ref=f3e382] [cursor=pointer]:
                                                - rowheader [ref=f3e383]:
                                                    - generic [ref=f3e384]:
                                                        - paragraph [ref=f3e385]: Creator support operations 37
                                                        - paragraph [ref=f3e386]: REF-037
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f3e387]:
                                                    - generic [ref=f3e388]:
                                                        - generic "Lin Chen" [ref=f3e391]: LC
                                                        - generic [ref=f3e392]:
                                                            - generic [ref=f3e393]: Lin Chen
                                                            - generic [ref=f3e394]: 亚太
                                                - gridcell "健康" [ref=f3e395]
                                                - gridcell "亚太" [ref=f3e398]
                                                - gridcell [ref=f3e399]:
                                                    - progressbar "55%" [ref=f3e401]
                                                - gridcell "2026-08-29" [ref=f3e406]
                                            - row [ref=f3e407] [cursor=pointer]:
                                                - rowheader [ref=f3e408]:
                                                    - generic [ref=f3e409]:
                                                        - paragraph [ref=f3e410]: Partner onboarding 2
                                                        - paragraph [ref=f3e411]: REF-002
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f3e412]:
                                                    - generic [ref=f3e413]:
                                                        - generic "Avery Morgan" [ref=f3e416]: AM
                                                        - generic [ref=f3e417]:
                                                            - generic [ref=f3e418]: Avery Morgan
                                                            - generic [ref=f3e419]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e420]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e423]
                                                - gridcell [ref=f3e424]:
                                                    - progressbar "48%" [ref=f3e426]
                                                - gridcell "2026-08-28" [ref=f3e431]
                                            - row [ref=f3e432] [cursor=pointer]:
                                                - rowheader [ref=f3e433]:
                                                    - generic [ref=f3e434]:
                                                        - paragraph [ref=f3e435]: Moderation quality signals 14
                                                        - paragraph [ref=f3e436]: REF-014
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f3e437]:
                                                    - generic [ref=f3e438]:
                                                        - generic "Avery Morgan" [ref=f3e441]: AM
                                                        - generic [ref=f3e442]:
                                                            - generic [ref=f3e443]: Avery Morgan
                                                            - generic [ref=f3e444]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e445]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e448]
                                                - gridcell [ref=f3e449]:
                                                    - progressbar "76%" [ref=f3e451]
                                                - gridcell "2026-08-28" [ref=f3e456]
                                            - row [ref=f3e457] [cursor=pointer]:
                                                - rowheader [ref=f3e458]:
                                                    - generic [ref=f3e459]:
                                                        - paragraph [ref=f3e460]: Partner onboarding 26
                                                        - paragraph [ref=f3e461]: REF-026
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f3e462]:
                                                    - generic [ref=f3e463]:
                                                        - generic "Avery Morgan" [ref=f3e466]: AM
                                                        - generic [ref=f3e467]:
                                                            - generic [ref=f3e468]: Avery Morgan
                                                            - generic [ref=f3e469]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e470]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e473]
                                                - gridcell [ref=f3e474]:
                                                    - progressbar "40%" [ref=f3e476]
                                                - gridcell "2026-08-28" [ref=f3e481]
                                            - row [ref=f3e482] [cursor=pointer]:
                                                - rowheader [ref=f3e483]:
                                                    - generic [ref=f3e484]:
                                                        - paragraph [ref=f3e485]: Moderation quality signals 38
                                                        - paragraph [ref=f3e486]: REF-038
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f3e487]:
                                                    - generic [ref=f3e488]:
                                                        - generic "Avery Morgan" [ref=f3e491]: AM
                                                        - generic [ref=f3e492]:
                                                            - generic [ref=f3e493]: Avery Morgan
                                                            - generic [ref=f3e494]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e495]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e498]
                                                - gridcell [ref=f3e499]:
                                                    - progressbar "68%" [ref=f3e501]
                                                - gridcell "2026-08-28" [ref=f3e506]
                                            - row [ref=f3e507] [cursor=pointer]:
                                                - rowheader [ref=f3e508]:
                                                    - generic [ref=f3e509]:
                                                        - paragraph [ref=f3e510]: Trust review pipeline 3
                                                        - paragraph [ref=f3e511]: REF-003
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f3e512]:
                                                    - generic [ref=f3e513]:
                                                        - generic "Mika Sato" [ref=f3e516]: MS
                                                        - generic [ref=f3e517]:
                                                            - generic [ref=f3e518]: Mika Sato
                                                            - generic [ref=f3e519]: 美洲
                                                - gridcell "已暂停" [ref=f3e520]
                                                - gridcell "美洲" [ref=f3e523]
                                                - gridcell [ref=f3e524]:
                                                    - progressbar "61%" [ref=f3e526]
                                                - gridcell "2026-08-27" [ref=f3e531]
                                            - row [ref=f3e532] [cursor=pointer]:
                                                - rowheader [ref=f3e533]:
                                                    - generic [ref=f3e534]:
                                                        - paragraph [ref=f3e535]: Billing reconciliation 15
                                                        - paragraph [ref=f3e536]: REF-015
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f3e537]:
                                                    - generic [ref=f3e538]:
                                                        - generic "Mika Sato" [ref=f3e541]: MS
                                                        - generic [ref=f3e542]:
                                                            - generic [ref=f3e543]: Mika Sato
                                                            - generic [ref=f3e544]: 美洲
                                                - gridcell "已暂停" [ref=f3e545]
                                                - gridcell "美洲" [ref=f3e548]
                                                - gridcell [ref=f3e549]:
                                                    - progressbar "89%" [ref=f3e551]
                                                - gridcell "2026-08-27" [ref=f3e556]
                                            - row [ref=f3e557] [cursor=pointer]:
                                                - rowheader [ref=f3e558]:
                                                    - generic [ref=f3e559]:
                                                        - paragraph [ref=f3e560]: Trust review pipeline 27
                                                        - paragraph [ref=f3e561]: REF-027
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f3e562]:
                                                    - generic [ref=f3e563]:
                                                        - generic "Mika Sato" [ref=f3e566]: MS
                                                        - generic [ref=f3e567]:
                                                            - generic [ref=f3e568]: Mika Sato
                                                            - generic [ref=f3e569]: 美洲
                                                - gridcell "已暂停" [ref=f3e570]
                                                - gridcell "美洲" [ref=f3e573]
                                                - gridcell [ref=f3e574]:
                                                    - progressbar "53%" [ref=f3e576]
                                                - gridcell "2026-08-27" [ref=f3e581]
                                            - row [ref=f3e582] [cursor=pointer]:
                                                - rowheader [ref=f3e583]:
                                                    - generic [ref=f3e584]:
                                                        - paragraph [ref=f3e585]: Billing reconciliation 39
                                                        - paragraph [ref=f3e586]: REF-039
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f3e587]:
                                                    - generic [ref=f3e588]:
                                                        - generic "Mika Sato" [ref=f3e591]: MS
                                                        - generic [ref=f3e592]:
                                                            - generic [ref=f3e593]: Mika Sato
                                                            - generic [ref=f3e594]: 美洲
                                                - gridcell "已暂停" [ref=f3e595]
                                                - gridcell "美洲" [ref=f3e598]
                                                - gridcell [ref=f3e599]:
                                                    - progressbar "81%" [ref=f3e601]
                                                - gridcell "2026-08-27" [ref=f3e606]
                                            - row [ref=f3e607] [cursor=pointer]:
                                                - rowheader [ref=f3e608]:
                                                    - generic [ref=f3e609]:
                                                        - paragraph [ref=f3e610]: Regional release readiness 4
                                                        - paragraph [ref=f3e611]: REF-004
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f3e612]:
                                                    - generic [ref=f3e613]:
                                                        - generic "Sam Rivera" [ref=f3e616]: SR
                                                        - generic [ref=f3e617]:
                                                            - generic [ref=f3e618]: Sam Rivera
                                                            - generic [ref=f3e619]: 亚太
                                                - gridcell "健康" [ref=f3e620]
                                                - gridcell "亚太" [ref=f3e623]
                                                - gridcell [ref=f3e624]:
                                                    - progressbar "74%" [ref=f3e626]
                                                - gridcell "2026-08-26" [ref=f3e631]
                                            - row [ref=f3e632] [cursor=pointer]:
                                                - rowheader [ref=f3e633]:
                                                    - generic [ref=f3e634]:
                                                        - paragraph [ref=f3e635]: Content lifecycle governance 16
                                                        - paragraph [ref=f3e636]: REF-016
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f3e637]:
                                                    - generic [ref=f3e638]:
                                                        - generic "Sam Rivera" [ref=f3e641]: SR
                                                        - generic [ref=f3e642]:
                                                            - generic [ref=f3e643]: Sam Rivera
                                                            - generic [ref=f3e644]: 亚太
                                                - gridcell "健康" [ref=f3e645]
                                                - gridcell "亚太" [ref=f3e648]
                                                - gridcell [ref=f3e649]:
                                                    - progressbar "38%" [ref=f3e651]
                                                - gridcell "2026-08-26" [ref=f3e656]
                                            - row [ref=f3e657] [cursor=pointer]:
                                                - rowheader [ref=f3e658]:
                                                    - generic [ref=f3e659]:
                                                        - paragraph [ref=f3e660]: Regional release readiness 28
                                                        - paragraph [ref=f3e661]: REF-028
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f3e662]:
                                                    - generic [ref=f3e663]:
                                                        - generic "Sam Rivera" [ref=f3e666]: SR
                                                        - generic [ref=f3e667]:
                                                            - generic [ref=f3e668]: Sam Rivera
                                                            - generic [ref=f3e669]: 亚太
                                                - gridcell "健康" [ref=f3e670]
                                                - gridcell "亚太" [ref=f3e673]
                                                - gridcell [ref=f3e674]:
                                                    - progressbar "66%" [ref=f3e676]
                                                - gridcell "2026-08-26" [ref=f3e681]
                                            - row [ref=f3e682] [cursor=pointer]:
                                                - rowheader [ref=f3e683]:
                                                    - generic [ref=f3e684]:
                                                        - paragraph [ref=f3e685]: Content lifecycle governance 40
                                                        - paragraph [ref=f3e686]: REF-040
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f3e687]:
                                                    - generic [ref=f3e688]:
                                                        - generic "Sam Rivera" [ref=f3e691]: SR
                                                        - generic [ref=f3e692]:
                                                            - generic [ref=f3e693]: Sam Rivera
                                                            - generic [ref=f3e694]: 亚太
                                                - gridcell "健康" [ref=f3e695]
                                                - gridcell "亚太" [ref=f3e698]
                                                - gridcell [ref=f3e699]:
                                                    - progressbar "94%" [ref=f3e701]
                                                - gridcell "2026-08-26" [ref=f3e706]
                                            - row [ref=f3e707] [cursor=pointer]:
                                                - rowheader [ref=f3e708]:
                                                    - generic [ref=f3e709]:
                                                        - paragraph [ref=f3e710]: Creator support operations 5
                                                        - paragraph [ref=f3e711]: REF-005
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f3e712]:
                                                    - generic [ref=f3e713]:
                                                        - generic "Lin Chen" [ref=f3e716]: LC
                                                        - generic [ref=f3e717]:
                                                            - generic [ref=f3e718]: Lin Chen
                                                            - generic [ref=f3e719]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e720]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e723]
                                                - gridcell [ref=f3e724]:
                                                    - progressbar "87%" [ref=f3e726]
                                                - gridcell "2026-08-25" [ref=f3e731]
                                            - row [ref=f3e732] [cursor=pointer]:
                                                - rowheader [ref=f3e733]:
                                                    - generic [ref=f3e734]:
                                                        - paragraph [ref=f3e735]: North Star analytics 17
                                                        - paragraph [ref=f3e736]: REF-017
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f3e737]:
                                                    - generic [ref=f3e738]:
                                                        - generic "Lin Chen" [ref=f3e741]: LC
                                                        - generic [ref=f3e742]:
                                                            - generic [ref=f3e743]: Lin Chen
                                                            - generic [ref=f3e744]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e745]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e748]
                                                - gridcell [ref=f3e749]:
                                                    - progressbar "51%" [ref=f3e751]
                                                - gridcell "2026-08-25" [ref=f3e756]
                                            - row [ref=f3e757] [cursor=pointer]:
                                                - rowheader [ref=f3e758]:
                                                    - generic [ref=f3e759]:
                                                        - paragraph [ref=f3e760]: Creator support operations 29
                                                        - paragraph [ref=f3e761]: REF-029
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f3e762]:
                                                    - generic [ref=f3e763]:
                                                        - generic "Lin Chen" [ref=f3e766]: LC
                                                        - generic [ref=f3e767]:
                                                            - generic [ref=f3e768]: Lin Chen
                                                            - generic [ref=f3e769]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e770]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e773]
                                                - gridcell [ref=f3e774]:
                                                    - progressbar "79%" [ref=f3e776]
                                                - gridcell "2026-08-25" [ref=f3e781]
                                            - row [ref=f3e782] [cursor=pointer]:
                                                - rowheader [ref=f3e783]:
                                                    - generic [ref=f3e784]:
                                                        - paragraph [ref=f3e785]: North Star analytics 41
                                                        - paragraph [ref=f3e786]: REF-041
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f3e787]:
                                                    - generic [ref=f3e788]:
                                                        - generic "Lin Chen" [ref=f3e791]: LC
                                                        - generic [ref=f3e792]:
                                                            - generic [ref=f3e793]: Lin Chen
                                                            - generic [ref=f3e794]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f3e795]
                                                - gridcell "欧洲、中东与非洲" [ref=f3e798]
                                                - gridcell [ref=f3e799]:
                                                    - progressbar "43%" [ref=f3e801]
                                                - gridcell "2026-08-25" [ref=f3e806]
                                    - navigation "Reference 列表分页" [ref=f3e808]:
                                        - list [ref=f3e809]:
                                            - listitem [ref=f3e810]:
                                                - button "上一页" [disabled]:
                                                    - generic: ‹
                                            - listitem [ref=f3e811]:
                                                - button "第 1 页" [ref=f3e812] [cursor=pointer]: '1'
                                            - listitem [ref=f3e813]:
                                                - button "第 2 页" [ref=f3e814] [cursor=pointer]: '2'
                                            - listitem [ref=f3e815]:
                                                - button "第 3 页" [ref=f3e816] [cursor=pointer]: '3'
                                            - listitem [ref=f3e817]:
                                                - button "下一页" [ref=f3e818] [cursor=pointer]:
                                                    - generic [ref=f3e819]: ›
                            - complementary [ref=f3e820]:
                                - generic [ref=f3e821]:
                                    - generic [ref=f3e823]:
                                        - generic [ref=f3e824]:
                                            - paragraph [ref=f3e825]: REF-001
                                            - heading "North Star analytics 1" [level=2] [ref=f3e826]
                                        - generic [ref=f3e827]: 健康
                                    - generic [ref=f3e831]:
                                        - tablist "工作流详情" [ref=f3e832]:
                                            - tab "摘要" [selected] [ref=f3e833] [cursor=pointer]
                                            - tab "活动" [ref=f3e835] [cursor=pointer]
                                            - tab "风险" [ref=f3e837] [cursor=pointer]
                                        - tabpanel "摘要" [ref=f3e839]:
                                            - generic [ref=f3e841]:
                                                - paragraph [ref=f3e842]: 本地参考数据用于验证长内容、状态组合、响应式布局和浏览器交互，不依赖后端。
                                                - generic "工作流详情" [ref=f3e843]:
                                                    - generic [ref=f3e844]:
                                                        - term [ref=f3e845]: 负责人
                                                        - definition [ref=f3e846]:
                                                            - generic [ref=f3e847]:
                                                                - generic "Lin Chen" [ref=f3e850]: LC
                                                                - generic [ref=f3e851]:
                                                                    - generic [ref=f3e852]: Lin Chen
                                                                    - generic [ref=f3e853]: 亚太
                                                    - generic [ref=f3e854]:
                                                        - term [ref=f3e855]: 更新时间
                                                        - definition [ref=f3e856]: 2026年8月29日
```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | import { expect, test } from '@playwright/test';
  3  |
  4  | async function resetPreferences(page: Page) {
  5  |   await page.goto('/settings/data-display');
  6  |   await page.evaluate(() => {
  7  |     window.localStorage.removeItem('clouddrive.shell');
  8  |     window.localStorage.removeItem('clouddrive.workspace');
  9  |   });
  10 |   await page.reload();
  11 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  12 | }
  13 |
  14 | async function fullRowCount(page: Page): Promise<number> {
  15 |   return page.getByRole('grid').getByRole('row').count();
  16 | }
  17 |
  18 | test('记住筛选条件默认关：状态筛选后重载回默认全部', async ({ page }) => {
  19 |   await resetPreferences(page);
  20 |   await page.goto('/page-archetypes/resource-list');
  21 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  22 |   const full = await fullRowCount(page);
  23 |   // 状态 = 需关注。
  24 |   await page.getByRole('button', { name: '全部 状态', exact: true }).click();
  25 |   await page.getByRole('option', { name: '需关注' }).click();
  26 |   await expect(page.getByRole('button', { name: '需关注 状态', exact: true })).toBeVisible();
  27 |   await page.waitForTimeout(300);
  28 |   await page.reload();
  29 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  30 |   // 默认关：回全部（行数恢复完整）。
  31 |   await expect(page.getByRole('button', { name: '全部 状态', exact: true })).toBeVisible();
> 32 |   expect(await fullRowCount(page)).toBe(full);
     |                                    ^ Error: expect(received).toBe(expected) // Object.is equality
  33 | });
  34 |
  35 | test('开启 记住筛选条件：状态筛选后重载仍保持', async ({ page }) => {
  36 |   await resetPreferences(page);
  37 |   // 设置 → 数据展示 → 记住筛选条件 = 开。
  38 |   await page.goto('/settings/data-display');
  39 |   await page.getByRole('heading', { name: '数据展示' }).first().scrollIntoViewIfNeeded();
  40 |   const remember = page.getByRole('switch', { name: '记住筛选条件' });
  41 |   await remember.focus();
  42 |   await page.keyboard.press('Space');
  43 |   await expect(remember).toBeChecked();
  44 |   await page.waitForTimeout(300);
  45 |
  46 |   await page.goto('/page-archetypes/resource-list');
  47 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  48 |   await page.getByRole('button', { name: '全部 状态', exact: true }).click();
  49 |   await page.getByRole('option', { name: '需关注' }).click();
  50 |   await expect(page.getByRole('button', { name: '需关注 状态', exact: true })).toBeVisible();
  51 |   const filtered = await fullRowCount(page);
  52 |   expect(filtered).toBeLessThan(20);
  53 |   await page.reload();
  54 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  55 |   // 筛选保持。
  56 |   await expect(page.getByRole('button', { name: '需关注 状态', exact: true })).toBeVisible();
  57 |   expect(await fullRowCount(page)).toBe(filtered);
  58 | });
  59 |
```
