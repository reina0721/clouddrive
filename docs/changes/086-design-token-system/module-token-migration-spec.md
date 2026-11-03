# 086 模块 CSS → 宿主 token 迁移规范（MODULE-086-001）

目标：7 个 `internal/module/*/binding/webui/web/*.module.css` 中，
凡与宿主 primitive/semantic token 等价的数值/颜色必须改为 token 引用；
模块专属的局部布局数值（无 token 等价）保留但必须已在文件内单处声明（不得跨
声明重复同一语义）。**禁止改变任何视觉结果**——只做 等值替换。

## 宿主 token 映射表（唯一权威，值完全一致）

| 待替换字面量 | 替换为 |
| --- | --- |
| `font-size: 12px` | `font-size: var(--font-scale-xs)` |
| `font-size: 13px` | `font-size: var(--font-scale-sm)` |
| `font-size: 14px` | `font-size: var(--font-scale-md)` |
| `font-size: 11px` | `font-size: var(--font-scale-11)` |
| `font-size: 10px` | `font-size: var(--font-scale-10)` |
| `font: 11px/1.6 ui-monospace, monospace` 等 mono 栈 | `font: var(--font-scale-11)/1.6 var(--font-mono)`（保持原 line-height；栈换成 `var(--font-mono)`） |
| `6px` / `8px` 圆角（border-radius 6px→--radius-sm；8px→--radius-md；4px→--radius-4；5px→--radius-5；7px→--radius-7；10px→--radius-lg；12px→--radius-12；999px→--radius-pill） | 对应 `var(--radius-*)` |
| `border: 1px solid ...` | 保持 `1px`（--border-width 为 primitive，但模块 border 宽度不动） |
| 颜色 `#16a34a` | `var(--success)` |
| 颜色 `#d97706` | `var(--warning)` |
| 颜色 `#dc2626` | `var(--danger)` |
| 颜色 `#2563eb` | `var(--primary-strong)` |
| 颜色 `#7c3aed`（violet） | `var(--primary-strong)`（仅当该处确为 violet preset 主色语境） |
| 颜色 `#fff`（在深色渐变/状态底上） | `var(--on-accent)` |
| 颜色 `#60a5fa`/`#22d3ee` 等渐变（信息蓝青） | `color-mix(in srgb, var(--info) 60%, var(--surface))` 与 `color-mix(in srgb, var(--info-strong) 70%, var(--surface))`（等视觉近似） |
| `rgba(0,0,0,.08)` 边框 → 用 `var(--border)`（等价视觉） | `border: 1px solid var(--border)` |
| `rgba(127,127,127,.16)` 轨道 | `color-mix(in srgb, var(--text-muted) 16%, transparent)` |
| `rgba(239,68,68,.05)` 危险行 | `color-mix(in srgb, var(--danger) 5%, transparent)` |
| `font-size: 10px` | `var(--font-scale-10)` |
| z-index（iam.module.css:56 `z-index: 1`） | 若语义为 sticky 表头/rail，改 `z-index: var(--radix-…) `不可行 → 保持 1 并注释“局部定位层级”；见“裁决” |
| 模块不存在的 token 引用（`var(--stroke, rgba(...))`/`var(--surface, #fff)` 回退） | 去掉未知 token 回退，改 `var(--border)` / `var(--surface)`（无回退） |

## 类名 `:global` 裁决

- 模块专属工具类（`.ops-grid`、`.diagnostic-*`、`.tree-view` 等）**保留**在
  `.module.css`（模块拥有自己的布局），但其中的 数值/颜色 必须按上表替换。
- `:global(.ui-button)`、`:global(.code-text-value)`、`:global(.tree-view)`、
  `:global(.api-token-scope-group/.api-token-scope-owner)`、`:global(.revision)`、
  `:global(.status-pill)` 等**覆盖宿主公共类或宿主未定义类**的情况：**只记录不修改**
  （这些需要在主任务里裁决是否收敛到宿主 token），本子代理仅把这类出现的数值按上表替换，
  并在输出中按 `file:line` 列出“覆盖宿主公共类/n 处，待主任务裁决”。

## 重复声明

- 同一文件同一选择器重复定义（ops `.ops-metric-card` 两处）：**合并为一条**
  （保留后者完整声明，删除前一条重复），在前一条位置加注释 `/* 086：合并重复声明 */`。
- 文件内等值重复（同字号/同 mono 栈多次）：全部替换为 token 引用后自然收敛，
  不需要删除。

## 硬性约束

1. 只修改目标 `.module.css`；不修改 styles.css、tsx、Go、测试、文档。
2. 每个替换逐个做，禁止批量正则（避免误伤注释/变量名/含 px 的注释）。注释含数字不动。
3. `min-height/max-height/min-width/max-width/gap/padding/margin/width/height` 中出现的
   非 token 等效值（如 padding: 9px 12px、gap: 2px、max-width: 560px、min-width: 150px
   等无宿主等价档位的）：**除 mono 字体与圆角外一律保留**，不猜 token。
4. 替换后不得出现重复的 `var(--...)` 或语法错误；保持每条规则原有顺序与空白风格
   （尽量保留原行内容，只改值部分）。
5. 完成后对每个文件运行一次幂等检查：把替换行再扫一遍，若还有未替换的等价 token 值
   按 `file:line` 列出（限 20 条）作为剩余清单。