export const pluginI18nResources = {
  'zh-CN': {
    translation: {
      analytics: {
        nav: '分析',
        eyebrow: '业务概览',
        title: '分析',
        description:
          '用确定性演示数据查看用户量、访问量、下载量与使用量的变化，并核对趋势与来源结构。',

        demo: {
          title: '演示数据（Mode: mock）',
          description:
            '本页所有数字来自 seeded 演示数据集（固定锚点日期），不代表生产指标；刷新不会改变结果。',
          controls: '演示控制',
          empty: '演示空数据',
          failure: '模拟刷新失败',
        },

        toolbar: { label: '分析工具栏' },
        range: {
          label: '时间范围',
          7: '近 7 天',
          30: '近 30 天',
          90: '近 90 天',
        },
        refresh: '刷新数据',

        async: {
          label: '分析数据区域',
          loading: '正在加载分析数据',
          refreshing: '正在刷新数据…',
        },

        empty: {
          title: '暂无分析数据',
          description: '当前演示场景为空数据集。关闭「演示空数据」或刷新以恢复。',
          action: '关闭演示空数据',
        },
        error: {
          title: '分析数据加载失败',
          description: '已按「模拟刷新失败」注入失败。关闭该开关后重试。',
          action: '重试',
        },

        kpi: {
          users: { label: '用户量' },
          visits: { label: '访问量' },
          downloads: { label: '下载量' },
          usage: { label: '使用量' },
          up: '上升',
          down: '下降',
          vsPrevious: '较上一周期',
          total: '总量',
          sparklineLabel: '{{metric}}趋势',
        },

        trend: {
          title: '流量趋势',
          description: '按天查看访问量与下载量；切换指标不改变已选择的时间范围。',
          tabsLabel: '趋势指标',
          tab: { traffic: '流量趋势', visitors: '访问数量' },
          chart: {
            traffic: '访问量与下载量趋势',
            visitors: '独立访客数量趋势',
          },
          summary: '最近 {{range}} 天，按天聚合；数据点可用左右方向键切换。',
        },

        metric: {
          visits: '访问量',
          downloads: '下载量',
          uniqueVisitors: '独立访客',
        },

        sources: {
          title: '访问来源',
          description: '演示访问的渠道构成。',
          chartLabel: '访问来源构成',
          direct: '直接访问',
          organic: '自然搜索',
          referral: '外部引荐',
          social: '社交媒体',
        },

        devices: {
          title: '设备分布',
          description: '演示访问的终端构成。',
          chartLabel: '设备分布构成',
          desktop: '桌面端',
          mobile: '移动端',
          tablet: '平板',
        },

        pages: {
          title: '页面排行',
          description: '访问量最高的前 5 个页面。',
          caption: '页面访问量前五名',
          column: { page: '页面', views: '访问量' },
          share: '占比',
        },

        footer: '统计窗口：最近 {{days}} 天；演示数据集固定不变。',
      },
    },
  },
  en: {
    translation: {
      analytics: {
        nav: 'Analytics',
        eyebrow: 'Business overview',
        title: 'Analytics',
        description:
          'Review user, visit, download and usage movement from deterministic demo data, and inspect trends and acquisition mix.',

        demo: {
          title: 'Demo data (Mode: mock)',
          description:
            'Every number on this page comes from a seeded demo dataset with a fixed anchor date. It is not production telemetry, and refreshing does not change it.',
          controls: 'Demo controls',
          empty: 'Demo empty data',
          failure: 'Simulate refresh failure',
        },

        toolbar: { label: 'Analytics toolbar' },
        range: {
          label: 'Time range',
          7: 'Last 7 days',
          30: 'Last 30 days',
          90: 'Last 90 days',
        },
        refresh: 'Refresh data',

        async: {
          label: 'Analytics data region',
          loading: 'Loading analytics data',
          refreshing: 'Refreshing data…',
        },

        empty: {
          title: 'No analytics data',
          description:
            'The demo scenario currently returns an empty dataset. Turn off “Demo empty data” or refresh to restore.',
          action: 'Turn off demo empty data',
        },
        error: {
          title: 'Analytics data failed to load',
          description:
            'The failure was injected by “Simulate refresh failure”. Turn that toggle off and retry.',
          action: 'Retry',
        },

        kpi: {
          users: { label: 'Users' },
          visits: { label: 'Visits' },
          downloads: { label: 'Downloads' },
          usage: { label: 'Usage' },
          up: 'Increased',
          down: 'Decreased',
          vsPrevious: 'vs previous period',
          total: 'All-time total',
          sparklineLabel: '{{metric}} trend',
        },

        trend: {
          title: 'Traffic trend',
          description:
            'Inspect visits and downloads by day. Switching the metric keeps the selected time range.',
          tabsLabel: 'Trend metric',
          tab: { traffic: 'Traffic trend', visitors: 'Visitor count' },
          chart: {
            traffic: 'Visits and downloads trend',
            visitors: 'Unique visitors trend',
          },
          summary:
            'Last {{range}} days, aggregated by day. Use left and right arrows to move between data points.',
        },

        metric: {
          visits: 'Visits',
          downloads: 'Downloads',
          uniqueVisitors: 'Unique visitors',
        },

        sources: {
          title: 'Traffic sources',
          description: 'Channel mix of demo visits.',
          chartLabel: 'Traffic source mix',
          direct: 'Direct',
          organic: 'Organic search',
          referral: 'Referral',
          social: 'Social',
        },

        devices: {
          title: 'Device mix',
          description: 'Device distribution of demo visits.',
          chartLabel: 'Device mix',
          desktop: 'Desktop',
          mobile: 'Mobile',
          tablet: 'Tablet',
        },

        pages: {
          title: 'Top pages',
          description: 'The five pages with the most visits.',
          caption: 'Top five pages by visits',
          column: { page: 'Page', views: 'Visits' },
          share: 'Share',
        },

        footer: 'Reporting window: last {{days}} days. The demo dataset is fixed.',
      },
    },
  },
};
