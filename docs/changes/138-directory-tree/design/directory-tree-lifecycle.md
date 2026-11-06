# 目录树状态与装配

## 模块、接口与数据

不改Go、API、依赖或数据库。Surface files新增sidebar-preferences typed配置与directory-tree语义模型；FilesPort用loadSidebarPreferences/saveSidebarPreferences替换旧布尔方法，迁移全部调用方。Host sidebar-preferences Adapter按账号读写v2，迁移v1，保留错误链和owner断言；不改变137服务器视图配置。UI Adapter Tree新增expandedIds/onExpandedChange、hasChildItems和紧凑行选项，默认行为不变，不泄露RAC类型到Surface。

FileWorkspace拥有单一树控制器，两种导航呈现共用；桌面隐藏树与移动抽屉不创建两套请求。树组件按需lazy加载。目录记录含真实FileEntry，分支含items、已读页、total、phase和失败页；状态集合有界。根使用稳定内部key映射协议空parent，其他节点使用实际UUID，载入/重试节点使用独立命名空间，不伪造目录记录。

## 数据流、分页与当前路径

list调用固定folder-kind、folder范围、名称升序、pageSize50，不携带当前搜索/分类条件；返回页成功后再推进页码，按真实id去重。未读目录hasChildItems为true，读取空结果后移除假展开提示。操作节点承担载入、继续和重试，显示真实状态，不是文件夹。根按钮只控制显示，不导航；原根FileLink保留原生链接语义，根高亮仅在实际根范围生效。

自动跟随通过当前目录的有界list读取获取真实breadcrumbs，投影祖先和当前项，随后按预算读取必要分支。路径中未出现在已读分页的子项来自已验证breadcrumbs，明确标为当前路径；分页成功后合并去重。最多自动补全20层兄弟分支，其余保留显式载入入口；缓存总目录最多1000个，拒绝超预算整页而非默默截断。路径本身超预算时明确失败，主列表仍可用。关闭跟随仅保留手动展开；新的当前路由才触发跟随，用户当次手动收起不被同一effect立即反转。

## 生命周期、并发和失败

控制器随FileWorkspace/Port拥有，不建全局可变缓存；请求接收AbortSignal。相同分支去重，目录查询并发受控，自动队列串行，不启动无限后台轮询。刷新、工作区revision、上传完成修订或Port变化会取消旧请求并递增代次，旧结果不能回写；卸载取消全部等待。页失败保留已读内容及失败页，重试只重做该页；权限、缺失、超预算和网络错误分别导出，无隐藏回退。

树选中由实际路由控制，探索焦点不等于路由。行选择/动作调用既有Host导航，UI Adapter负责键盘；不得自行构造第二套ARIA。两种视图复用控制器，移动导航调用close回调，由ExplorerNavigation既有流程恢复文件区焦点。当前仍可用的分类FileLink不迁为伪链接。

## 偏好、日志和安全

设备sidebar v2为collapsed及autoExpandTree；默认false/true集中定义。v1只有布尔collapsed。新键写成功后才删除旧键，存储损坏或配额失败明确提示，不静默重置；任何写入先验证owner。与files.view.v2无相互覆盖，不新增数据库迁移。复用既有网络错误与后端日志边界，不记录目录名、完整路径、查询或凭据；纯状态算法不机械记录日志。

## 文件影响与验证

修改files model/exports、Host backend、FileWorkspace及相关workspace单位；新增sidebar typed模型/Host Adapter、目录树状态Hook/渲染/中英资源。Tree Adapter扩展只覆盖本用例真实所需能力，既有Tree展示与基线默认保持。新源统一LF，避免137发现的提交字节与运行字节漂移。

先接通F341–F360再测试。集中运行有意义的状态/迁移/取消单位、前端类型/lint/架构/生成/格式、两套生产构建及原预算；实际QA目录树浏览器验收含51+目录分页、深路径、失败/重试/账号切换、工作区变化、上传保留、320px英文深色/Axe及原工作区/偏好回归。Go源码不变，不重复Go全量；私有目录接口和数据通过真实API及原表摘要复核。重启受影响三套前端，保持后端和原两库数据，访问说明保存.data；精确提交推送并核对远端。

验证增量：根控制使用现有IconAction.expanded而非不透传ARIA的Action，初始化前禁用。Tree动作标签改为plain string，RAC统一追加行名；迁移所有三个调用方和专属文案，不保留旧函数签名。刷新后同时在预算内读取已展开探索分支。增量依据R138-001，当前goal直接实施授权持续适用。

键盘归属：Host快捷键在treegrid目标内直接交还给树，防止主列表选中项接收树中的Delete/F2/全选；新增边界单位及真实浏览器焦点检查。

目录导航显式使用replace选择和press激活。TreeItem的公开PressEvents分发点击、Enter和Space，移除选择回调导航，方向键和Home/End只探索焦点；选中状态仍来自实际路由。Adapter其他调用方保持默认action语义，集合key分发普通动作。移动抽屉关闭后下一帧移交Host焦点，effect清理取消未执行帧，确保背景隔离已解除。
