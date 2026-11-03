export const pluginI18nResources = {
  'zh-CN': {
    translation: {
      foundationsNav: {
        root: '基座能力',
      },
      foundations: {
        eyebrow: 'Architecture map',
        title: '稳定能力向下沉，运行差异留在 Host',
        description: '依赖只能朝向更稳定的契约。目录不是目的，变化传播范围才是设计对象。',
        favoritesTitle: '收藏',
        recentsTitle: '最近访问',
        directUse: 'HeroUI 直接使用范围',
        directUseDescription: '只有 UI Adapter 可以导入 @heroui/*；页面只消费语义化 UI Contract。',
        layers: {
          hosts: 'Runtime Hosts',
          hostsDescription:
            '当前唯一 Web Host：Next 路由、浏览器生命周期与平台 Adapter 装配。Application = Product Surface × Runtime Host。',
          application: 'Product Surface',
          applicationDescription:
            'Surface Foundation、Plugin Framework 与插件承载当前后台产品的页面与业务组合。',
          adapters: 'Adapters',
          adaptersDescription: 'UI Library、数据源、浏览器与 Desktop 能力的差异吸收层。',
          stable: 'Universal Frontend Foundation',
          stableDescription:
            'Design System、UI Adapter、Form、i18n、Core、Schema、Types 与 State 提供通用能力。',
        },
        rulesTitle: '依赖规则',
        rules: {
          first: 'Core 不导入 React、Host 或 Infrastructure。',
          second: 'Host 专属能力不得下沉到共享 Core。',
          third: '页面不穿透 Adapter 修改 HeroUI 内部 DOM。',
          fourth: '局部差异优先使用 Variant 与 Composition。',
        },
      },
    },
  },
  en: {
    translation: {
      foundationsNav: {
        root: 'Foundations',
      },
      foundations: {
        eyebrow: 'Architecture map',
        title: 'Stable capabilities sink; runtime differences stay in hosts',
        description:
          'Dependencies point toward stable contracts. Folders are incidental; change propagation is the design target.',
        favoritesTitle: 'Favorites',
        recentsTitle: 'Recent visits',
        directUse: 'Direct HeroUI usage',
        directUseDescription:
          'Only the UI Adapter may import @heroui/*; screens consume semantic UI contracts.',
        layers: {
          hosts: 'Runtime Hosts',
          hostsDescription:
            'The single Web Host owns Next routing, browser lifecycle and adapter composition. Application = Product Surface × Runtime Host.',
          application: 'Application / Feature',
          applicationDescription:
            'Surface Foundation, Plugin Framework and plugins compose the current administration product.',
          adapters: 'Adapters',
          adaptersDescription:
            'Absorb differences in UI libraries, data sources, browsers, and Desktop runtimes.',
          stable: 'Core · Schema · Types',
          stableDescription:
            'Design System, UI Adapter, Form, i18n, Core, Schemas, Types and State provide universal capabilities.',
        },
        rulesTitle: 'Dependency rules',
        rules: {
          first: 'Core never imports React, hosts, or infrastructure.',
          second: 'Host-specific capabilities never leak into shared Core.',
          third: 'Screens never pierce the Adapter to style HeroUI internals.',
          fourth: 'Local differences use variants and composition first.',
        },
      },
    },
  },
} as const;
