# 偏好持久化与呈现

## 边界、接口与数据

files新增Preferences用例及消费方PreferencesRepository接口；repo.Repository实现读取与revision条件写，module.New显式注入handler。GET/PUT `/api/v1/files/preferences` 使用当前会话owner、files:read/write及写CSRF。PUT是整个typed文档CAS，不接受任意键；revision非负，新增为0，成功递增。未知字段/枚举、重复目录或列、超过200目录、非法目录ID、超长控制体失败；不对文件数据产生副作用。JSON上限128KiB，JSON仅包含偏好与目录ID，不含凭据。

文档：revision、rememberFolders、folderClick(open/select)、defaults视图、folders数组(parentId及view)。view复用既有8组字段，默认值同现有配置。目录覆盖可包含根ID空串；不存路径或名称，重命名不影响偏好。丢失或回收目录的覆盖不隐式删除，由用户主动清除。服务端不加载全部文件树来验证偏好，这些ID不能授予内容访问。

追加迁移v14，三种驱动均新增files_preferences(owner_id主键、revision、document)。不修改既有表或migration。原两库先做一致备份与旧数据摘要，再前滚验证；不执行down或删除数据。

## Host、状态与错误

Host持有按账号本机envelope(sync与configuration)，从v1迁移到v2，成功写v2后删除v1。默认sync=false保留旧习惯。load异步：本机模式不请求服务器；同步模式必须读服务器，失败向上返回，不隐藏回退。启用同步前读服务器revision，并将当前文档以CAS发布；另提供明确的“读取并使用服务器设置”，供另一设备采用服务器设置且不发布本机草稿。关闭同步将当前文档写入本机。已同步保存直接使用已加载revision，409不自动重试覆盖。各异步操作检查账号与AbortSignal；离开后不写入新账号状态。

Surface FilesPage按parent scope加载快照；不同scope旧请求取消。pending禁用视图写操作；保存成功才更新快照，失败保留当前展示并给出重载/重试。修改视图更新当前目录覆盖（若记忆启用）或全局默认；对分类、搜索和回收范围使用全局默认，不制造特殊伪目录ID。视图选项Dialog可设置模式、记忆与点击行为、设为默认、重置当前/全部目录。Dialog异步保存期间保持打开，成功关闭。

FileItem在open模式保留普通点击；select模式只对folder单击选择、双击打开，Enter/Space及既有修饰键仍明确处理。文件及快捷方式不受文件夹偏好影响。复用现有Action、SelectField、CheckboxField和DialogSurface，不改公共默认组件、Token或全局CSS。

## 并发、资源与诊断

repo复用owner事务锁与数据库租约；条件更新检查RowsAffected，0为冲突。读取无记录返回显式默认revision0；畸形已存JSON向上报错，不重置为默认。控制体与集合有界。服务无新进程/goroutine；Host取消生命周期归现有runtime。协议边界记录成功/失败策略，日志不含owner原文、目录ID、文档、请求参数或错误原文。

## 文件影响与验证

验证发现的临时发布繁忙：Host transfer-runtime复用既有retryDelaysMs，为同一会话commit增加最多三次busy重试（等待0/1000/3000ms）。每次调用前检查owner、signal及epoch；等待在取消时清理timer和监听器。其余错误及预算耗尽仍走原有服务器状态核对和明确失败流程。增加完成、耗尽、业务错误不重试及等待取消的单位检查，以及真实图片与队列回归；不放宽服务器锁或容量限制。依据R137-001增量证据，直接执行当前goal授权的验证修复。

内容读取复用同一files局部file-io-retry预算（fileIORetryDelaysMs）和withFileIOAdmissionRetry，不复制第二套重试。mediaTail继续串行，退避期间不放行后续内容读取；请求与等待均使用调用方signal和runtime lifecycle的组合取消信号。权限、版本、格式等非busy错误立即导出。MediaView按实际码显示网络/权限/繁忙错误，只有真实格式失败显示不支持；缩略图保留重试入口，版本变更清空旧错误与URL，旧请求取消后不得覆盖新结果。

修改files module/handler/http注册与repo，新增service/model与六个迁移文件及checksum；按现有code-first生成API与前端契约，不手改生成物。前端更新files view/preferences模型、FilesPort、Host持久化Adapter、FilesPage、FileItem、视图选项及中英文文案；迁移旧调用方与相关测试。

按用户要求先接通F321–F340，之后集中执行Go相关及全量检查、前端单位/类型/静态门禁、生产构建与原预算、真实QA浏览器20行为及相关回归、窄屏/英文/深色/Axe和CUA视觉检查。不得把局部通过扩大为全站通过。重启受影响Go和Next预览，原数据摘要复核；运行地址与账号等仅写忽略的.data目录。完成后审查diff、使用Conventional Commits提交并推送。
