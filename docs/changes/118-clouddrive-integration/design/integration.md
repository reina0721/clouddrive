# 整合设计

保留 Go 根工程和 frontend 下完整 Next.js 工作区。替换旧 Vite/前端运行链，保留后端权限与菜单元数据。前端 4173，后端 8080，management 9090。同源代理 /api 与 /management。现有 /api/v1 保留，新增 /api/console/v1 协议绑定复用既有 IAM 与权限服务，避免平行认证。新增注册策略、通知、字典、工作台持久化归业务模块所有；迁移覆盖 SQLite、MySQL、PostgreSQL。所有写请求保持 Origin、CSRF、版本与权限检查。API 执行具备目标校验、超时取消、响应预算；调度复用现有执行与调度生命周期。验证按任务逐项记录，不把导入等同于接入完成。
