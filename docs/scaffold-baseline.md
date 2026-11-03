# 脚手架基线来源

本文只记录当前仓库可以验证的来源事实，不声称本地存在未导入的源仓库提交历史。

## 可验证事实

- 当前根 Go module、README、Docker 与 `.scaffold/identity.yaml` 使用 `clouddrive` 身份。
- 当前 Git remote 是 `git@github.com:rin721/clouddrive.git`。
- 当前提交 `8e98d44` 把既有 `backend/**` 路径导入为 `old-backend/**`，并在根目录导入脚手架快照；`old-backend/` 不属于当前文档治理范围。
- `docs/changes/001`–`041` 是随导入基线带入的任务档案；当前仓库原生变更从 042 及之后的提交记录开始识别。
- `.scaffold/identity.yaml` 要求该基线文档存在；本文件补齐这一 provenance contract，但不完成仓库身份迁移。

## 使用边界

该基线说明用于解释历史档案来源，不作为当前架构、启动、配置或发布 authority。当前行为必须以根 README、`docs/` 当前主题文档和代码为准；身份迁移、frontend 集成和旧后端处置必须另立研究与确认任务。

## 刷新条件

当 Go module、remote、产物命名、导入边界或任务历史来源发生变化时，必须重新核对本文和 `docs/documentation.yaml`，并在同一变更中提交文档影响记录。
