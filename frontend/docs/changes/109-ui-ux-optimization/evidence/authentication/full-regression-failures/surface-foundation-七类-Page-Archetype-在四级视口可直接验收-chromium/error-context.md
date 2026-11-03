# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: surface-foundation.spec.ts >> 七类 Page Archetype 在四级视口可直接验收
- Location: apps\web\e2e\surface-foundation.spec.ts:21:1

# Error details

```
Error: /page-archetypes/resource-list at 1440px

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 163

- Array []
+ Array [
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "contrastRatio": 3.82,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7a8393",
+               "fontSize": "10.5pt (14px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.82 (foreground color: #7a8393, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<section class=\"rounded-panel border shadow-none border-border bg-surface overflow-hidden\">",
+                 "target": Array [
+                   ".surface-split-detail > .shadow-none",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.82 (foreground color: #7a8393, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<p>本地参考数据用于验证长内容、状态组合、响应式布局和浏览器交互，不依赖后端。</p>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".space-y-5 > p",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "contrastRatio": 3.82,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7a8393",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.82 (foreground color: #7a8393, background color: #ffffff, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<section class=\"rounded-panel border shadow-none border-border bg-surface overflow-hidden\">",
+                 "target": Array [
+                   ".surface-split-detail > .shadow-none",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.82 (foreground color: #7a8393, background color: #ffffff, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<dt class=\"text-xs font-semibold uppercase tracking-wider text-ink-muted\">负责人</dt>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".min-w-0:nth-child(1) > dt",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "contrastRatio": 3.82,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7a8393",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.82 (foreground color: #7a8393, background color: #ffffff, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<section class=\"rounded-panel border shadow-none border-border bg-surface overflow-hidden\">",
+                 "target": Array [
+                   ".surface-split-detail > .shadow-none",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.82 (foreground color: #7a8393, background color: #ffffff, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span class=\"mt-0.5 block truncate text-xs text-ink-muted\">亚太</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "dd > .gap-3.inline-flex.items-center > .min-w-0 > .mt-0\\.5.block.truncate",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "contrastRatio": 3.82,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#7a8393",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.82 (foreground color: #7a8393, background color: #ffffff, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<section class=\"rounded-panel border shadow-none border-border bg-surface overflow-hidden\">",
+                 "target": Array [
+                   ".surface-split-detail > .shadow-none",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.82 (foreground color: #7a8393, background color: #ffffff, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<dt class=\"text-xs font-semibold uppercase tracking-wider text-ink-muted\">更新时间</dt>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".min-w-0:nth-child(2) > dt",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
    - button "Open Next.js Dev Tools" [ref=f1e7] [cursor=pointer]
    - alert [ref=f1e11]
    - link "跳到主要内容 / Skip to content" [ref=f1e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=f1e13]:
        - complementary [ref=f1e14]:
            - generic [ref=f1e15]:
                - generic [ref=f1e16]: C
                - generic [ref=f1e18]:
                    - paragraph [ref=f1e19]: Community
                    - paragraph [ref=f1e20]: 统一前端基座
            - navigation "主导航" [ref=f1e21]:
                - generic [ref=f1e22]:
                    - paragraph [ref=f1e23]: Universal Foundation
                    - list [ref=f1e24]:
                        - listitem [ref=f1e25]:
                            - link "总览" [ref=f1e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=f1e33]:
                    - paragraph [ref=f1e34]: 系统
                    - list [ref=f1e35]:
                        - listitem [ref=f1e36]:
                            - link "设置" [ref=f1e37] [cursor=pointer]:
                                - /url: /settings
                        - listitem [ref=f1e42]:
                            - link "Icon 大全" [ref=f1e43] [cursor=pointer]:
                                - /url: /system-tools/icons
                - generic [ref=f1e48]:
                    - paragraph [ref=f1e49]: 参考资源
                    - list [ref=f1e50]:
                        - listitem [ref=f1e51]:
                            - link "参考资源" [ref=f1e52] [cursor=pointer]:
                                - /url: /reference-resources
                - generic [ref=f1e56]:
                    - paragraph [ref=f1e57]: 开发
                    - list [ref=f1e58]:
                        - listitem [ref=f1e59]:
                            - link "基座能力" [ref=f1e60] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f1e72]:
                            - link "Motion" [ref=f1e73] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f1e77]:
                            - button "展开或收起Page Archetypes" [expanded] [ref=f1e78]:
                                - generic [ref=f1e81]: Page Archetypes
                            - list [ref=f1e84]:
                                - listitem [ref=f1e85]:
                                    - link "总览原型" [ref=f1e86] [cursor=pointer]:
                                        - /url: /page-archetypes/overview
                                - listitem [ref=f1e90]:
                                    - link "数据工作台" [ref=f1e91] [cursor=pointer]:
                                        - /url: /page-archetypes/resource-list
                                - listitem [ref=f1e95]:
                                    - link "详情页" [ref=f1e96] [cursor=pointer]:
                                        - /url: /page-archetypes/detail
                                - listitem [ref=f1e100]:
                                    - link "创建与编辑" [ref=f1e101] [cursor=pointer]:
                                        - /url: /page-archetypes/create-edit
                                - listitem [ref=f1e105]:
                                    - link "设置页" [ref=f1e106] [cursor=pointer]:
                                        - /url: /page-archetypes/settings
                                - listitem [ref=f1e110]:
                                    - link "主从视图" [ref=f1e111] [cursor=pointer]:
                                        - /url: /page-archetypes/master-detail
                                - listitem [ref=f1e115]:
                                    - link "操作任务" [ref=f1e116] [cursor=pointer]:
                                        - /url: /page-archetypes/operation
                        - listitem [ref=f1e120]:
                            - button "展开或收起Page Patterns" [ref=f1e121]:
                                - generic [ref=f1e127]: Page Patterns
                        - listitem [ref=f1e130]:
                            - link "状态体系" [ref=f1e131] [cursor=pointer]:
                                - /url: /states
                        - listitem [ref=f1e137]:
                            - button "展开或收起UI Elements" [ref=f1e138]:
                                - generic [ref=f1e144]: UI Elements
            - generic [ref=f1e147]:
                - generic [ref=f1e148]: Architecture Preview
                - paragraph [ref=f1e153]: React 19 · HeroUI · Tailwind CSS v4
        - generic [ref=f1e154]:
            - banner [ref=f1e156]:
                - button "收起侧栏" [ref=f1e158] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f1e160] [cursor=pointer]
                - generic [ref=f1e161]:
                    - generic [ref=f1e162]:
                        - button "切换语言" [ref=f1e163] [cursor=pointer]
                        - button "切换主题" [ref=f1e164] [cursor=pointer]
                    - button "通知" [ref=f1e165]
                    - button "当前用户" [ref=f1e169] [cursor=pointer]:
                        - generic [ref=f1e171]:
                            - generic "Rin" [ref=f1e174]: RI
                            - generic [ref=f1e175]: Rin
            - main [ref=f1e179]:
                - generic [ref=f1e181]:
                    - generic [ref=f1e182]:
                        - list "面包屑导航" [ref=f1e183]:
                            - listitem [ref=f1e184]:
                                - link "基座验证" [ref=f1e185] [cursor=pointer]
                                - generic [ref=f1e186]: /
                            - listitem [ref=f1e187]:
                                - link "数据工作台" [disabled]
                        - generic [ref=f1e188]:
                            - generic [ref=f1e189]:
                                - paragraph [ref=f1e190]: Reference · Workspace
                                - heading "高密度数据工作台" [level=1] [ref=f1e191]
                                - paragraph [ref=f1e192]: 使用 48 条本地基准数据验证 Dashboard、筛选、Table、Master-Detail、Tabs、Drawer、Dialog 与非正常状态的协作边界。
                            - generic [ref=f1e193]:
                                - button "打开活动侧栏" [ref=f1e194] [cursor=pointer]
                                - button "打开确认对话框" [ref=f1e195] [cursor=pointer]
                    - generic [ref=f1e196]:
                        - generic [ref=f1e197]:
                            - paragraph [ref=f1e198]: 总工作流
                            - paragraph [ref=f1e199]: '48'
                        - generic [ref=f1e200]:
                            - paragraph [ref=f1e201]: 需关注
                            - paragraph [ref=f1e202]: '16'
                        - generic [ref=f1e203]:
                            - paragraph [ref=f1e204]: 高风险
                            - paragraph [ref=f1e205]: '16'
                        - generic [ref=f1e206]:
                            - paragraph [ref=f1e207]: 筛选结果
                            - paragraph [ref=f1e208]: '48'
                    - toolbar "页面工具栏" [ref=f1e209]:
                        - generic [ref=f1e212]:
                            - group [ref=f1e214]:
                                - searchbox "搜索 Reference 数据" [ref=f1e215]
                                - button "Close"
                            - button "搜索" [ref=f1e216] [cursor=pointer]
                        - button "导出快照" [ref=f1e219] [cursor=pointer]
                    - generic [ref=f1e222]:
                        - generic [ref=f1e223]:
                            - generic [ref=f1e224]: 状态
                            - button "全部 状态" [ref=f1e225] [cursor=pointer]:
                                - generic [ref=f1e226]: 全部
                            - combobox [ref=f1e233]
                        - generic [ref=f1e234]:
                            - generic [ref=f1e235]: 区域
                            - button "全部 区域" [ref=f1e236] [cursor=pointer]:
                                - generic [ref=f1e237]: 全部
                            - combobox [ref=f1e244]
                        - generic [ref=f1e245]:
                            - generic [ref=f1e246]: 表格密度
                            - button "舒适 表格密度" [ref=f1e247] [cursor=pointer]:
                                - generic [ref=f1e248]: 舒适
                            - combobox [ref=f1e255]
                        - generic [ref=f1e256]:
                            - generic [ref=f1e257]: 场景状态
                            - button "正常 场景状态" [ref=f1e258] [cursor=pointer]:
                                - generic [ref=f1e259]: 正常
                            - combobox [ref=f1e266]
                    - region "Reference 工作流数据表" [ref=f1e267]:
                        - generic [ref=f1e269]:
                            - generic [ref=f1e271]:
                                - generic [ref=f1e272]:
                                    - generic [ref=f1e273]:
                                        - heading "工作流列表" [level=2] [ref=f1e274]
                                        - paragraph [ref=f1e275]: 当前展示 48 条记录；数据量用于验证滚动、密度与溢出。
                                    - button "列设置" [ref=f1e278]
                                - generic [ref=f1e279]:
                                    - grid "Reference 工作流数据表" [ref=f1e283]:
                                        - rowgroup [ref=f1e284]:
                                            - row [ref=f1e285]:
                                                - columnheader [ref=f1e286] [cursor=pointer]:
                                                    - generic [ref=f1e287]: 工作流
                                                    - slider "尺寸调整器 工作流" [ref=f1e288]: '119'
                                                - columnheader [ref=f1e289] [cursor=pointer]:
                                                    - generic [ref=f1e290]: 负责人
                                                    - slider "尺寸调整器 负责人" [ref=f1e291]: '119'
                                                - columnheader [ref=f1e292] [cursor=pointer]:
                                                    - generic [ref=f1e293]: 状态
                                                    - slider "尺寸调整器 状态" [ref=f1e294]: '120'
                                                - columnheader [ref=f1e295] [cursor=pointer]:
                                                    - generic [ref=f1e296]: 区域
                                                    - slider "尺寸调整器 区域" [ref=f1e297]: '119'
                                                - columnheader [ref=f1e298] [cursor=pointer]:
                                                    - generic [ref=f1e299]: 完成度
                                                    - slider "尺寸调整器 完成度" [ref=f1e300]: '119'
                                                - columnheader [ref=f1e301] [cursor=pointer]:
                                                    - generic [ref=f1e302]: 更新时间
                                                    - slider "尺寸调整器 更新时间" [ref=f1e305]: '119'
                                        - rowgroup [ref=f1e306]:
                                            - row [ref=f1e307] [cursor=pointer]:
                                                - rowheader [ref=f1e308]:
                                                    - generic [ref=f1e309]:
                                                        - paragraph [ref=f1e310]: North Star analytics 1
                                                        - paragraph [ref=f1e311]: REF-001
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f1e312]:
                                                    - generic [ref=f1e313]:
                                                        - generic "Lin Chen" [ref=f1e316]: LC
                                                        - generic [ref=f1e317]:
                                                            - generic [ref=f1e318]: Lin Chen
                                                            - generic [ref=f1e319]: 亚太
                                                - gridcell "健康" [ref=f1e320]
                                                - gridcell "亚太" [ref=f1e323]
                                                - gridcell [ref=f1e324]:
                                                    - progressbar "35%" [ref=f1e326]
                                                - gridcell "2026-08-29" [ref=f1e331]
                                            - row [ref=f1e332] [cursor=pointer]:
                                                - rowheader [ref=f1e333]:
                                                    - generic [ref=f1e334]:
                                                        - paragraph [ref=f1e335]: Creator support operations 13
                                                        - paragraph [ref=f1e336]: REF-013
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f1e337]:
                                                    - generic [ref=f1e338]:
                                                        - generic "Lin Chen" [ref=f1e341]: LC
                                                        - generic [ref=f1e342]:
                                                            - generic [ref=f1e343]: Lin Chen
                                                            - generic [ref=f1e344]: 亚太
                                                - gridcell "健康" [ref=f1e345]
                                                - gridcell "亚太" [ref=f1e348]
                                                - gridcell [ref=f1e349]:
                                                    - progressbar "63%" [ref=f1e351]
                                                - gridcell "2026-08-29" [ref=f1e356]
                                            - row [ref=f1e357] [cursor=pointer]:
                                                - rowheader [ref=f1e358]:
                                                    - generic [ref=f1e359]:
                                                        - paragraph [ref=f1e360]: North Star analytics 25
                                                        - paragraph [ref=f1e361]: REF-025
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f1e362]:
                                                    - generic [ref=f1e363]:
                                                        - generic "Lin Chen" [ref=f1e366]: LC
                                                        - generic [ref=f1e367]:
                                                            - generic [ref=f1e368]: Lin Chen
                                                            - generic [ref=f1e369]: 亚太
                                                - gridcell "健康" [ref=f1e370]
                                                - gridcell "亚太" [ref=f1e373]
                                                - gridcell [ref=f1e374]:
                                                    - progressbar "91%" [ref=f1e376]
                                                - gridcell "2026-08-29" [ref=f1e381]
                                            - row [ref=f1e382] [cursor=pointer]:
                                                - rowheader [ref=f1e383]:
                                                    - generic [ref=f1e384]:
                                                        - paragraph [ref=f1e385]: Creator support operations 37
                                                        - paragraph [ref=f1e386]: REF-037
                                                - gridcell "Lin Chen Lin Chen 亚太" [ref=f1e387]:
                                                    - generic [ref=f1e388]:
                                                        - generic "Lin Chen" [ref=f1e391]: LC
                                                        - generic [ref=f1e392]:
                                                            - generic [ref=f1e393]: Lin Chen
                                                            - generic [ref=f1e394]: 亚太
                                                - gridcell "健康" [ref=f1e395]
                                                - gridcell "亚太" [ref=f1e398]
                                                - gridcell [ref=f1e399]:
                                                    - progressbar "55%" [ref=f1e401]
                                                - gridcell "2026-08-29" [ref=f1e406]
                                            - row [ref=f1e407] [cursor=pointer]:
                                                - rowheader [ref=f1e408]:
                                                    - generic [ref=f1e409]:
                                                        - paragraph [ref=f1e410]: Partner onboarding 2
                                                        - paragraph [ref=f1e411]: REF-002
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f1e412]:
                                                    - generic [ref=f1e413]:
                                                        - generic "Avery Morgan" [ref=f1e416]: AM
                                                        - generic [ref=f1e417]:
                                                            - generic [ref=f1e418]: Avery Morgan
                                                            - generic [ref=f1e419]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f1e420]
                                                - gridcell "欧洲、中东与非洲" [ref=f1e423]
                                                - gridcell [ref=f1e424]:
                                                    - progressbar "48%" [ref=f1e426]
                                                - gridcell "2026-08-28" [ref=f1e431]
                                            - row [ref=f1e432] [cursor=pointer]:
                                                - rowheader [ref=f1e433]:
                                                    - generic [ref=f1e434]:
                                                        - paragraph [ref=f1e435]: Moderation quality signals 14
                                                        - paragraph [ref=f1e436]: REF-014
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f1e437]:
                                                    - generic [ref=f1e438]:
                                                        - generic "Avery Morgan" [ref=f1e441]: AM
                                                        - generic [ref=f1e442]:
                                                            - generic [ref=f1e443]: Avery Morgan
                                                            - generic [ref=f1e444]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f1e445]
                                                - gridcell "欧洲、中东与非洲" [ref=f1e448]
                                                - gridcell [ref=f1e449]:
                                                    - progressbar "76%" [ref=f1e451]
                                                - gridcell "2026-08-28" [ref=f1e456]
                                            - row [ref=f1e457] [cursor=pointer]:
                                                - rowheader [ref=f1e458]:
                                                    - generic [ref=f1e459]:
                                                        - paragraph [ref=f1e460]: Partner onboarding 26
                                                        - paragraph [ref=f1e461]: REF-026
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f1e462]:
                                                    - generic [ref=f1e463]:
                                                        - generic "Avery Morgan" [ref=f1e466]: AM
                                                        - generic [ref=f1e467]:
                                                            - generic [ref=f1e468]: Avery Morgan
                                                            - generic [ref=f1e469]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f1e470]
                                                - gridcell "欧洲、中东与非洲" [ref=f1e473]
                                                - gridcell [ref=f1e474]:
                                                    - progressbar "40%" [ref=f1e476]
                                                - gridcell "2026-08-28" [ref=f1e481]
                                            - row [ref=f1e482] [cursor=pointer]:
                                                - rowheader [ref=f1e483]:
                                                    - generic [ref=f1e484]:
                                                        - paragraph [ref=f1e485]: Moderation quality signals 38
                                                        - paragraph [ref=f1e486]: REF-038
                                                - gridcell "Avery Morgan Avery Morgan 欧洲、中东与非洲" [ref=f1e487]:
                                                    - generic [ref=f1e488]:
                                                        - generic "Avery Morgan" [ref=f1e491]: AM
                                                        - generic [ref=f1e492]:
                                                            - generic [ref=f1e493]: Avery Morgan
                                                            - generic [ref=f1e494]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f1e495]
                                                - gridcell "欧洲、中东与非洲" [ref=f1e498]
                                                - gridcell [ref=f1e499]:
                                                    - progressbar "68%" [ref=f1e501]
                                                - gridcell "2026-08-28" [ref=f1e506]
                                            - row [ref=f1e507] [cursor=pointer]:
                                                - rowheader [ref=f1e508]:
                                                    - generic [ref=f1e509]:
                                                        - paragraph [ref=f1e510]: Trust review pipeline 3
                                                        - paragraph [ref=f1e511]: REF-003
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f1e512]:
                                                    - generic [ref=f1e513]:
                                                        - generic "Mika Sato" [ref=f1e516]: MS
                                                        - generic [ref=f1e517]:
                                                            - generic [ref=f1e518]: Mika Sato
                                                            - generic [ref=f1e519]: 美洲
                                                - gridcell "已暂停" [ref=f1e520]
                                                - gridcell "美洲" [ref=f1e523]
                                                - gridcell [ref=f1e524]:
                                                    - progressbar "61%" [ref=f1e526]
                                                - gridcell "2026-08-27" [ref=f1e531]
                                            - row [ref=f1e532] [cursor=pointer]:
                                                - rowheader [ref=f1e533]:
                                                    - generic [ref=f1e534]:
                                                        - paragraph [ref=f1e535]: Billing reconciliation 15
                                                        - paragraph [ref=f1e536]: REF-015
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f1e537]:
                                                    - generic [ref=f1e538]:
                                                        - generic "Mika Sato" [ref=f1e541]: MS
                                                        - generic [ref=f1e542]:
                                                            - generic [ref=f1e543]: Mika Sato
                                                            - generic [ref=f1e544]: 美洲
                                                - gridcell "已暂停" [ref=f1e545]
                                                - gridcell "美洲" [ref=f1e548]
                                                - gridcell [ref=f1e549]:
                                                    - progressbar "89%" [ref=f1e551]
                                                - gridcell "2026-08-27" [ref=f1e556]
                                            - row [ref=f1e557] [cursor=pointer]:
                                                - rowheader [ref=f1e558]:
                                                    - generic [ref=f1e559]:
                                                        - paragraph [ref=f1e560]: Trust review pipeline 27
                                                        - paragraph [ref=f1e561]: REF-027
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f1e562]:
                                                    - generic [ref=f1e563]:
                                                        - generic "Mika Sato" [ref=f1e566]: MS
                                                        - generic [ref=f1e567]:
                                                            - generic [ref=f1e568]: Mika Sato
                                                            - generic [ref=f1e569]: 美洲
                                                - gridcell "已暂停" [ref=f1e570]
                                                - gridcell "美洲" [ref=f1e573]
                                                - gridcell [ref=f1e574]:
                                                    - progressbar "53%" [ref=f1e576]
                                                - gridcell "2026-08-27" [ref=f1e581]
                                            - row [ref=f1e582] [cursor=pointer]:
                                                - rowheader [ref=f1e583]:
                                                    - generic [ref=f1e584]:
                                                        - paragraph [ref=f1e585]: Billing reconciliation 39
                                                        - paragraph [ref=f1e586]: REF-039
                                                - gridcell "Mika Sato Mika Sato 美洲" [ref=f1e587]:
                                                    - generic [ref=f1e588]:
                                                        - generic "Mika Sato" [ref=f1e591]: MS
                                                        - generic [ref=f1e592]:
                                                            - generic [ref=f1e593]: Mika Sato
                                                            - generic [ref=f1e594]: 美洲
                                                - gridcell "已暂停" [ref=f1e595]
                                                - gridcell "美洲" [ref=f1e598]
                                                - gridcell [ref=f1e599]:
                                                    - progressbar "81%" [ref=f1e601]
                                                - gridcell "2026-08-27" [ref=f1e606]
                                            - row [ref=f1e607] [cursor=pointer]:
                                                - rowheader [ref=f1e608]:
                                                    - generic [ref=f1e609]:
                                                        - paragraph [ref=f1e610]: Regional release readiness 4
                                                        - paragraph [ref=f1e611]: REF-004
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f1e612]:
                                                    - generic [ref=f1e613]:
                                                        - generic "Sam Rivera" [ref=f1e616]: SR
                                                        - generic [ref=f1e617]:
                                                            - generic [ref=f1e618]: Sam Rivera
                                                            - generic [ref=f1e619]: 亚太
                                                - gridcell "健康" [ref=f1e620]
                                                - gridcell "亚太" [ref=f1e623]
                                                - gridcell [ref=f1e624]:
                                                    - progressbar "74%" [ref=f1e626]
                                                - gridcell "2026-08-26" [ref=f1e631]
                                            - row [ref=f1e632] [cursor=pointer]:
                                                - rowheader [ref=f1e633]:
                                                    - generic [ref=f1e634]:
                                                        - paragraph [ref=f1e635]: Content lifecycle governance 16
                                                        - paragraph [ref=f1e636]: REF-016
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f1e637]:
                                                    - generic [ref=f1e638]:
                                                        - generic "Sam Rivera" [ref=f1e641]: SR
                                                        - generic [ref=f1e642]:
                                                            - generic [ref=f1e643]: Sam Rivera
                                                            - generic [ref=f1e644]: 亚太
                                                - gridcell "健康" [ref=f1e645]
                                                - gridcell "亚太" [ref=f1e648]
                                                - gridcell [ref=f1e649]:
                                                    - progressbar "38%" [ref=f1e651]
                                                - gridcell "2026-08-26" [ref=f1e656]
                                            - row [ref=f1e657] [cursor=pointer]:
                                                - rowheader [ref=f1e658]:
                                                    - generic [ref=f1e659]:
                                                        - paragraph [ref=f1e660]: Regional release readiness 28
                                                        - paragraph [ref=f1e661]: REF-028
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f1e662]:
                                                    - generic [ref=f1e663]:
                                                        - generic "Sam Rivera" [ref=f1e666]: SR
                                                        - generic [ref=f1e667]:
                                                            - generic [ref=f1e668]: Sam Rivera
                                                            - generic [ref=f1e669]: 亚太
                                                - gridcell "健康" [ref=f1e670]
                                                - gridcell "亚太" [ref=f1e673]
                                                - gridcell [ref=f1e674]:
                                                    - progressbar "66%" [ref=f1e676]
                                                - gridcell "2026-08-26" [ref=f1e681]
                                            - row [ref=f1e682] [cursor=pointer]:
                                                - rowheader [ref=f1e683]:
                                                    - generic [ref=f1e684]:
                                                        - paragraph [ref=f1e685]: Content lifecycle governance 40
                                                        - paragraph [ref=f1e686]: REF-040
                                                - gridcell "Sam Rivera Sam Rivera 亚太" [ref=f1e687]:
                                                    - generic [ref=f1e688]:
                                                        - generic "Sam Rivera" [ref=f1e691]: SR
                                                        - generic [ref=f1e692]:
                                                            - generic [ref=f1e693]: Sam Rivera
                                                            - generic [ref=f1e694]: 亚太
                                                - gridcell "健康" [ref=f1e695]
                                                - gridcell "亚太" [ref=f1e698]
                                                - gridcell [ref=f1e699]:
                                                    - progressbar "94%" [ref=f1e701]
                                                - gridcell "2026-08-26" [ref=f1e706]
                                            - row [ref=f1e707] [cursor=pointer]:
                                                - rowheader [ref=f1e708]:
                                                    - generic [ref=f1e709]:
                                                        - paragraph [ref=f1e710]: Creator support operations 5
                                                        - paragraph [ref=f1e711]: REF-005
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f1e712]:
                                                    - generic [ref=f1e713]:
                                                        - generic "Lin Chen" [ref=f1e716]: LC
                                                        - generic [ref=f1e717]:
                                                            - generic [ref=f1e718]: Lin Chen
                                                            - generic [ref=f1e719]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f1e720]
                                                - gridcell "欧洲、中东与非洲" [ref=f1e723]
                                                - gridcell [ref=f1e724]:
                                                    - progressbar "87%" [ref=f1e726]
                                                - gridcell "2026-08-25" [ref=f1e731]
                                            - row [ref=f1e732] [cursor=pointer]:
                                                - rowheader [ref=f1e733]:
                                                    - generic [ref=f1e734]:
                                                        - paragraph [ref=f1e735]: North Star analytics 17
                                                        - paragraph [ref=f1e736]: REF-017
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f1e737]:
                                                    - generic [ref=f1e738]:
                                                        - generic "Lin Chen" [ref=f1e741]: LC
                                                        - generic [ref=f1e742]:
                                                            - generic [ref=f1e743]: Lin Chen
                                                            - generic [ref=f1e744]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f1e745]
                                                - gridcell "欧洲、中东与非洲" [ref=f1e748]
                                                - gridcell [ref=f1e749]:
                                                    - progressbar "51%" [ref=f1e751]
                                                - gridcell "2026-08-25" [ref=f1e756]
                                            - row [ref=f1e757] [cursor=pointer]:
                                                - rowheader [ref=f1e758]:
                                                    - generic [ref=f1e759]:
                                                        - paragraph [ref=f1e760]: Creator support operations 29
                                                        - paragraph [ref=f1e761]: REF-029
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f1e762]:
                                                    - generic [ref=f1e763]:
                                                        - generic "Lin Chen" [ref=f1e766]: LC
                                                        - generic [ref=f1e767]:
                                                            - generic [ref=f1e768]: Lin Chen
                                                            - generic [ref=f1e769]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f1e770]
                                                - gridcell "欧洲、中东与非洲" [ref=f1e773]
                                                - gridcell [ref=f1e774]:
                                                    - progressbar "79%" [ref=f1e776]
                                                - gridcell "2026-08-25" [ref=f1e781]
                                            - row [ref=f1e782] [cursor=pointer]:
                                                - rowheader [ref=f1e783]:
                                                    - generic [ref=f1e784]:
                                                        - paragraph [ref=f1e785]: North Star analytics 41
                                                        - paragraph [ref=f1e786]: REF-041
                                                - gridcell "Lin Chen Lin Chen 欧洲、中东与非洲" [ref=f1e787]:
                                                    - generic [ref=f1e788]:
                                                        - generic "Lin Chen" [ref=f1e791]: LC
                                                        - generic [ref=f1e792]:
                                                            - generic [ref=f1e793]: Lin Chen
                                                            - generic [ref=f1e794]: 欧洲、中东与非洲
                                                - gridcell "需关注" [ref=f1e795]
                                                - gridcell "欧洲、中东与非洲" [ref=f1e798]
                                                - gridcell [ref=f1e799]:
                                                    - progressbar "43%" [ref=f1e801]
                                                - gridcell "2026-08-25" [ref=f1e806]
                                    - navigation "Reference 列表分页" [ref=f1e808]:
                                        - list [ref=f1e809]:
                                            - listitem [ref=f1e810]:
                                                - button "上一页" [disabled]:
                                                    - generic: ‹
                                            - listitem [ref=f1e811]:
                                                - button "第 1 页" [ref=f1e812] [cursor=pointer]: '1'
                                            - listitem [ref=f1e813]:
                                                - button "第 2 页" [ref=f1e814] [cursor=pointer]: '2'
                                            - listitem [ref=f1e815]:
                                                - button "第 3 页" [ref=f1e816] [cursor=pointer]: '3'
                                            - listitem [ref=f1e817]:
                                                - button "下一页" [ref=f1e818] [cursor=pointer]:
                                                    - generic [ref=f1e819]: ›
                            - complementary [ref=f1e820]:
                                - generic [ref=f1e821]:
                                    - generic [ref=f1e823]:
                                        - generic [ref=f1e824]:
                                            - paragraph [ref=f1e825]: REF-001
                                            - heading "North Star analytics 1" [level=2] [ref=f1e826]
                                        - generic [ref=f1e827]: 健康
                                    - generic [ref=f1e831]:
                                        - tablist "工作流详情" [ref=f1e832]:
                                            - tab "摘要" [selected] [ref=f1e833] [cursor=pointer]
                                            - tab "活动" [ref=f1e835] [cursor=pointer]
                                            - tab "风险" [ref=f1e837] [cursor=pointer]
                                        - tabpanel "摘要" [ref=f1e839]:
                                            - generic [ref=f1e841]:
                                                - paragraph [ref=f1e842]: 本地参考数据用于验证长内容、状态组合、响应式布局和浏览器交互，不依赖后端。
                                                - generic "工作流详情" [ref=f1e843]:
                                                    - generic [ref=f1e844]:
                                                        - term [ref=f1e845]: 负责人
                                                        - definition [ref=f1e846]:
                                                            - generic [ref=f1e847]:
                                                                - generic "Lin Chen" [ref=f1e850]: LC
                                                                - generic [ref=f1e851]:
                                                                    - generic [ref=f1e852]: Lin Chen
                                                                    - generic [ref=f1e853]: 亚太
                                                    - generic [ref=f1e854]:
                                                        - term [ref=f1e855]: 更新时间
                                                        - definition [ref=f1e856]: 2026年8月29日
```

# Test source

```ts
  1  | import AxeBuilder from '@axe-core/playwright';
  2  | import { expect, test } from '@playwright/test';
  3  |
  4  | const archetypes = [
  5  |   '/page-archetypes/overview',
  6  |   '/page-archetypes/resource-list',
  7  |   '/page-archetypes/detail',
  8  |   '/page-archetypes/create-edit',
  9  |   '/page-archetypes/settings',
  10 |   '/page-archetypes/master-detail',
  11 |   '/page-archetypes/operation',
  12 | ] as const;
  13 |
  14 | const viewports = [
  15 |   { width: 1440, height: 900 },
  16 |   { width: 1920, height: 1080 },
  17 |   { width: 768, height: 1024 },
  18 |   { width: 390, height: 844 },
  19 | ] as const;
  20 |
  21 | test('七类 Page Archetype 在四级视口可直接验收', async ({ page }) => {
  22 |   test.setTimeout(120_000);
  23 |   for (const viewport of viewports) {
  24 |     await page.setViewportSize(viewport);
  25 |     for (const route of archetypes) {
  26 |       await page.goto(route);
  27 |       await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  28 |       await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  29 |       const overflow = await page.evaluate(
  30 |         () => document.documentElement.scrollWidth - window.innerWidth,
  31 |       );
  32 |       expect(overflow, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(0);
  33 |
  34 |       if (viewport.width === 1440 || viewport.width === 390) {
  35 |         const accessibility = await new AxeBuilder({ page })
  36 |           .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  37 |           .analyze();
> 38 |         expect(accessibility.violations, `${route} at ${viewport.width}px`).toEqual([]);
     |                                                                             ^ Error: /page-archetypes/resource-list at 1440px
  39 |       }
  40 |     }
  41 |   }
  42 | });
  43 |
  44 | test('Universal 与 Surface authority 视觉面保持分层', async ({ page }) => {
  45 |   await page.setViewportSize({ width: 1440, height: 900 });
  46 |   await page.goto('/motion');
  47 |   await expect.soft(page).toHaveScreenshot('universal-motion-desktop.png', { fullPage: true });
  48 |
  49 |   await page.goto('/page-patterns/collections-data');
  50 |   await expect.soft(page).toHaveScreenshot('page-patterns-collections-desktop.png', {
  51 |     fullPage: true,
  52 |   });
  53 |
  54 |   await page.goto('/page-archetypes/overview');
  55 |   await expect.soft(page).toHaveScreenshot('page-archetypes-overview-desktop.png', {
  56 |     fullPage: true,
  57 |   });
  58 | });
  59 |
```
