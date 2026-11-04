# 协议入口与资源

## 成熟协议边界

adapter/webdav采用emersion/go-webdav v0.7.0。FileSystem同步Create、Copy、Move对接项目业务；XML和WebDAV基础头由库处理。项目预校验Depth、Destination、条件头、路径及body预算，不让第三方错误正文和任意文件信息穿透。XML控制请求默认64KiB、目录响应最多500条/1MiB、路径最多4096字节/64层，越限明确报错，不截断为伪完整目录。Depth=0/1/infinity有界处理，ReadDir返回库需要的根自身和限定子项，避免遗漏根属性。

OPTIONS准确列出允许方法与当前能力，不照搬库默认的完整兼容声明。LOCK/UNLOCK和不支持的dead properties不得伪成功；本批不声明Class2。没有自研XML解析器、共享可变全局锁或第二套后台任务。

GET/HEAD在files.DownloadTo同步回调内调用完整协议响应，传入显式借用reader的request-local FileSystem，Close不释放外层资源。外层所有者统一导出实际Close/读取错误，发送后异常中止连接，不追加JSON。协议响应固定nosniff、attachment、no-store和no-referrer，Range/条件请求复用标准net/http语义。不在Open中创建第二个Storage客户端或用全文件临时下载适配读租约。

## 路由与预算架构

Huma/OpenAPI只表达管理JSON；PROPFIND/COPY/MOVE等扩展方法不塞入标准PathItem，也不调用chi.RegisterMethod修改共享全局表。files绑定提供显式ProtocolDefinition（prefix、允许methods、security=file-connection、budget、body用途）；同一声明用于运行分派、预算和协议说明。composition在共同HTTP中间件内部、Chi路由匹配之前按精确前缀分派net/http协议handler，未知方法返回405，其他路径仍进入现有Huma/API。模块自己拥有该协议认证和授权，不能把它标成无授权public普通文件API。

前缀分派是显式装配的HTTP适配，不另开listener、不重复日志/sink。全局请求ID、低敏AccessLog、trusted proxy、安全头、CORS、过载和timeout仍覆盖协议；精确PUT/GET/HEAD使用既有transferTimeout，控制/XML请求保留普通timeout及各自body上限。PUT上限按文件预算在鉴权和files准入后施加，不能让普通JSON预算把文件截断。请求取消贯穿协议、文件服务、暂存和Storage；不使用无期限重试。

协议使用独立Basic，不要求浏览器Session或CSRF；带Origin的写请求仍验证可信源，原生无Origin客户端允许。管理接口CSRF不放宽。正式地址必须HTTPS，回环开发例外不改变OS或浏览器安全配置；客户端指南不包含规避安全校验的步骤。

## 依赖与退出

go-webdav仅留在adapter，库FileInfo/CreateOptions不穿到model/service。x/net升级0.62.0修复研究发现的已知问题，随MVS升级最低crypto/sys/text/term，不顺手升级无关库。替换库时保留项目连接、源类型、文件条目与永久对象；若必须支持缺失扩展或发现新漏洞，再按refresh trigger定向研究，不加永久fallback。
