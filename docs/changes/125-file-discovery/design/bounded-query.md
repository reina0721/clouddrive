# 有界查询与协议

files.Service继续拥有唯一List用例。Repository增加消费方ReadBounded(ctx,owner,limit)，生产借用现有GORM租约，数据库LIMIT+1检查超预算，读取后再次复核存储身份。其他确需完整集合的mutation与分享契约保持明确职责，不通过类型断言或运行时发现另一个实现。

files.search.treeEntries默认10000且仅能调小为正数，经统一defaults/Decode/Policy校验注入。标准请求同步执行，无新goroutine或关闭职责。ctx传入数据库并在条目/祖先/匹配循环检查；错误链完整上返。超预算413，不能拿前N条冒充完整结果。

Query拥有有类型的scope/match/sort，以及keywords、caseSensitive、kinds、extensions、min/maxBytes、createdFrom/To、modifiedFrom/To、foldersFirst、page/pageSize。scope可为auto/folder/tree/all：auto精确定义为普通目录查询当前层、文字或分类检索全部自有可见集合，保留当前有效业务语义；高级界面总是显式传folder/tree/all。旧search字段仍是简单名称条件，和其他条件相交，不另建旧搜索实现。类别继续只过滤真正文件。无用户SQL/正则/任意字段名。

先验证参数，再读取owner快照。基于ID建立本次请求索引，记忆祖先可见性和到指定根的归属，使用有界迭代而非深递归；循环/缺失祖先不能被当作可见。trash集合仍只包含显式回收项，范围与过滤相交，不能因搜索绕过权限。纯算法不机械打印日志。

关键词最多8个，每词非空、有效UTF-8、不含控制字符且不超过255rune；沿用NFC。忽略大小写使用标准Unicode ToLower，不宣称语言区域排序/复杂全文分词。组合为全部或任一，未指定时全部。扩展名最多16个，使用文件最后扩展名、去开头点并统一小写；只作用普通文件。类型限file/folder/shortcut。大小是可选指针，0有效，只对普通文件生效；上限不得超过JS可精确表达的整数范围，min不得大于max。

时间上下界为可选RFC3339时间，下界包含、上界排除。界面UTC日历的结束日期转为次日0点，从而包含整日；无效日期/逆序边界错误，不隐藏回退。过滤后按name/size/updated/created及ID平局排序；foldersFirst只把目录放在前面，不受desc反转。

最后分页并提供total/page/pageSize。pageSize=0明确表示不分页，用于现有目录选择和画廊快照，仍受树预算；普通界面50/100/200条，协议最大200，page从1开始。页码越界返回该页空集合与真实总数，界面提供前页/首页，不假改查询。逻辑占用仍按整个owner集合计算，不能随过滤/页码减少。

扩展现有GET /files输入/响应，不新增operation（仍111）、匿名路由或权限。Huma schema与console投影、Surface响应验证同步生成。控制参数有限且禁止将原查询、名称或完整URL写日志；失败沿用当前边界受控错误代码。
