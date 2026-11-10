# R180-001 文本代码编辑器

人工查看[官方 Monaco 编辑截图](https://docs.cloudreve.org/assets/file-apps-monaco-editor.DBSpo75D.png)。参考为宽幅代码窗口、行号、彩色语言令牌及顶部保存。官方文件应用手册说明可切换读取编码并以 UTF-8 保存。截图来自官方资料，未在用户站写入样本。

基线为纯文本预览加独立文本输入框，Markdown 有自身工作区。Go 的私有 `ReplaceText` 使用修订校验、限额、逻辑配额及历史保留。复用这些业务规则和文件应用关联，代码编辑组件只处理文本呈现与交互。共享写权限维持原有契约。

比较两种成熟编辑器。Monaco 提供参考中的缩略图和工作线程语言服务，官方说明不支持移动浏览器。CodeMirror 6 支持移动端内容编辑、行号、撤销、语言懒加载和标准命令，适合保留现有保存事务。上游已从 GitHub 迁至[维护源码](https://code.haverbeke.berlin/codemirror/view)，以官方 npm 固定版本及上游参考验证 API；采用 MIT 许可，仍有持续发布，CodeMirror 6 已用于 JupyterLab 等浏览器工作台。旧 GitHub 归档不视为维护结束。源码编辑仅处理文本，无执行、远程补全和 CDN。Go 无新增依赖。浏览器原生 TextDecoder 支持严格解码，避免自研编码转换。版本升级检查搜索键绑定、性能、移动输入及安全公告。[Monaco](https://github.com/microsoft/monaco-editor) · [CodeMirror API](https://codemirror.net/docs/ref/) · [编码标准](https://encoding.spec.whatwg.org/)
