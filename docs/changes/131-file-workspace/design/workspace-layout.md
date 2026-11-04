# 装配、状态和验证设计

## 边界与控制流

files/routes/layout.tsx使用Next客户端pathname/searchParams与Suspense，传递当前位置及导航闭包给插件私有Workspace。Plugin src不导入Next、Host、DOM或Storage。共享布局持有本工作区UI状态；跨页刷新修订由插件私有、每实例state-foundation store拥有，不建全局事件总线。Root FilesPage、shared、shares、connections、downloads、transfers删除各自侧栏及重复main，唯一main由Frame拥有，各页仍使用Page/Toolbar/Section。

FilesPort扩展受控文件浏览query导航、可过滤快捷键以及账号内侧栏偏好读写，Host集中编码href，FileLink普通点击使用Host导航，修饰键保留原生行为。原有调用兼容可选参数，不引入第二个路由系统。全局搜索保留根列表query，其他页建立全文件查询；页码重置。Root保留高级搜索、筛选和文件快捷键，只移除重复搜索UI。

## 创建、上传和刷新

Frame复用TextDialog与目录选择逻辑；选择目标通过现有list/detail确认文件夹可见且非回收。全局folder调用现有folder；text/MD调用createText；上传复用chooseFiles/chooseDirectory/Transfers.enqueue。目标确认后才建立队列，不把选择文件等同保存成功；取消释放候选。Root已有拖放继续工作，其他页接入同一Host drop订阅并要求选择目标；Host不在非文件workspace截获文件。

本批不新增后端API。使用已有根list的配额与政策值，加载时显示等待、错误时未知及重试；不伪造空Listing或隐藏默认预算。成功写入递增workspace修订，Root和pins/配额重新读取；队列completedRevision也刷新摘要。读取effect带AbortController并在卸载清理。晚到写入回调不得跨账号存活；FilesRuntime已有账号assertCurrent和账号key继续有效。

## 账户与资源所有权

FilesProvider增加Host注入的账户工具renderer，插件只渲染稳定组件。Host复用AccountMenu、Shell主题语言store、真实logout、路由resolver。useIdleLock和LockScreen移至私有ApplicationChrome单点，移除AppShell中的旧所有者，避免重复timer/listener。锁屏保持客户端遮罩语义。侧栏折叠用独立账号key与类型校验，读写失败可见，不覆盖原文件视图配置。

队列tray复用TransferPanel；传输中心不同时挂第二个Panel，避免全局filter冲突。徽标只统计snapshot已载入活动项，不承诺持久服务器总数。导航切换不销毁上传，退出/换账号按原Host dispose释放句柄、timer与请求。

## 文件影响、风险和验证

主要文件：files routes/layout与文件link、Workspace私有组件/store、六页源文件、files稳定模型/runtime、Host backend/runtime/destinations、AccountMenu/ApplicationChrome/AppShell、相关消息及生成路由。无数据库迁移、依赖升级、用户数据迁移和新监听端口。保留现有上传协议与Share授权；旧平行侧栏和重复功能删除。

风险：query漂移、全局快捷键吞键、移动焦点、晚到请求、重复传输Panel、CSS预算仅51字节余量。使用现有class/token和懒加载动作组件控制成本，不提升预算。先完成F221–F240接线再测试；集中验证真实创建、目标目录、上传及队列、搜索范围与修饰键、账号偏好隔离、锁屏、语言/深色、桌面与移动、Axe和既有关键流程。执行pnpm check及production build/performance，后端未改仍做构建/适用检查；最终审阅diff、stage明确文件、Conventional Commit并实际push。先保存并冻结130已验收预览，最后重启普通和主预览服务，核对已有数据及健康状态；访问资料只放ignored .data。


锁屏恢复边界沿用既有部署能力：真实后端没有密码只读复核接口，退出重新登录恢复；证据见R131-001实施补证。本批不增加认证API。
