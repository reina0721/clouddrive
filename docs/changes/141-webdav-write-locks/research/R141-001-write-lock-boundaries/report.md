# R141-001 证据与结论

## 问题及复核边界

从根README、范围文档、文档入口、文件管理手册、技术选型和日志规范进入。检索现有研究metadata，复用R123-001的同步Storage租约与原子COPY证据；本次需求命中其“需要DAV锁”退出条件，只定向复核锁契约及140新增覆盖写入，不重复整个仓库研究。

## 可复核事实

- 基线Git干净。`adapter/webdav/protocol.go`用emersion处理普通DAV并在外层持有Storage.WithReader读取租约。`binding/webdav/http.go`现在拒绝If/Lock-Token，未声明LOCK/UNLOCK，当前没有锁能力。
- `repo/repository.go`的saveEntryChanges是普通文本、元数据、目录操作的保存点；history_preferences、share_scope、connections、navigation也调用它。`repo/transfers.go`最终发布直接写entryRecord，必须另行纳入同一保护。只在DAV适配器检查无法拦截网页、分享和已接收上传。
- `repo/shares.go`的lockOwner先更新唯一files_storage行，再更新owner行；它已经串行化全部文件写入，可复用以检查全局锁数量，无需另加全局可变锁或goroutine。
- `model.Transfer`目前直接映射repo别名。若保存结构化If条件，应移除该别名并用repo私有编解码，不能把ORM字段塞入业务条件。
- 参考站连接页及创建表单实看截图在忽略的`.data/141-reference-connections.png`。账号、相对根目录、只读、系统文件限制、反向代理可见；没有提交表单。不能从此推断参考站实际协议或锁实现。

## 成熟候选与承载架构比较

|候选|覆盖及维护证据|边界和成本|结论|
|---|---|---|---|
|emersion/go-webdav v0.7.0|现有MIT协议依赖；官方release及当前server源码；锁PR187仍Draft|没有正式锁/属性扩展点；直接换未合并补丁会增加维护和全局状态风险|保留已验证的普通DAV，不采用未发布分支|
|golang.org/x/net/webdav v0.62.0|现有BSD依赖；官方源码成熟LockSystem、内存锁和协议实现|File.Open/Close生命周期与当前同步租约不一致，默认COPY涉及跨步骤内容写；内存锁也不保护原生写入；If解析器未导出|不为锁全量替换存储适配架构，复核其规范语义作为对照|
|go-filesystems/webdav|官方go.mod要求Go1.27.1|不兼容当前1.26.10工具链，内存锁不能满足持久化与其他入口；暂无本项目接入生产证据|不引入|
|标准库encoding/xml、net/url、strings|工具链维护、无需新增许可证/依赖；有取消与字节预算外层|负责有界XML和URI编解码，不提供业务写锁|保留并用于窄协议扩展|
|项目特有写保护|已有统一owner事务、连接身份和同步上传发布|必须固定URL根、原子检查前后目录关系，并保存条件用于发布复验|合理自研业务规则，限制在files，不扩成通用锁框架|

候选已比较维护、版本、许可证、安全/生命周期、生产使用证据、工具链、API稳定性、可测试性、可观测性与替换成本；未发现可直接接入当前同步租约和全部原生写入口的成熟完整方案。没有声称已完成依赖漏洞全量扫描。相比全量更换FS承载层，保留内容读取租约及原子业务写入能避免内容长驻内存、对象泄漏和COPY部分成功；新增规则的独立纯函数与真实HTTP验证是可验证收益。

## 标准约束与推断

[RFC4918](https://www.rfc-editor.org/rfc/rfc4918.html) §6/7/9/10/15：独占锁可以单独支持；锁令牌不是身份凭据，仍需认证主体；空URL加锁须原子创建空文件；Depth0文件夹保护直接成员名称但不锁成员内容；Infinity覆盖后代；COPY不复制锁、MOVE不搬锁；If中出现的令牌在整个If成立后视为提交，即使位于Not或未成立分支。刷新空体、忽略Depth、不返回Lock-Token头。锁发现不能把其他有效锁伪装成空。

因此推断应将根保存在owner规范URL命名空间而非EntryID，写入同时检查变化前后关系；锁根被删除且未被替代时清除锁。连接级认证主体采用连接ID及版本，避免把另一个应用密码当作同一编辑器；账号本人通过原生CAS界面可释放锁。连接撤销、轮换、只读及过期使锁失效。

## 官方来源

- [emersion releases](https://github.com/emersion/go-webdav/releases)、[server源码](https://raw.githubusercontent.com/emersion/go-webdav/master/server.go)、[未合并锁PR187](https://github.com/emersion/go-webdav/pull/187)。2026-11-06读取，PR仍Draft。
- [x/net锁契约](https://raw.githubusercontent.com/golang/net/v0.62.0/webdav/lock.go)、[If解析器](https://raw.githubusercontent.com/golang/net/v0.62.0/webdav/if.go)。不复制未导出源码，不引入fork。
- [go-filesystems go.mod](https://raw.githubusercontent.com/go-filesystems/webdav/main/go.mod)，当前声明Go1.27.1。
- [Cloudreve官方V4讨论](https://github.com/cloudreve/cloudreve/discussions/2522)，说明锁与WOPI方向，不能等同当前参考部署已验证。

## 门禁结论

研究门禁通过。剩余未知是实际客户端互操作表现，纳入集中验证而不阻碍形成计划。刷新条件见metadata；若正式上游契约能承载原子业务锁，则定向评估替换本项目协议胶水，不永久双轨。维护责任归files模块；退出条件为上游可直接注入事务锁且通过同一负面验收。
