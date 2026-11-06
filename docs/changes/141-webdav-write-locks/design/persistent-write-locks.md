# 持久锁和协议接入

## 边界和选型

采用研究的保留/合理自研结论：普通DAV继续emersion；Go标准库处理有界XML、URI及条件语法；model只表达写占用、条件和纯目录规则；service负责身份、连接根解析、作用域和权限；repo在同一storage/owner事务内保存与再次执行写保护。协议库的类型不越过adapter边界。无需为了完整FS接口重构同步Storage生命周期。

协议胶水的维护责任为files，不能演进成通用分布式锁系统。上游提供可注入事务锁及自定义属性且通过本批同一验收时评估替换并删除旧胶水，不保留永久兼容支路。

## 持久事实与生命周期

新增v16独立`files_write_locks`，字段为唯一UUID、owner、创建连接ID/版本、owner绝对规范RootPath、Depth枚举、owner XML值、创建/到期、CAS版本。令牌由UUID形成urn:uuid，不是认证密码，不用于原生接口授权，不写日志。owner XML为有界协议值，只在adapter编解码，原生UI不渲染其HTML；保存namespace解析后的完整混合内容，禁止DOCTYPE/指令，最大8KiB/32深度/512节点，保留客户端信息而非截断。

根绑定URL而非EntryID。已有名称正规化用于路径片段；路径最大4096bytes/64层。纯规则建立ID与父子索引，按每个锁根逐层解析；不遍历构造所有原生深路径，不因无关深目录而拒绝写入。检查变化前、合并后两个索引，目录移动/回收同时保护后代锁；直接父目录Depth0锁仅限制成员名称，不限制其内容。MOVE后旧根无人占用则在同一事务删除锁；目标URL继续占用时保留该URL原锁。COPY不增加锁。

锁默认5分钟，上限1小时；同owner最多100、全局最多5000，作为ConnectionPolicy显式字段装配校验及配置映射，读取上限拒绝截断。过期锁惰性清理，无goroutine；创建时在现有storage行锁内先按索引有界清理过期记录，再校验全局/账号预算。连接失效锁不再阻挡写入；创建/列表清理本owner失效锁。期限不得超过连接到期。连接ID+revision作为锁创建主体，本人可原生释放；不同连接持有同一个公开令牌仍无权写入。

## 事务和写保护

Repository显式注入现有clock.Clock，组合根及navigation/connections/transfers统一传入，不新增全局time源。saveEntryChanges改成receiver，先校验变化身份，再读取有效锁并执行model保护；原生写入没有锁授权。历史、分享和导航调用方同步迁移。传输准入和最终直接写入点同样检查；最终检查与CAS、历史、配额处于同一事务，不把上传已接收等同可发布。

DAVScope含有界类型化If条件。连接事务快照含有效锁；service在同一快照解析条件、确认整体成立，收集所有出现令牌（含Not和其他分支），授予仅该连接/版本的本次写权限。repo回调返回条目和显式FileWriteAuthority，保存前仍核对主体，不把请求Header或授权放入context隐藏通道。普通写入只能提供空授权。

WebDAV PUT的If条件随传输持久化并在发布时重新求值；移除transferRecord直接业务别名，repo私有结构显式编码类型化条件到新增JSON列，空条件有唯一明确表示。解码错误完整上返，非DAV来源拒绝携带条件。无新旧双套记录模型。

## 协议

LOCK/UNLOCK纳入现有方法/权限/请求预算。共享锁明确拒绝，不冒充独占。新LOCK返回200或新空文件201及Lock-Token和lockdiscovery；刷新只接受空体和单令牌If，可对锁范围内资源续期，忽略Depth且不输出Lock-Token头。空文件和锁必须同一owner事务建立；无需永久存储对象，复用已存在空文件内容语义并验证实际下载。

If使用标准语法的有界AST，8KiB、32列表、64条件；不混合tagged/no-tagged。资源标签必须同源同连接，百分号、反斜线、路径边界沿用现有URI策略。条件在单列表AND、列表OR；ETag采用弱比较但保留If-Match现有强语义。条件失败412，缺少有效写授权423。不能仅以字符串包含令牌放行。

PROPFIND不重新实现成熟目录协议：在现有1MiB缓冲响应中，以encoding/xml结构和Token复制转换supportedlock/lockdiscovery，保留其他属性的namespace、值和状态。识别allprop/propname/显式属性，移除对应的旧404并写正确propstat；禁止原始字符串替换XML。锁根不在当前连接可见范围时，该属性403而非伪装无锁或泄漏根外路径。响应再检查预算。Infinity后代冲突使用207列出423与根424；正常读取保持流式同步租约。

## 原生接口与界面

增加本人锁列表和CAS释放两个窄操作，复用IAM files read/write及现有handler/contract生成链路。列表仅含显示路径、连接名称、深度、到期和版本，不输出令牌或owner XML；其他owner返回不可访问。释放只接受记录ID与预期revision，不接受任意token作为权限。

连接页添加懒加载“文件锁”对话框，真实列表/空态/失败重试/刷新和确认解除。时间消费现有区域偏好；英文/中文、深色、窄屏与现有DialogSurface确认失败footer一致。稳定新错误write-locked区别分享密码locked，所有入口显示明确占用提示。界面不提供假造锁、静态列表或未经协议验证的编辑器状态。

## 错误、日志与资源

取消和存储清理错误沿现有errors.Join链上返。纯model不记录日志；协议最终响应边界仅按稳定操作/错误类型与关联ID记录，不含路径、owner XML、token、headers、密码或完整URL。锁数量/持久化错误不可默认放行。没有新增资源所有者；DB由composition、读取由Storage、请求缓冲由adapter拥有。

## 文件影响与验证

影响files model/service/repo、webdav adapter/binding、handler操作、module与composition时钟装配、配置ConnectionPolicy、六份新增v16 SQL及摘要、前端files contracts/api/ports/连接页对话框/词条、生成契约及匹配测试。原migration不改字节，不做数据重置。

20项接通后集中执行：纯规则前后目录矩阵、真实数据库并发/重启/时间与CAS、HTTP新空文件与XML/If错误/跨连接/最终发布冲突、网页/分享/历史阻挡及解锁恢复、移动复制语义、原数据逐表摘要、类型/lint/Go全量/vet/相关浏览器/Axe/320px英文深色和生产构建预算。仅已有基线截图获得人工授权的那张可更新，本批不扩展基线授权。

迁移前备份主/开发库并记录files表摘要；QA先v16，成功后原两库仅追加迁移，保留原始列值及内容。重启受影响主/开发/QA服务并保持运行，私有访问资料写忽略的.data，交付提交推送及远端一致核对。不触碰无关4180服务或未知构建目录。
