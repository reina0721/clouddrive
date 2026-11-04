# 安全基线定向复核

安全工具链全量复验另触发已有配置监听测试失败：正常取消时，ctx.Done与watchDone可同时就绪，旧Coordinator.Watch随机选中watchDone后把nil误记为异常退出；10次定向复测通过不推翻源码中的竞态。范围仅修正该结束判定：只有ctx尚未取消且底层无错误才报告意外停止，真实关闭错误继续返回；增加实际ready后反复取消的回归。S02纳入本次运行验证，不扩大到配置架构重构。

集中功能验证通过后运行govulncheck1.9.0，`.data/123-vulnerability.log`实际报告17个符号可达漏洞：Go标准库HTTP、TLS、textproto、模板和证书，以及Excelize的CFB分配、解密panic、公式递归和行号资源耗尽。部分通用接口的静态路径可能过度近似，不能把所有路径等同于真实攻击已复现；但当前Storage确实调用OpenReader/GetRows，HTTP确实使用net/http，不能忽略官方安全基线。

官方Go发行JSON提供1.26.10及Windows zip checksum；GO-2026-6809明确修复于1.26.10。选择同一1.26维护分支补丁，避免无用语言版本升级。Docker Registry library/golang的1.26.10-bookworm manifest实际返回sha256:23ce71337b726608afb1bc00986e630a05034a87a87ea1fc2cd1ae5cf33387eb。旧Go1.26.6不能继续作为当前推荐构建。

Excelize官方2.11.1于2026-11-02发布，模块代理确认commit c4331ec2d7aab0546515906032d54b81952bbfa0；Go要求1.26.0，MIT许可和当前工作簿接口可继续沿用。相比固定四个不同预发布补丁，选择包含这些修复的正式维护版本，API接入仍由现有Storage窄契约拥有，不扩展工作簿产品功能。依赖要求x/crypto0.58、x/net0.62、x/text0.43与本批基线一致，x/image0.44及efp修复版本随官方go.mod同步。没有新增资源所有者或客户端。

计划增加S01：更新go.mod/sum、三个版本检查脚本与独立预览默认工具路径、tool-versions、Docker digest和当前构建文档，旧历史研究快照不改写。安装独立1.26.10目录，不修改全局Go或删除旧工具文件；统一构建最新两套服务后保持运行。govulncheck工具版本固定到本次实际使用的1.9.0。完成条件为全Go测试/vet、当前符号扫描和已有浏览器回归；外部Docker构建若环境不可用必须明确未执行。

此事实推翻旧工具链安全前提，已退回本次定向研究并更新计划；用户goal自主执行授权下继续修复，不额外等待确认，不把安全维护计入20项产品功能。研究门禁通过。官方证据：[Go报告](https://pkg.go.dev/vuln/GO-2026-6809)、[Go发行](https://go.dev/dl/)、[Excelize发行](https://github.com/qax-os/excelize/releases/tag/v2.11.1)、[Excelize依赖](https://proxy.golang.org/github.com/xuri/excelize/v2/@v/v2.11.1.mod)。
