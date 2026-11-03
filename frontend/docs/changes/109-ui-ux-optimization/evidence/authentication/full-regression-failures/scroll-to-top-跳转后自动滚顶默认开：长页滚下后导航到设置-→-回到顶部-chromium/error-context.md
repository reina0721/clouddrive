# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scroll-to-top.spec.ts >> 跳转后自动滚顶默认开：长页滚下后导航到设置 → 回到顶部
- Location: apps\web\e2e\scroll-to-top.spec.ts:17:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 100
Received:   0
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
                    - paragraph [ref=f2e19]: Community
                    - paragraph [ref=f2e20]: 统一前端基座
            - navigation "主导航" [ref=f2e21]:
                - generic [ref=f2e22]:
                    - paragraph [ref=f2e23]: Universal Foundation
                    - list [ref=f2e24]:
                        - listitem [ref=f2e25]:
                            - link "总览" [ref=f2e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=f2e33]:
                    - paragraph [ref=f2e34]: 系统
                    - list [ref=f2e35]:
                        - listitem [ref=f2e36]:
                            - link "设置" [ref=f2e37] [cursor=pointer]:
                                - /url: /settings
                        - listitem [ref=f2e42]:
                            - link "Icon 大全" [ref=f2e43] [cursor=pointer]:
                                - /url: /system-tools/icons
                - generic [ref=f2e48]:
                    - paragraph [ref=f2e49]: 参考资源
                    - list [ref=f2e50]:
                        - listitem [ref=f2e51]:
                            - link "参考资源" [ref=f2e52] [cursor=pointer]:
                                - /url: /reference-resources
                - generic [ref=f2e56]:
                    - paragraph [ref=f2e57]: 开发
                    - list [ref=f2e58]:
                        - listitem [ref=f2e59]:
                            - link "基座能力" [ref=f2e60] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f2e72]:
                            - link "Motion" [ref=f2e73] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f2e77]:
                            - button "展开或收起Page Archetypes" [expanded] [ref=f2e78]:
                                - generic [ref=f2e81]: Page Archetypes
                            - list [ref=f2e84]:
                                - listitem [ref=f2e85]:
                                    - link "总览原型" [ref=f2e86] [cursor=pointer]:
                                        - /url: /page-archetypes/overview
                                - listitem [ref=f2e90]:
                                    - link "数据工作台" [ref=f2e91] [cursor=pointer]:
                                        - /url: /page-archetypes/resource-list
                                - listitem [ref=f2e95]:
                                    - link "详情页" [ref=f2e96] [cursor=pointer]:
                                        - /url: /page-archetypes/detail
                                - listitem [ref=f2e100]:
                                    - link "创建与编辑" [ref=f2e101] [cursor=pointer]:
                                        - /url: /page-archetypes/create-edit
                                - listitem [ref=f2e105]:
                                    - link "设置页" [ref=f2e106] [cursor=pointer]:
                                        - /url: /page-archetypes/settings
                                - listitem [ref=f2e110]:
                                    - link "主从视图" [ref=f2e111] [cursor=pointer]:
                                        - /url: /page-archetypes/master-detail
                                - listitem [ref=f2e115]:
                                    - link "操作任务" [ref=f2e116] [cursor=pointer]:
                                        - /url: /page-archetypes/operation
                        - listitem [ref=f2e120]:
                            - button "展开或收起Page Patterns" [ref=f2e121]:
                                - generic [ref=f2e127]: Page Patterns
                        - listitem [ref=f2e130]:
                            - link "状态体系" [ref=f2e131] [cursor=pointer]:
                                - /url: /states
                        - listitem [ref=f2e137]:
                            - button "展开或收起UI Elements" [ref=f2e138]:
                                - generic [ref=f2e144]: UI Elements
            - generic [ref=f2e147]:
                - generic [ref=f2e148]: Architecture Preview
                - paragraph [ref=f2e153]: React 19 · HeroUI · Tailwind CSS v4
        - generic [ref=f2e154]:
            - banner [ref=f2e156]:
                - button "收起侧栏" [ref=f2e158] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f2e160] [cursor=pointer]
                - generic [ref=f2e161]:
                    - generic [ref=f2e162]:
                        - button "切换语言" [ref=f2e163] [cursor=pointer]
                        - button "切换主题" [ref=f2e164] [cursor=pointer]
                    - button "通知" [ref=f2e165]
                    - button "当前用户" [ref=f2e169] [cursor=pointer]:
                        - generic [ref=f2e171]:
                            - generic "Rin" [ref=f2e174]: RI
                            - generic [ref=f2e175]: Rin
            - main [ref=f2e179]:
                - generic [ref=f2e181]:
                    - generic [ref=f2e182]:
                        - list "面包屑导航" [ref=f2e183]:
                            - listitem [ref=f2e184]:
                                - link "基座验证" [ref=f2e185] [cursor=pointer]
                                - generic [ref=f2e186]: /
                            - listitem [ref=f2e187]:
                                - link "数据工作台" [disabled]
                        - generic [ref=f2e188]:
                            - generic [ref=f2e189]:
                                - paragraph [ref=f2e190]: Reference · Workspace
                                - heading "高密度数据工作台" [level=1] [ref=f2e191]
                                - paragraph [ref=f2e192]: 使用 48 条本地基准数据验证 Dashboard、筛选、Table、Master-Detail、Tabs、Drawer、Dialog 与非正常状态的协作边界。
                            - generic [ref=f2e193]:
                                - button "打开活动侧栏" [ref=f2e194] [cursor=pointer]
                                - button "打开确认对话框" [ref=f2e195] [cursor=pointer]
                    - generic [ref=f2e196]:
                        - generic [ref=f2e197]:
                            - paragraph [ref=f2e198]: 总工作流
                            - paragraph [ref=f2e199]: '48'
                        - generic [ref=f2e200]:
                            - paragraph [ref=f2e201]: 需关注
                            - paragraph [ref=f2e202]: '16'
                        - generic [ref=f2e203]:
                            - paragraph [ref=f2e204]: 高风险
                            - paragraph [ref=f2e205]: '16'
                        - generic [ref=f2e206]:
                            - paragraph [ref=f2e207]: 筛选结果
                            - paragraph [ref=f2e208]: '48'
                    - toolbar "页面工具栏" [ref=f2e209]:
                        - generic [ref=f2e212]:
                            - group [ref=f2e214]:
                                - searchbox "搜索 Reference 数据" [ref=f2e215]
                                - button "Close"
                            - button "搜索" [ref=f2e216] [cursor=pointer]
                        - button "导出快照" [ref=f2e219] [cursor=pointer]
                    - generic [ref=f2e222]:
                        - generic [ref=f2e223]:
                            - generic [ref=f2e224]: 状态
                            - button "全部 状态" [ref=f2e225] [cursor=pointer]:
                                - generic [ref=f2e226]: 全部
                            - combobox [ref=f2e233]
                        - generic [ref=f2e234]:
                            - generic [ref=f2e235]: 区域
                            - button "全部 区域" [ref=f2e236] [cursor=pointer]:
                                - generic [ref=f2e237]: 全部
                            - combobox [ref=f2e244]
                        - generic [ref=f2e245]:
                            - generic [ref=f2e246]: 表格密度
                            - button "舒适 表格密度" [ref=f2e247] [cursor=pointer]:
                                - generic [ref=f2e248]: 舒适
                            - combobox [ref=f2e255]
                        - generic [ref=f2e256]:
                            - generic [ref=f2e257]: 场景状态
                            - button "正常 场景状态" [ref=f2e258] [cursor=pointer]:
                                - generic [ref=f2e259]: 正常
                            - combobox [ref=f2e266]
                    - region "Reference 工作流数据表" [ref=f2e267]:
                        - generic [ref=f2e269]:
                            - generic [ref=f2e271]:
                                - generic [ref=f2e272]:
                                    - generic [ref=f2e273]:
                                        - heading "工作流列表" [level=2] [ref=f2e274]
                                        - paragraph [ref=f2e275]: 当前展示 48 条记录；数据量用于验证滚动、密度与溢出。
                                    - button "列设置" [ref=f2e278]
                                - generic [ref=f2e279]:
                                    - grid "Reference 工作流数据表" [ref=f2e283]:
                                        - rowgroup [ref=f2e284]:
                                            - row [ref=f2e285]:
                                                - columnheader [ref=f2e286] [cursor=pointer]:
                                                    - generic [ref=f2e287]: 工作流
                                                    - slider "尺寸调整器 工作流" [ref=f2e288]: '102'
                                                - columnheader [ref=f2e289] [cursor=pointer]:
                                                    - generic [ref=f2e290]: 负责人
                                                    - slider "尺寸调整器 负责人" [ref=f2e291]: '101'
                                                - columnheader [ref=f2e292] [cursor=pointer]:
                                                    - generic [ref=f2e293]: 状态
                                                    - slider "尺寸调整器 状态" [ref=f2e294]: '102'
                                                - columnheader [ref=f2e295] [cursor=pointer]:
                                                    - generic [ref=f2e296]: 区域
                                                    - slider "尺寸调整器 区域" [ref=f2e297]: '101'
                                                - columnheader [ref=f2e298] [cursor=pointer]:
                                                    - generic [ref=f2e299]: 完成度
                                                    - slider "尺寸调整器 完成度" [ref=f2e300]: '102'
                                                - columnheader [ref=f2e301] [cursor=pointer]:
                                                    - generic [ref=f2e302]: 更新时间
                                                    - slider "尺寸调整器 更新时间" [ref=f2e305]: '101'
                                        - rowgroup [ref=f2e306]:
                                            - row [ref=f2e307] [cursor=pointer]:
                                                - rowheader [ref=f2e308]:
                                                    - generic [ref=f2e309]:
                                                        - paragraph [ref=f2e310]: North Star analytics 1
                                                        - paragraph [ref=f2e311]: REF-001
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f2e312]:
                                                    - generic [ref=f2e313]:
                                                        - generic "Lin Chen" [ref=f2e316]: LC
                                                        - generic [ref=f2e317]:
                                                            - generic [ref=f2e318]: Lin Chen
                                                            - generic [ref=f2e319]: 亚太
                                                - gridcell "健康" [ref=f2e320]
                                                - gridcell "亚太" [ref=f2e323]
                                                - gridcell [ref=f2e324]:
                                                    - progressbar "35%" [ref=f2e326]
                                                - gridcell "2026-08-29" [ref=f2e331]
                                            - row [ref=f2e332] [cursor=pointer]:
                                                - rowheader [ref=f2e333]:
                                                    - generic [ref=f2e334]:
                                                        - paragraph [ref=f2e335]: Creator support operations 13
                                                        - paragraph [ref=f2e336]: REF-013
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f2e337]:
                                                    - generic [ref=f2e338]:
                                                        - generic "Lin Chen" [ref=f2e341]: LC
                                                        - generic [ref=f2e342]:
                                                            - generic [ref=f2e343]: Lin Chen
                                                            - generic [ref=f2e344]: 亚太
                                                - gridcell "健康" [ref=f2e345]
                                                - gridcell "亚太" [ref=f2e348]
                                                - gridcell [ref=f2e349]:
                                                    - progressbar "63%" [ref=f2e351]
                                                - gridcell "2026-08-29" [ref=f2e356]
                                            - row [ref=f2e357] [cursor=pointer]:
                                                - rowheader [ref=f2e358]:
                                                    - generic [ref=f2e359]:
                                                        - paragraph [ref=f2e360]: North Star analytics 25
                                                        - paragraph [ref=f2e361]: REF-025
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f2e362]:
                                                    - generic [ref=f2e363]:
                                                        - generic "Lin Chen" [ref=f2e366]: LC
                                                        - generic [ref=f2e367]:
                                                            - generic [ref=f2e368]: Lin Chen
                                                            - generic [ref=f2e369]: 亚太
                                                - gridcell "健康" [ref=f2e370]
                                                - gridcell "亚太" [ref=f2e373]
                                                - gridcell [ref=f2e374]:
                                                    - progressbar "91%" [ref=f2e376]
                                                - gridcell "2026-08-29" [ref=f2e381]
                                            - row [ref=f2e382] [cursor=pointer]:
                                                - rowheader [ref=f2e383]:
                                                    - generic [ref=f2e384]:
                                                        - paragraph [ref=f2e385]: Creator support operations 37
                                                        - paragraph [ref=f2e386]: REF-037
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f2e387]:
                                                    - generic [ref=f2e388]:
                                                        - generic "Lin Chen" [ref=f2e391]: LC
                                                        - generic [ref=f2e392]:
                                                            - generic [ref=f2e393]: Lin Chen
                                                            - generic [ref=f2e394]: 亚太
                                                - gridcell "健康" [ref=f2e395]
                                                - gridcell "亚太" [ref=f2e398]
                                                - gridcell [ref=f2e399]:
                                                    - progressbar "55%" [ref=f2e401]
                                                - gridcell "2026-08-29" [ref=f2e406]
                                            - row [ref=f2e407] [cursor=pointer]:
                                                - rowheader [ref=f2e408]:
                                                    - generic [ref=f2e409]:
                                                        - paragraph [ref=f2e410]: Partner onboarding 2
                                                        - paragraph [ref=f2e411]: REF-002
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f2e412]:
                                                    - generic [ref=f2e413]:
                                                        - generic "Avery Morgan" [ref=f2e416]: AM
                                                        - generic [ref=f2e417]:
                                                            - generic [ref=f2e418]: Avery Morgan
                                                            - generic [ref=f2e419]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e420]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e423]
                                                - gridcell [ref=f2e424]:
                                                    - progressbar "48%" [ref=f2e426]
                                                - gridcell "2026-08-28" [ref=f2e431]
                                            - row [ref=f2e432] [cursor=pointer]:
                                                - rowheader [ref=f2e433]:
                                                    - generic [ref=f2e434]:
                                                        - paragraph [ref=f2e435]: Moderation quality signals 14
                                                        - paragraph [ref=f2e436]: REF-014
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f2e437]:
                                                    - generic [ref=f2e438]:
                                                        - generic "Avery Morgan" [ref=f2e441]: AM
                                                        - generic [ref=f2e442]:
                                                            - generic [ref=f2e443]: Avery Morgan
                                                            - generic [ref=f2e444]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e445]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e448]
                                                - gridcell [ref=f2e449]:
                                                    - progressbar "76%" [ref=f2e451]
                                                - gridcell "2026-08-28" [ref=f2e456]
                                            - row [ref=f2e457] [cursor=pointer]:
                                                - rowheader [ref=f2e458]:
                                                    - generic [ref=f2e459]:
                                                        - paragraph [ref=f2e460]: Partner onboarding 26
                                                        - paragraph [ref=f2e461]: REF-026
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f2e462]:
                                                    - generic [ref=f2e463]:
                                                        - generic "Avery Morgan" [ref=f2e466]: AM
                                                        - generic [ref=f2e467]:
                                                            - generic [ref=f2e468]: Avery Morgan
                                                            - generic [ref=f2e469]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e470]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e473]
                                                - gridcell [ref=f2e474]:
                                                    - progressbar "40%" [ref=f2e476]
                                                - gridcell "2026-08-28" [ref=f2e481]
                                            - row [ref=f2e482] [cursor=pointer]:
                                                - rowheader [ref=f2e483]:
                                                    - generic [ref=f2e484]:
                                                        - paragraph [ref=f2e485]: Moderation quality signals 38
                                                        - paragraph [ref=f2e486]: REF-038
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f2e487]:
                                                    - generic [ref=f2e488]:
                                                        - generic "Avery Morgan" [ref=f2e491]: AM
                                                        - generic [ref=f2e492]:
                                                            - generic [ref=f2e493]: Avery Morgan
                                                            - generic [ref=f2e494]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e495]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e498]
                                                - gridcell [ref=f2e499]:
                                                    - progressbar "68%" [ref=f2e501]
                                                - gridcell "2026-08-28" [ref=f2e506]
                                            - row [ref=f2e507] [cursor=pointer]:
                                                - rowheader [ref=f2e508]:
                                                    - generic [ref=f2e509]:
                                                        - paragraph [ref=f2e510]: Trust review pipeline 3
                                                        - paragraph [ref=f2e511]: REF-003
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f2e512]:
                                                    - generic [ref=f2e513]:
                                                        - generic "Mika Sato" [ref=f2e516]: MS
                                                        - generic [ref=f2e517]:
                                                            - generic [ref=f2e518]: Mika Sato
                                                            - generic [ref=f2e519]: 美洲
                                                - gridcell "已暂停" [ref=f2e520]
                                                - gridcell "美洲" [ref=f2e523]
                                                - gridcell [ref=f2e524]:
                                                    - progressbar "61%" [ref=f2e526]
                                                - gridcell "2026-08-27" [ref=f2e531]
                                            - row [ref=f2e532] [cursor=pointer]:
                                                - rowheader [ref=f2e533]:
                                                    - generic [ref=f2e534]:
                                                        - paragraph [ref=f2e535]: Billing reconciliation 15
                                                        - paragraph [ref=f2e536]: REF-015
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f2e537]:
                                                    - generic [ref=f2e538]:
                                                        - generic "Mika Sato" [ref=f2e541]: MS
                                                        - generic [ref=f2e542]:
                                                            - generic [ref=f2e543]: Mika Sato
                                                            - generic [ref=f2e544]: 美洲
                                                - gridcell "已暂停" [ref=f2e545]
                                                - gridcell "美洲" [ref=f2e548]
                                                - gridcell [ref=f2e549]:
                                                    - progressbar "89%" [ref=f2e551]
                                                - gridcell "2026-08-27" [ref=f2e556]
                                            - row [ref=f2e557] [cursor=pointer]:
                                                - rowheader [ref=f2e558]:
                                                    - generic [ref=f2e559]:
                                                        - paragraph [ref=f2e560]: Trust review pipeline 27
                                                        - paragraph [ref=f2e561]: REF-027
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f2e562]:
                                                    - generic [ref=f2e563]:
                                                        - generic "Mika Sato" [ref=f2e566]: MS
                                                        - generic [ref=f2e567]:
                                                            - generic [ref=f2e568]: Mika Sato
                                                            - generic [ref=f2e569]: 美洲
                                                - gridcell "已暂停" [ref=f2e570]
                                                - gridcell "美洲" [ref=f2e573]
                                                - gridcell [ref=f2e574]:
                                                    - progressbar "53%" [ref=f2e576]
                                                - gridcell "2026-08-27" [ref=f2e581]
                                            - row [ref=f2e582] [cursor=pointer]:
                                                - rowheader [ref=f2e583]:
                                                    - generic [ref=f2e584]:
                                                        - paragraph [ref=f2e585]: Billing reconciliation 39
                                                        - paragraph [ref=f2e586]: REF-039
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f2e587]:
                                                    - generic [ref=f2e588]:
                                                        - generic "Mika Sato" [ref=f2e591]: MS
                                                        - generic [ref=f2e592]:
                                                            - generic [ref=f2e593]: Mika Sato
                                                            - generic [ref=f2e594]: 美洲
                                                - gridcell "已暂停" [ref=f2e595]
                                                - gridcell "美洲" [ref=f2e598]
                                                - gridcell [ref=f2e599]:
                                                    - progressbar "81%" [ref=f2e601]
                                                - gridcell "2026-08-27" [ref=f2e606]
                                            - row [ref=f2e607] [cursor=pointer]:
                                                - rowheader [ref=f2e608]:
                                                    - generic [ref=f2e609]:
                                                        - paragraph [ref=f2e610]: Regional release readiness 4
                                                        - paragraph [ref=f2e611]: REF-004
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f2e612]:
                                                    - generic [ref=f2e613]:
                                                        - generic "Sam Rivera" [ref=f2e616]: SR
                                                        - generic [ref=f2e617]:
                                                            - generic [ref=f2e618]: Sam Rivera
                                                            - generic [ref=f2e619]: 亚太
                                                - gridcell "健康" [ref=f2e620]
                                                - gridcell "亚太" [ref=f2e623]
                                                - gridcell [ref=f2e624]:
                                                    - progressbar "74%" [ref=f2e626]
                                                - gridcell "2026-08-26" [ref=f2e631]
                                            - row [ref=f2e632] [cursor=pointer]:
                                                - rowheader [ref=f2e633]:
                                                    - generic [ref=f2e634]:
                                                        - paragraph [ref=f2e635]: Content lifecycle governance 16
                                                        - paragraph [ref=f2e636]: REF-016
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f2e637]:
                                                    - generic [ref=f2e638]:
                                                        - generic "Sam Rivera" [ref=f2e641]: SR
                                                        - generic [ref=f2e642]:
                                                            - generic [ref=f2e643]: Sam Rivera
                                                            - generic [ref=f2e644]: 亚太
                                                - gridcell "健康" [ref=f2e645]
                                                - gridcell "亚太" [ref=f2e648]
                                                - gridcell [ref=f2e649]:
                                                    - progressbar "38%" [ref=f2e651]
                                                - gridcell "2026-08-26" [ref=f2e656]
                                            - row [ref=f2e657] [cursor=pointer]:
                                                - rowheader [ref=f2e658]:
                                                    - generic [ref=f2e659]:
                                                        - paragraph [ref=f2e660]: Regional release readiness 28
                                                        - paragraph [ref=f2e661]: REF-028
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f2e662]:
                                                    - generic [ref=f2e663]:
                                                        - generic "Sam Rivera" [ref=f2e666]: SR
                                                        - generic [ref=f2e667]:
                                                            - generic [ref=f2e668]: Sam Rivera
                                                            - generic [ref=f2e669]: 亚太
                                                - gridcell "健康" [ref=f2e670]
                                                - gridcell "亚太" [ref=f2e673]
                                                - gridcell [ref=f2e674]:
                                                    - progressbar "66%" [ref=f2e676]
                                                - gridcell "2026-08-26" [ref=f2e681]
                                            - row [ref=f2e682] [cursor=pointer]:
                                                - rowheader [ref=f2e683]:
                                                    - generic [ref=f2e684]:
                                                        - paragraph [ref=f2e685]: Content lifecycle governance 40
                                                        - paragraph [ref=f2e686]: REF-040
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f2e687]:
                                                    - generic [ref=f2e688]:
                                                        - generic "Sam Rivera" [ref=f2e691]: SR
                                                        - generic [ref=f2e692]:
                                                            - generic [ref=f2e693]: Sam Rivera
                                                            - generic [ref=f2e694]: 亚太
                                                - gridcell "健康" [ref=f2e695]
                                                - gridcell "亚太" [ref=f2e698]
                                                - gridcell [ref=f2e699]:
                                                    - progressbar "94%" [ref=f2e701]
                                                - gridcell "2026-08-26" [ref=f2e706]
                                            - row [ref=f2e707] [cursor=pointer]:
                                                - rowheader [ref=f2e708]:
                                                    - generic [ref=f2e709]:
                                                        - paragraph [ref=f2e710]: Creator support operations 5
                                                        - paragraph [ref=f2e711]: REF-005
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f2e712]:
                                                    - generic [ref=f2e713]:
                                                        - generic "Lin Chen" [ref=f2e716]: LC
                                                        - generic [ref=f2e717]:
                                                            - generic [ref=f2e718]: Lin Chen
                                                            - generic [ref=f2e719]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e720]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e723]
                                                - gridcell [ref=f2e724]:
                                                    - progressbar "87%" [ref=f2e726]
                                                - gridcell "2026-08-25" [ref=f2e731]
                                            - row [ref=f2e732] [cursor=pointer]:
                                                - rowheader [ref=f2e733]:
                                                    - generic [ref=f2e734]:
                                                        - paragraph [ref=f2e735]: North Star analytics 17
                                                        - paragraph [ref=f2e736]: REF-017
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f2e737]:
                                                    - generic [ref=f2e738]:
                                                        - generic "Lin Chen" [ref=f2e741]: LC
                                                        - generic [ref=f2e742]:
                                                            - generic [ref=f2e743]: Lin Chen
                                                            - generic [ref=f2e744]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e745]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e748]
                                                - gridcell [ref=f2e749]:
                                                    - progressbar "51%" [ref=f2e751]
                                                - gridcell "2026-08-25" [ref=f2e756]
                                            - row [ref=f2e757] [cursor=pointer]:
                                                - rowheader [ref=f2e758]:
                                                    - generic [ref=f2e759]:
                                                        - paragraph [ref=f2e760]: Creator support operations 29
                                                        - paragraph [ref=f2e761]: REF-029
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f2e762]:
                                                    - generic [ref=f2e763]:
                                                        - generic "Lin Chen" [ref=f2e766]: LC
                                                        - generic [ref=f2e767]:
                                                            - generic [ref=f2e768]: Lin Chen
                                                            - generic [ref=f2e769]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e770]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e773]
                                                - gridcell [ref=f2e774]:
                                                    - progressbar "79%" [ref=f2e776]
                                                - gridcell "2026-08-25" [ref=f2e781]
                                            - row [ref=f2e782] [cursor=pointer]:
                                                - rowheader [ref=f2e783]:
                                                    - generic [ref=f2e784]:
                                                        - paragraph [ref=f2e785]: North Star analytics 41
                                                        - paragraph [ref=f2e786]: REF-041
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f2e787]:
                                                    - generic [ref=f2e788]:
                                                        - generic "Lin Chen" [ref=f2e791]: LC
                                                        - generic [ref=f2e792]:
                                                            - generic [ref=f2e793]: Lin Chen
                                                            - generic [ref=f2e794]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f2e795]
                                                - gridcell "欧洲、中东与非洲" [ref=f2e798]
                                                - gridcell [ref=f2e799]:
                                                    - progressbar "43%" [ref=f2e801]
                                                - gridcell "2026-08-25" [ref=f2e806]
                                    - navigation "Reference 列表分页" [ref=f2e808]:
                                        - list [ref=f2e809]:
                                            - listitem [ref=f2e810]:
                                                - button "上一页" [disabled]:
                                                    - generic: ‹
                                            - listitem [ref=f2e811]:
                                                - button "第 1 页" [ref=f2e812] [cursor=pointer]: '1'
                                            - listitem [ref=f2e813]:
                                                - button "第 2 页" [ref=f2e814] [cursor=pointer]: '2'
                                            - listitem [ref=f2e815]:
                                                - button "第 3 页" [ref=f2e816] [cursor=pointer]: '3'
                                            - listitem [ref=f2e817]:
                                                - button "下一页" [ref=f2e818] [cursor=pointer]:
                                                    - generic [ref=f2e819]: ›
                            - complementary [ref=f2e820]:
                                - generic [ref=f2e821]:
                                    - generic [ref=f2e823]:
                                        - generic [ref=f2e824]:
                                            - paragraph [ref=f2e825]: REF-001
                                            - heading "North Star analytics 1" [level=2] [ref=f2e826]
                                        - generic [ref=f2e827]: 健康
                                    - generic [ref=f2e831]:
                                        - tablist "工作流详情" [ref=f2e832]:
                                            - tab "摘要" [selected] [ref=f2e833] [cursor=pointer]
                                            - tab "活动" [ref=f2e835] [cursor=pointer]
                                            - tab "风险" [ref=f2e837] [cursor=pointer]
                                        - tabpanel "摘要" [ref=f2e839]:
                                            - generic [ref=f2e841]:
                                                - paragraph [ref=f2e842]: 本地参考数据用于验证长内容、状态组合、响应式布局和浏览器交互，不依赖后端。
                                                - generic "工作流详情" [ref=f2e843]:
                                                    - generic [ref=f2e844]:
                                                        - term [ref=f2e845]: 负责人
                                                        - definition [ref=f2e846]:
                                                            - generic [ref=f2e847]:
                                                                - generic "Lin Chen" [ref=f2e850]: LC
                                                                - generic [ref=f2e851]:
                                                                    - generic [ref=f2e852]: Lin Chen
                                                                    - generic [ref=f2e853]: 亚太
                                                    - generic [ref=f2e854]:
                                                        - term [ref=f2e855]: 更新时间
                                                        - definition [ref=f2e856]: 2026年8月29日
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
  13 |   await nav.getByRole('link', { name: /^设置$/ }).click();
  14 |   await page.waitForURL(/\/settings$/);
  15 | }
  16 |
  17 | test('跳转后自动滚顶默认开：长页滚下后导航到设置 → 回到顶部', async ({ page }) => {
  18 |   await resetPreferences(page);
  19 |   await page.goto('/page-archetypes/resource-list');
  20 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  21 |   await page.evaluate(() => window.scrollTo(0, 800));
  22 |   await page.waitForTimeout(300);
  23 |   const before = await page.evaluate(() => window.scrollY);
> 24 |   expect(before).toBeGreaterThan(100);
     |                  ^ Error: expect(received).toBeGreaterThan(expected)
  25 |   await spaToSettings(page);
  26 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  27 |   await page.waitForTimeout(500);
  28 |   const after = await page.evaluate(() => window.scrollY);
  29 |   expect(after).toBeLessThan(50);
  30 | });
  31 |
  32 | test('关闭 跳转后自动滚顶：长页滚下后导航保持滚动位置', async ({ page }) => {
  33 |   await resetPreferences(page);
  34 |   // 设置 → 导航 → 跳转后自动滚顶 = 关。
  35 |   await page.goto('/settings/navigation');
  36 |   await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  37 |   const scrollPref = page.getByRole('switch', { name: '跳转后自动滚动到顶部' });
  38 |   await scrollPref.focus();
  39 |   await page.keyboard.press('Space');
  40 |   await expect(scrollPref).not.toBeChecked();
  41 |   await page.waitForTimeout(300);
  42 |
  43 |   await page.goto('/page-archetypes/resource-list');
  44 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  45 |   await page.evaluate(() => window.scrollTo(0, 800));
  46 |   await page.waitForTimeout(300);
  47 |   await spaToSettings(page);
  48 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  49 |   await page.waitForTimeout(500);
  50 |   const after = await page.evaluate(() => window.scrollY);
  51 |   expect(after).toBeGreaterThan(100);
  52 | });
  53 |
```
