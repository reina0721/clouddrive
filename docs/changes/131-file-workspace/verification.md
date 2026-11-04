# 第十二批验证记录

## 范围与结论

F221–F240 全部接线后集中测试。本批文件专项共48个唯一场景通过（不是48个新增功能），新增工作区8个场景覆盖本批20项；前十一批220项不重复计数。当前累计240项仅表示文件专项清单，不表示已达到Cloudreve全部能力或视觉一致性。

本批未修改Go源码、依赖、API或migration；原有150个原生操作及文件schema 12保持。客户端锁屏是隐私遮蔽，不能取代服务端鉴权；真实后端尚无密码单独解锁协议，退出重登为当前恢复路径。

## 功能证据

| 任务 | 覆盖与证据 |
| --- | --- |
| F221–F225 | workspace六页导航场景、discovery分类/搜索3例、navigation3例；单一布局、分类、回收站、固定项、query与原生链接 |
| F226–F227 | workspace折叠记忆与移动抽屉场景；账号偏好/陈旧所有者拒绝单测；桌面和移动截图人工检查 |
| F228–F230 | workspace目标目录创建场景；文本和Markdown真实内容、创建失败保留输入、可恢复目录读取 |
| F231–F232 | workspace多文件和目录上传；等待目录内容发布，再通过实际浏览器下载核对`directory contents`字节 |
| F233–F234 | workspace跨页搜索与快捷键场景；URL编码、输入框/菜单/IME不抢键单测 |
| F235 | workspace注入配额读取失败、未知状态与重试恢复真实配额 |
| F236–F238 | workspace账户菜单、深色/英文及客户端锁屏；shell-security验证遮罩背景inert和既有Mock解锁行为 |
| F239–F240 | workspace共享队列、空状态及完成回执；transfers真实暂停/恢复、503重试、刷新重选SHA与33MiB下载 |

文件专项唯一计数：annotations3、collaboration5、connections1、discovery3、navigation3、explorer4、downloads4、files4、rich-files3、versions9、transfers1、workspace8，共48。CLI的`files.spec.ts`匹配同时包含`rich-files.spec.ts`，未重复计数。

本机ignored证据：`.data/131-isolated-run.log`、`.data/131-isolated-{annotations,collaboration,connections,discovery,navigation}.log`、`.data/131-final-rechecks.log`、`.data/131-transfers-final.log`、`.data/131-workspace-deliverable-final.log`。截图在`frontend/test-results/131/workspace-final/`，包含桌面、移动、英文深色、锁屏、共享队列与完成回执。凭据及测试报告不提交到仓库。

## 工程检查

- Go全量`go test ./...`、`go vet ./...`通过，证据`.data/131-go-test.log`与`.data/131-go-vet.log`。
- 前端653个单元测试通过，其中新增4个Host契约测试。typecheck、lint、架构20个fixture/1040文件、foundation14个fixture及8个Tailwind fixture、依赖30项检查通过；插件生成检查通过。
- 生产构建通过，性能预算未放宽：initial 347176字节，最大入口444606字节（上限445440），CSS 49067字节（上限49152），最大chunk 84704字节。证据`.data/131-release-build-r2.log`与`.data/131-release-performance.log`；末轮空回调清理另有最终构建/性能日志。
- 最终格式、文档与源码检查单独执行；完整`pnpm check`在通用浏览器阶段中止，不能用前序成功代替整条命令通过。

## 通用界面检查的未通过项

完整`pnpm check`的通用UI共运行423例，首次414通过、9失败。已修复并定向复测通过的5例：登录返回片段断言、设置表单就绪等待、设置动画内容等待、锁屏统一inert所有者断言，以及所有路由的h1边界（Mock文件服务不可用页补齐标题）。证据`.data/131-auth-fragment-r2.log`、`.data/131-settings-readiness.log`、`.data/131-shell-regressions.log`。

仍有4组截图检查未通过：320宽登录/注册、英文深色移动注册、Select/Combobox浮层、reference-resources桌面。人工查看差异可见部分旧基线仍使用`Community Console`，而当前品牌已为`clouddrive`（旧PNG提交557757f，品牌变更f244c4e早于本批）；这不证明所有像素差异都无关。本批未修改截图基线、未放宽阈值，完整质量命令仍为失败。另有既有PressResponder诊断警告，未宣称零警告。后续须逐图复核并单独处理，不得把此记录解释为全站质量门禁通过。

用户要求本批提交/推送，因此按明确交付范围保存本批成果并公开上述未通过项；不把文件专项验收扩大成全站验收。

## 本地数据与预览

重启前一致备份记录`.data/131-delivery-baseline.json`：普通库0条、主预览120条。重启后逐行`files_entries ORDER BY id`的SHA256与备份完全相同，schema仍为12；没有清空数据库或重置账号。检查仅覆盖文件记录和schema，不宣称数据库每张表逐字节不变。

主预览4181/8120/9120使用本批生产快照`.next/validated-131-final`；普通开发4173/8080/9090使用独立开发构建目录，均保持运行。交付切换时4180被另一个项目占用，已通过进程路径确认并保留对方进程，复用本任务已通过就绪检查的4181，不争抢端口。主预览登录验证及7类已认证文件读接口通过，两个入口页面及CSRF共4项就绪检查通过。普通库只验证就绪，没有冒称普通库账号登录成功。证据`.data/131-runtime-receipt.json`；账号、密码、Cookie/CSRF与设置Token位置保存在ignored的`.data/131-preview-guide.txt`，不写入本文件。

最后审阅删除一处无效空回调，最终构建`.next/131-release-final`通过。直接针对该目录复用原性能检查器，initial347176、最大入口444606、CSS49067、最大chunk84704字节，预算均通过（`.data/131-release-final-build.log`、`.data/131-release-final-performance.log`）。最终工作区回归首次因测试环境凭据路径错误而未进入功能操作；修正为绝对路径后8例全部通过（43.5秒，`.data/131-workspace-release-final-r2.log`），不能把该轮配置失败算作通过。最后的`pnpm lint`、`pnpm format:check`、`pnpm docs:check`及`scripts/Verify-Docs.ps1`均通过；最初文档检查指出缺少影响清单，补齐`documentation-impact.yaml`后复测通过。

完整Cloudreve差异仍包括账号/群组直接ACL、BT/magnet、多节点、WebDAV锁、Office及其他视觉细节，留待后续批次研究。
