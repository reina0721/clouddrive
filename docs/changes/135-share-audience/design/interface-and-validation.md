# 用户流程、接口影响与验收

## 界面

既有创建分享和分享设置增加受众编辑区，按匿名/登录默认、账号、角色展示；每行使用现有SharePermissionFields与“拒绝/沿用”显式选项，复用UI Adapter，支持窄屏与键盘，不在产品中暴露位集、revision或Token。用户输入完整账号标识或角色编码后精确查找并显示匹配标签，确认添加；没有公开目录枚举。规则可编辑/移除，最多32条。保存冲突保留草稿，刷新须用户点击。

文件和目录菜单新增权限设置，显示独立或继承、最近来源及恢复继承。相关有效分享上下文由服务端按该条目祖先查找，返回id/title/root名称，不返回token；选择分享后可用匿名或经精确查找的账号预览实际能力和来源。没有相关分享时说明策略将在该项作为共享子项时生效，不伪造上下文。恢复继承不清除后代。

PublicShare增加denied/signInRequired，与password locked分开；无匿名权限显示登录入口，保留当前分享的本地返回地址，不能跳到任意外站。PublicListing增加当前目录permissions；PublicEntry增加实际permissions。按钮逐项按该对象能力呈现，批量仍逐项返回真实结果；上传-only不要求Browse仍能用根目标。当前账号退出/变更后票据不可复用，失败显示可理解原因并可刷新。

## 文件和契约

Go files的model/service/repo/handler/binding/http/migration，IAM新增facet和内部实现，composition装配，必要现有测试；新增本人entry权限GET/PUT、相关分享/effective预览、精确受众lookup等typed operation，不以任意map表达核心规则。ShareCreate/ShareUpdate/ShareSummary、PublicShare/Listing/Entry扩展明确类型，生成OpenAPI和operation库存保持code-first。前端Surface契约、FilesPort/PublicFilesPort、Host当前客户端及菜单/弹窗/分享页同步；英文/中文文案一致，不在Surface访问浏览器或后端DTO。

当前authority更新：文件管理、IAM与files模块说明、API、运行能力、技术选型和范围；任务证据不成为第二套现行规范。真正验收前root README继续280项，不先声称300。

## 集中验证

R135-003限定生产构建资源：现有Next配置关闭生产编译持久缓存，避免每个隔离目录额外保留编译数据库及压缩临时空间；同一编译器、运行能力和原性能预算保持为验收基线。此设置不删除既有产物、不改变开发缓存。

先完成全部20项及测试源，写入.data/135-wiring.json，之后才生成/格式化/测试/构建。模型覆盖优先级、0与nil、最近继承、根覆盖、管理员、循环/越界；IAM真实DB当前账号/角色/禁用；Service/Repo验证同owner事务、并发ACL、全部读写路径、ZIP/递归操作、下载Range、传输身份与最后发布收权、策略坏JSON失败；HTTP验证可选会话、Origin/CSRF、普通用户不可读维护入口、访客无私有规则泄漏。真实浏览器创建多个QA账号/角色，实际登录不同上下文、读写/拒绝、签发与换账号、子项继承/重置、复制/移动继承、冲突草稿、320px/深浅主题与Axe。所有QA使用独立新库与夹具；原库只备份/追加迁移/运行只读检查。

运行Go适用全量/vet、迁移SQLite与可用其他驱动验证（未运行平台如实说明）、前端type/lint/unit/边界/依赖/生成新鲜度、docs/diff、production audit；主/QA分开构建与原性能预算，不能放宽首屏阈值，受众编辑器按需加载。原分享协作、工作区、传输、版本/PDF等按影响回归。

验收后重启主8120/4181与开发8080/4173，保留原数据与4180其他项目；凭据、Token、地址、进程所有权和日志只保存ignored .data。审阅完整diff，按Conventional Commits提交并非交互式推送main，核对远端revision；不把本批完成视为整个goal完成。
