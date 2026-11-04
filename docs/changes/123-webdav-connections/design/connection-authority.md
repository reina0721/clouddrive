# 独立凭据和目录权限

## 模块与契约

files拥有Connection实体、仓储和Connections用例；Protocol Adapter消费files服务的窄能力，不导入IAM内部实现或GORM。composition注入IAM新增AccountAuthorizer窄facet，输入accountID和精确permission key，返回allowed/error；IAM用自己的repo读取当前active/archived/must-change及授权revision并调用已有evaluator。角色或账号变化在每次请求及发布前重查，不建立第二套角色缓存。

连接持久字段：ID、OwnerID、Name、RootID、ReadOnly、BlockSystemFiles、SecretDigest、State、ExpiresAt、CreatedAt、UpdatedAt、Revision。RootID为空表示本账号根；非空必须是可见目录，持久绑定ID而非可变显示路径。State为active/disabled/revoked，撤销不物理删除记录。真实根名称和路径仅在本人管理DTO中展示，根失效显示不可用；密码摘要、服务器路径和内部对象键不暴露。

## 凭据及管理

Secret使用现有crypto/rand 32字节与service内有domain的credentialDigest，不自写密码算法；这是随机高熵能力，不是人类弱口令，不执行每请求Argon2。Basic用户名为连接UUID、密码为随机secret；地址固定/dav/{connectionID}/。同时核对路径ID和Basic用户名，摘要恒定时间比较。该secret不会被IAM API-Token解析器接受，也不建立Session。

管理接口仍是Huma、IAM files权限、可信Origin与CSRF；创建、改备注/策略、停用/启用、轮换和撤销均由files本人owner限定。创建与轮换只返回一次明文密码；使用revision进行CAS，失败不返回新secret或更新错误行。默认20个未撤销连接、默认30天/最长365天，均集中配置和校验；到期计算使用注入Clock。清单分页有界，排序稳定，不在列表请求时生成密码。

协议认证不记录Authorization、secret、完整URL、文件名称或原始错误。错误认证统一401及固定WWW-Authenticate；服务失败保留原因但低敏呈现。固定请求准入/HTTP速率限流保护数据库，随机256bit不引入用户密码KDF成本。授权后每次操作仍检查有效根和业务归属，避免仅在入口检查一次后穿透。

## 目录和写语义

解析已解码路径前拒绝NUL、反斜杠、点/双点组件、畸形转义和超长/超深路径，不用path.Clean把越界请求悄悄变为合法。路径组件复用当前名称NFC/大小写规则，查询限定owner且最终必须在RootID内，根本身不得删除/移动/覆盖。Destination必须是同一源站和同一连接前缀，不接受另一个连接ID或任意外部URL。

只读在所有写方法进入前及业务提交边界检查；阻止系统文件针对写入/复制/移动目标的点开头组件，不把它误作隐藏原有文件的读取策略。MOVE/COPY覆盖执行同一owner事务，原目标软删除与新结果同时提交；失败不先删目标。条件ETag/源版本在事务中复核；重命名/移动和复制不能制造环，批量子树继续有界。DELETE调用同一回收语义，恢复沿用网页原有入口。

files新增v7增量迁移，涵盖连接和上传扩展字段；v1–v6原文与checksum不变。MySQL/Postgres同时提供SQL，实际运行未提供时只验SQLite并明确边界。
