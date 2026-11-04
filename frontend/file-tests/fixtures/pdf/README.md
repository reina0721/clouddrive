# PDF 验收夹具

由本目录 `generate.py` 使用 ReportLab 生成，内容全部属于项目测试，无外部文档或用户数据。reader.pdf 有10页真实文字、矢量图、大纲及首末页内部链接；encrypted.pdf内容相同，公开测试密码为`reader-test-password`；over-pages.pdf为501页，验证默认500页上限。二进制夹具固定提交，运行浏览器测试无需Python。需要重新生成时使用安装了ReportLab的Python执行此脚本，随后复核页面和浏览器测试。

over-image.pdf为真实3000×3000红色图像，源PDF压缩后很小，但图像超过默认8388608像素；验证明确超额失败。生成器需要ReportLab与Pillow。

under-image.pdf为2000×2000红色图像，与超限红图比较实际画布像素，证明正常解码与预算省略，而非仅检查按钮或空白夹具。
