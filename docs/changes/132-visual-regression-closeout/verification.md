# 验证与交付

## 结果与覆盖

131剩余4组视觉检查已收口。本任务不新增功能计数，仍为十二批240项，不代表Cloudreve功能已经全部补齐。

先在ignored候选目录运行5个场景，生成8张候选PNG并通过原有布局、交互与Axe断言，59.1秒通过（`.data/132-candidate-r2.log`）。全部8张实际显示并逐图审阅后才同步到对应原基线，详见[逐图记录](visual-review.md)及本机SHA256记录`.data/132-baseline-review.json`。最初候选调用因临时配置写入目录错误未启动测试，修正后运行；该失败未计为通过。

随后移除候选目录映射，以默认`updateSnapshots:none`和原1%容差重跑authentication、overlays、reference-resources三个完整测试文件：**41例全部通过，3.6分钟**，证据`.data/132-recheck.log`。包括原失败4组，以及320/390/768/1440/2048布局、英文深色/大字/减弱动画、登录返回、错误密码、注册确认、密码可见、会话过期、跨标签退出、浮层禁用/键盘/焦点/滚动、资源页路由/创建/Axe与移动溢出。未放宽阈值、删除检查或以加载图替代完成内容。

该结果仅证明相关41例通过；本轮没有重新执行全站423例或整条`pnpm check`，不得声称全量质量命令已通过。131的完整执行失败仍是历史事实，5例语义修复和本任务4组视觉收口分别有定向证据。测试仍出现既有PressResponder诊断警告，不宣称零警告。

## 工程检查

- 两个变更源码/测试文件的ESLint零警告与Prettier通过，日志`.data/132-lint.log`、`.data/132-format.log`。
- 前端文档结构检查通过（`.data/132-docs.log`）。仓库文档guard与完整diff检查在提交前执行并记录。
- `.next/132-release`生产构建通过，包含TypeScript检查（`.data/132-release-build.log`）。直接针对该产物执行现行性能检查器：initial347176，最大入口/login444607，CSS49067，最大chunk84704字节，均在原预算内（`.data/132-performance.log`）。
- 无Go、API、依赖或migration变更，因此不重复Go测试、契约生成或文件48场景；131相应证据保留，不冒充本轮重跑。

## 运行与数据

重启前分别对普通库0条及主预览120条文件记录做一致备份（`.data/132-delivery-baseline.json`）。最新主预览使用`.next/validated-132`，仍在4181，API8120、management9120保持原服务；不争抢另一项目占用的4180。新的4173开发前端使用独立`.next/development-132`，保留原8080/9090后端和配置。

真实后端模式的4181注册页通过实际浏览器读取并核对新clouddrive说明；公开注册仍关闭，没有因文案调整开放账号注册。主预览重新验证登录、7类已认证文件读接口、两入口页面和CSRF合计11项就绪检查通过，原有文件数量、逐行SHA256及schema12保持。普通开发库只检查就绪，不冒称普通账号登录。证据`.data/132-runtime-receipt.json`。访问地址、账号、密码及Cookie/CSRF/设置Token位置见ignored的`.data/132-preview-guide.txt`与`.data/preview-access.json`。

提交/推送及最终进程状态在交付步骤再次核验；截图基线包含明确Mock示例，不含真实预览凭据。
