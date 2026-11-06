export const zhLocks = {
  title: '文件锁',
  description: 'WebDAV 客户端申请的编辑占用会保护文件写入。解除前请确认编辑器已停止保存。',
  empty: '当前没有有效的文件锁',
  loading: '正在读取文件锁…',
  depth: '保护范围',
  self: '自身与直接成员名称',
  subtree: '自身及全部后代',
  connection: '来源连接',
  expires: '到期时间',
  release: '解除占用',
  releaseTitle: '解除文件锁',
  releaseDescription:
    '解除后其他入口可以写入；尚未保存的编辑内容可能发生冲突。此操作不会修改文件内容。',
  conflict: '占用已经续期或改变。请关闭确认并刷新列表后重试。',
};
export const enLocks: typeof zhLocks = {
  title: 'File locks',
  description:
    'Editing locks acquired by WebDAV clients protect file writes. Make sure the editor has stopped saving before releasing a lock.',
  empty: 'There are no active file locks',
  loading: 'Loading file locks…',
  depth: 'Protected scope',
  self: 'This resource and direct member names',
  subtree: 'This resource and all descendants',
  connection: 'Source connection',
  expires: 'Expires at',
  release: 'Release lock',
  releaseTitle: 'Release file lock',
  releaseDescription:
    'Other entry points can write after release. Unsaved edits may conflict. This action does not change file content.',
  conflict:
    'The lock was renewed or changed. Close this confirmation and refresh the list before retrying.',
};
