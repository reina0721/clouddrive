# 压缩浏览测试夹具

`browser.zip` 用 .NET `System.IO.Compression.ZipArchive` 创建，包含三个项目自有非敏感文件：`docs/readme.txt`（用于证明脚本文本不会执行）、`root.txt`（字节 `root`）、`pixel.png`（1×1 PNG）。不显式创建 `docs`，用于验证隐式父目录。

SHA256：`7495f2e0223d9d50d983ff9f2bcce3b5dd2c8dd3d38c73c82dde2309c09dc052`。

7Z 用例读取后端 `adapter/archiveprocess/testdata/sevenzip` 的上游测试夹具，来源与许可证见该目录。
