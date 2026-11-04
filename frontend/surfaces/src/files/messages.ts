import type { TranslationResources } from '@clouddrive/i18n';

/** loadFileAnnotationMessages 只在文件运行域加载整理界面文案，不增加登录首屏资源。 */
export async function loadFileAnnotationMessages(): Promise<TranslationResources> {
  const messages = await import('../../plugins/files/annotations-i18n');
  const explorer = await import('../../plugins/files/explorer-i18n');
  const versions = await import('../../plugins/files/versions-i18n');
  const downloads = await import('../../plugins/files/downloads-i18n');
  const collaboration = await import('../../plugins/files/collaboration-i18n');
  const workspace = await import('../../plugins/files/workspace-i18n');
  const archives = await import('../../plugins/files/archive-i18n');
  return {
    'zh-CN': {
      translation: {
        files: {
          annotations: messages.zhAnnotations,
          explorer: explorer.zhExplorer,
          versions: versions.zhVersions,
          downloads: downloads.zhDownloads,
          collaboration: collaboration.zhCollaboration,
          workspace: workspace.zhWorkspace,
          archives: archives.zhArchives,
          shareStatuses: { paused: '已暂停', limited: '目录信息受限' },
          shareHint: '访客仅能使用授予此链接的能力，密码和有效期始终生效。',
          errors: {
            'archive-password': archives.zhArchives.passwordError,
            'archive-checksum': archives.zhArchives.checksumError,
            'archive-worker': archives.zhArchives.workerError,
            timeout: archives.zhArchives.timeout,
            'history-full': versions.zhVersions.full,
            'metadata-limited': downloads.zhDownloads.metadataLimited,
          },
        },
      },
    },
    en: {
      translation: {
        files: {
          annotations: messages.enAnnotations,
          explorer: explorer.enExplorer,
          versions: versions.enVersions,
          downloads: downloads.enDownloads,
          collaboration: collaboration.enCollaboration,
          workspace: workspace.enWorkspace,
          archives: archives.enArchives,
          shareStatuses: { paused: 'Paused', limited: 'Folder information limited' },
          shareHint:
            'Visitors can use only the capabilities granted to this link. Password and expiration still apply.',
          errors: {
            'archive-password': archives.enArchives.passwordError,
            'archive-checksum': archives.enArchives.checksumError,
            'archive-worker': archives.enArchives.workerError,
            timeout: archives.enArchives.timeout,
            'history-full': versions.enVersions.full,
            'metadata-limited': downloads.enDownloads.metadataLimited,
          },
        },
      },
    },
  };
}

/** loadPublicFileMessages 仅在访客运行域补齐协作文案。 */
export async function loadPublicFileMessages(): Promise<TranslationResources> {
  const messages = await import('../../plugins/file-shares/collaboration-i18n');
  return {
    'zh-CN': {
      translation: {
        publicFiles: {
          collaboration: messages.zhPublicCollaboration,
          errors: messages.zhPublicErrors,
        },
      },
    },
    en: {
      translation: {
        publicFiles: {
          collaboration: messages.enPublicCollaboration,
          errors: messages.enPublicErrors,
        },
      },
    },
  };
}
