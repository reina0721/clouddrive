# 验证记录

状态：V135、D135完成。第十五批F281–F300全部接通后才集中生成和测试；累计验收300项，不表示完整Cloudreve对齐。

## 功能、失败路径与既有回归

最终Go全量（go test -p 1 ./...）与go vet ./...通过，证据135-go-all-final.log及135-go-vet-final.log。覆盖当前IAM角色、受限会话拒绝、严格对象/null、权限继承与子树裁剪、原生内容与ZIP、主体绑定下载、真实tus上传后撤销发布与原主体取消、SQLite v13保留与回退保护。受限会话先以135-restricted-red.log证明失败，修正后全量通过。

675前端单测、类型/lint、架构/依赖/生成检查通过。原有全量格式检查有4个HEAD未改文件告警，本次范围格式通过；不宣称完整pnpm check通过。production依赖审计0命中。

135-browser-evidence.json逐项映射71项基础浏览器场景。固定项异步定位改用稳定主体并校验保存顺序后通过；PDF末例首次ENOSPC，补验通过。原5项权限场景检查通过后人工截图发现内部横向裁切，新增局部检查135-overflow-red.log证明失败；字段集及legend换行修正后的135-browser-layout-r4.log再次5/5通过，含320px英文深色长主体名称、内部横向溢出和Axe。最终窄屏与桌面截图均人工查看确认，截图仅保存在.data。

## 构建、数据与预览

135-layout-build-primary-resume.log及135-layout-build-qa-resume.log均退出0。各自performance日志通过原阈值：initial347041、maxRoute440989、union2194758、CSS49090/49152字节；没有放宽预算。两份生产目录135-delivery-*-r4启动后不再原地构建。

两库已追加迁移至v13，135-preserved-data-after.json验证两库旧四表全部原列摘要、120原条目、7分享和6grant不变。没有在原库创建测试用户或夹具。主预览及开发后端运行135-delivery，含最终Restricted拒绝；开发旧进程退出后重新启动，4173可用。主4181与隔离4194前端均使用r4。135-runtime-receipt.json记录16项认证接口、代理目标、页面就绪和既有PDF安全头检查通过。

独立QA后端的额外更新此前被自动审批拒绝，保留135-final候选；最终受限会话的证据为Go回归及主/开发135-delivery运行版本。旧构建删除被自动审批拒绝后未绕过；NTFS无损压缩保留所有文件。最终构建使用恢复的临时空间完成，磁盘余量仍应关注。

本地地址、账号、口令、Token和访问回执保存在忽略的.data/135-preview-guide.txt、preview-access.json及135-demo-access.json；不提交或公开trace。未验证外部MySQL/PostgreSQL/S3，未重跑全站423例。范围不含Office、OCR、外部组、无链接账号挂载共享、BT/magnet和远程节点。

交付：功能提交a23b31b9866b1c0dfd3ccf9efd752df1dd37d57f（feat(files): add share audiences and inherited entry permissions）已推送至origin/main，ls-remote与本地HEAD一致。最终浏览器类型检查、定向lint、范围格式、docs结构及git diff --check通过。
