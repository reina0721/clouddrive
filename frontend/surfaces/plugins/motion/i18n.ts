export const pluginI18nResources = {
  'zh-CN': {
    translation: {
      motionNav: {
        root: 'Motion',
      },
      motionContent: {
        revealDescription: '标题和独立内容项随滚动首次进入视口，按阅读顺序短错峰；反向浏览不重播。',
        item: '独立阅读项 {{index}}',
        itemDescription:
          '每项独立观察。快速滚动、焦点进入和恢复位置直接稳定；减少动效时内容立即可用。',
      },
    },
  },
  en: {
    translation: {
      motionNav: {
        root: 'Motion',
      },
      motionContent: {
        revealDescription:
          'Headings and independent items enter once in reading order as you scroll, with a brief stagger. Scrolling back does not replay them.',
        item: 'Independent reading item {{index}}',
        itemDescription:
          'Each item is observed independently. Fast scrolling, focus and restored positions settle immediately. Reduced motion keeps content available.',
      },
    },
  },
} as const;
