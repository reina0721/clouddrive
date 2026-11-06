# 固定策略与身份装配

## 边界与决策

files/model拥有10项SharePermission、AccessPolicy、AudiencePolicy和固定求值，不依赖IAM/Casbin/HTTP/GORM。SharePermission继续根默认非零；受众规则允许全零表示拒绝，其余约束与原权限一致，Modify要求Preview，结构整理要求Browse。策略合计最多32条账号/角色规则，JSON最多16KiB；使用命名上限，拒绝未知位、重复、空或非法UUID及超额。nil表示继承/沿用默认，不能与显式全零混用。

AudiencePolicy包含可选anonymous/authenticated权限及accounts/roles具名规则。默认两项nil和空规则保留现有Share.Permissions。Entry.AccessPolicy为可选独立策略，包含default权限及同一Audience；nil从父继承。由目标向上找到最近非nil策略，到share.RootID前停止；分享根自身Entry策略忽略，使用Share.Permissions和Share.Audience。非可见/越界目标直接拒绝，不让规则“授予”越界路径。

优先级：当前活跃系统owner角色管理员及share拥有者 → 精确账号（含全零拒绝） → 匹配角色（任一全零拒绝，否则OR合并） → 已登录默认（若设置）/匿名默认（若设置） → 该层default。OR结果仍应满足能力依赖。来源投影reason枚举owner/admin/account/role/authenticated/anonymous/default及sourceEntryId或share，不暴露其他账号规则给访客。

## IAM窄facet与composition

新增IAM CollaborationDirectory公开facet，输出当前可用AccountID、有效RoleIDs、Administrator以及精确账号/角色查找的ID+显示标签。实现留在IAM，使用其内部Store/Unit和系统OwnerRoleCode；只包含active非archived账户/角色、有效关系，拒绝必须改密码或失效账号。不得让files导入IAM repo/model/service、查询其表或调用管理HTTP。对不存在/失效对象给统一不可选错误，不返回密码、权限快照或会话。

files消费方定义ShareAudienceAuthority（当前Viewer、按id当前身份、精确查找和校验目标），composition只适配该契约与IAM facet。Viewer的账号来自已认证principal，不能由公开请求body选择。所有依赖显式构造必需，无production匿名Noop。

公开分享HTTP路由族注入OptionalSessionAuthenticator：无Session Cookie允许匿名；有Cookie复用现有IAM authenticator，错误拒绝，不因数据库/过期失败静默降级。Huma以WithContext传递已认证上下文；底层浏览器Range/上传HEAD/PATCH使用同一规则。原有share Origin和无缓存/低敏Header继续生效；不改变全局SecurityNone语义、不新建认证来源。私有权限维护仍用files:read/write和原CSRF guard。

IAM身份在请求、读取和发布边界复核；ShareAccess绑定主体，后续校验必须同主体且读取当前角色。没有新的跨模块分布式原子事务或“在途任意字节立即收回”承诺。

R135-002补充：IAM repo以单次只读JOIN读取账号和有效角色，禁止为这个只读投影开启写事务。角色关联最多1000条，超限失败而非截断。HTTP显式null由humabinding.Nullable[T]与绑定层DTO转换承载；对象分支保持完整必填与额外字段校验，null分支仅允许null，不改变service可选指针语义。
