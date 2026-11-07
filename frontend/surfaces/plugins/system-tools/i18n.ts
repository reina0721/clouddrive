export const pluginI18nResources = {
  'zh-CN': {
    translation: {
      systemTools: {
        nav: {
          root: '系统工具',
          icons: 'Icon 大全',
          files: '文件清单',
          blobs: '文件 Blob',
          filesystem: '文件系统',
          shares: '分享管理',
        },
        icons: {
          title: 'Icon 大全',
          description:
            '遍历 Product Surface 受控语义 icon vocabulary，确认每个 iconId 的展示形态。',
        },
      },
    },
  },
  en: {
    translation: {
      systemTools: {
        nav: {
          root: 'System Tools',
          icons: 'Icon Gallery',
          files: 'File inventory',
          blobs: 'File blobs',
          filesystem: 'File system',
          shares: 'Manage shares',
        },
        icons: {
          title: 'Icon Gallery',
          description:
            'Iterates the Product Surface controlled semantic icon vocabulary and shows each iconId presentation.',
        },
      },
    },
  },
} as const;
