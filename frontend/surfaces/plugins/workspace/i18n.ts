export const pluginI18nResources = {
  'zh-CN': {
    translation: {
      workspace: {
        management: {
          title: '管理概览',
          description: '从维护任务出发，管理文件、访问权限与站点运行。',
          backToFiles: '返回我的文件',
          loading: '正在读取可用的管理入口…',
          navigationFailure: '暂时无法读取管理入口',
          navigationFailureHint: '请重试。已有数据和设置不会因此改变。',
          noAccessTitle: '当前账户没有可用的管理入口',
          noAccessHint: '可从账户菜单查看自己的资料；如需管理权限，请联系站点管理员。',
          countsTitle: '账户与角色',
          addTodo: '添加待办',
          addTodoHint: '记下需要跟进的一件事。',
          completeTodo: '完成待办',
          completeTodoHint: '确认这件事已经处理完毕。',
          noTodos: '暂无待办',
          todosHint: '个人待办独立保存，不影响文件和站点设置。',
          todoStatus: { pending: '待完成', completed: '已完成' },
          groups: {
            files: '文件与协作',
            access: '身份与访问',
            operations: '任务与运行',
            site: '站点设置',
          },
          tasks: {
            filesystem: '配置文件浏览、编辑应用与回收规则。',
            storage: '查看存储用量，维护文件大小与名称规则。',
            inventory: '按所有者和文件状态查找条目。',
            shares: '查看分享范围与活动，按需撤销链接。',
            users: '查找账户，维护资料与账户状态。',
            accounts: '管理账户凭据、会话与安全状态。',
            roles: '组织角色并核对其权限。',
            permissions: '查阅各模块提供的原生权限。',
            departments: '维护部门层级与基本信息。',
            assignments: '将账户分配到部门和岗位。',
            positions: '维护岗位与组织职责。',
            audit: '追溯关键操作的结果与时间。',
            tasks: '检查跨账户任务，处理可清理的终态记录。',
            nodes: '检查下载节点的连接与任务职责。',
            runtime: '查看服务就绪、诊断与运行指标。',
            blobs: '核对内容引用，管理待回收对象。',
            settings: '维护站点信息与系统配置。',
            menus: '调整导航入口的名称、顺序与可见性。',
            dictionaries: '维护业务词典及其条目。',
          },
        },
        nav: '管理概览',
        eyebrow: '工作空间',
        title: '个人工作区',
        description: '问候、快捷入口、项目、最新动态与今日待办的统一入口。',

        demo: {
          title: '演示数据（Mode: demo）',
          description:
            '项目、动态与待办都是固定的演示数据，仅用于验证工作台信息架构；待办完成状态会保存在此浏览器。',
        },

        greeting: {
          pending: '你好，{{name}}',
          morning: '早安，{{name}}',
          afternoon: '午安，{{name}}',
          evening: '晚上好，{{name}}',
          fallbackName: '同事',
          subtitle: '今天也把最重要的事情推进一点。',
        },

        stats: {
          todosLabel: '待办',
          todosValue: '{{done}}/{{total}}',
          projectsLabel: '项目',
          projectsValue: '{{count}}',
          teamsLabel: '团队',
          teamsValue: '{{count}}',
        },

        quickNav: {
          title: '快捷导航',
          description: '常用管理入口，全部通过 symbolic route 跳转。',
          users: '用户管理',
          usersDescription: '查找用户、维护资料与账号状态。',
          roles: '角色管理',
          rolesDescription: '维护角色与权限边界。',
          audit: '审计日志',
          auditDescription: '复核关键操作的只读记录。',
          settings: '设置中心',
          settingsDescription: '调整界面、语言与可访问性偏好。',
          analytics: '分析',
          analyticsDescription: '查看演示的流量与使用趋势。',
          workspace: '个人工作区',
          workspaceDescription: '回到这个总览页面。',
        },

        projects: {
          title: '我的项目',
          description: '最近参与的项目与当前状态。',
          members: '{{count}} 位成员',
          group: {
            product: '产品',
            design: '设计',
            operations: '运营',
            research: '研究',
          },
          aurora: {
            name: 'Aurora 控制台',
            quote: '统一身份与访问治理的下一个里程碑，优先保证审计可追溯。',
          },
          nebula: {
            name: 'Nebula 设计系统',
            quote: '收敛语义 Token 与组件契约，减少页面级视觉漂移。',
          },
          harbor: {
            name: 'Harbor 运营台',
            quote: '把日常运营动作串成可复盘的流程，而不是散落的表格。',
          },
          atlas: {
            name: 'Atlas 数据门户',
            quote: '为分析能力提供稳定的指标口径与数据字典。',
          },
          lumen: {
            name: 'Lumen 可用性研究',
            quote: '用真实键盘与读屏路径验证工作台的可访问性。',
          },
          orbit: {
            name: 'Orbit 通知中心',
            quote: '按重要度分层呈现通知，避免打断正在进行的任务。',
          },
        },

        activities: {
          title: '最新动态',
          description: '来自团队成员的最近七条动态。',
          item: {
            'activity-1': '更新了「Aurora 控制台」的发布计划。',
            'activity-2': '提交了 Nebula 设计系统的对比度修复。',
            'activity-3': '把 Harbor 运营台的周报模板归档。',
            'activity-4': '完成了 Atlas 数据门户的指标口径评审。',
            'activity-5': '补充了 Lumen 研究的键盘操作记录。',
            'activity-6': '调整了 Orbit 通知中心的重要度分组。',
            'activity-7': '新建了本周的可用性验证任务。',
          },
        },

        people: {
          chen: '陈昱',
          lin: '林嘉',
          ada: 'Ada',
          mo: '莫然',
          kim: 'Kim',
        },

        todos: {
          title: '待办事项',
          description: '勾选后会立即更新问候卡片中的待办计数，并保存在此浏览器。',
          progress: '完成进度',
          reset: '重置待办',
          item: {
            'review-access': '复核本周新增的访问权限申请',
            'publish-release': '发布 2.4.0 版本说明',
            'sync-metrics': '同步周度核心指标',
            'invite-design': '邀请设计与研究同学参加评审',
            'audit-permissions': '审计管理员权限变更记录',
          },
          priority: {
            high: '高优先级',
            normal: '常规',
          },
          empty: {
            title: '今天的待办都完成了',
            description: '可以重置演示待办，重新体验勾选与计数联动。',
            action: '重置演示待办',
          },
          warning: {
            title: '本地待办记录不可用',
            'invalid-record':
              '本地保存的记录无法通过校验，已回退到默认待办；原记录保留未被覆盖，下一次勾选才会写入。',
            'storage-error':
              '无法读取本地待办记录（存储不可用或内容已损坏），已使用默认待办且未覆盖原记录。',
            'unknown-items':
              '本地记录包含已不在演示清单中的待办，已忽略这些条目；其余完成状态保持不变。',
          },
        },
      },
    },
  },
  en: {
    translation: {
      workspace: {
        management: {
          title: 'Administration',
          description: 'Manage files, access and site operations by the task at hand.',
          backToFiles: 'Back to my files',
          loading: 'Loading available administration links…',
          navigationFailure: 'Administration links could not be loaded',
          navigationFailureHint: 'Try again. Existing data and settings are preserved.',
          noAccessTitle: 'No administration links are available for this account',
          noAccessHint:
            'Open your profile from the account menu. Contact the site administrator if you need management access.',
          countsTitle: 'Accounts and roles',
          addTodo: 'Add todo',
          addTodoHint: 'Write down something you need to follow up on.',
          completeTodo: 'Complete todo',
          completeTodoHint: 'Confirm that this task has been taken care of.',
          noTodos: 'No todos yet',
          todosHint: 'Personal todos are saved separately from files and site settings.',
          todoStatus: { pending: 'Pending', completed: 'Completed' },
          groups: {
            files: 'Files and sharing',
            access: 'Identity and access',
            operations: 'Tasks and operations',
            site: 'Site settings',
          },
          tasks: {
            filesystem: 'Configure file browsing, editing apps and retention.',
            storage: 'Review storage usage, file limits and naming rules.',
            inventory: 'Find entries by owner and file status.',
            shares: 'Review link access and activity, and revoke shares when needed.',
            users: 'Find accounts and manage their details and status.',
            accounts: 'Manage account credentials, sessions and security status.',
            roles: 'Organize roles and review their permissions.',
            permissions: 'Review native permissions provided by each module.',
            departments: 'Maintain department hierarchy and details.',
            assignments: 'Assign accounts to departments and positions.',
            positions: 'Maintain positions and organizational responsibilities.',
            audit: 'Trace the outcomes and timing of important actions.',
            tasks: 'Inspect tasks across accounts and clean eligible finished records.',
            nodes: 'Check download node connections and responsibilities.',
            runtime: 'Review service readiness, diagnostics and metrics.',
            blobs: 'Inspect content references and objects awaiting reclamation.',
            settings: 'Maintain site information and system configuration.',
            menus: 'Adjust navigation labels, order and visibility.',
            dictionaries: 'Maintain business dictionaries and their entries.',
          },
        },
        nav: 'Administration',
        eyebrow: 'Personal workspace',
        title: 'Personal workspace',
        description:
          'One entry point for your greeting, quick links, projects, latest activity and today’s todos.',

        demo: {
          title: 'Demo data (Mode: demo)',
          description:
            'Projects, activity and todos are fixed demo data used to validate the workspace information architecture; todo completion is stored in this browser.',
        },

        greeting: {
          pending: 'Hello, {{name}}',
          morning: 'Good morning, {{name}}',
          afternoon: 'Good afternoon, {{name}}',
          evening: 'Good evening, {{name}}',
          fallbackName: 'there',
          subtitle: 'Move the most important thing forward today.',
        },

        stats: {
          todosLabel: 'Todos',
          todosValue: '{{done}}/{{total}}',
          projectsLabel: 'Projects',
          projectsValue: '{{count}}',
          teamsLabel: 'Teams',
          teamsValue: '{{count}}',
        },

        quickNav: {
          title: 'Quick navigation',
          description: 'Common management entry points, all resolved through symbolic routes.',
          users: 'Users',
          usersDescription: 'Find users and maintain profiles and account status.',
          roles: 'Roles',
          rolesDescription: 'Maintain roles and permission boundaries.',
          audit: 'Audit log',
          auditDescription: 'Review read-only records of sensitive operations.',
          settings: 'Settings',
          settingsDescription: 'Adjust interface, language and accessibility preferences.',
          analytics: 'Analytics',
          analyticsDescription: 'Inspect demo traffic and usage trends.',
          workspace: 'Personal workspace',
          workspaceDescription: 'Return to this overview page.',
        },

        projects: {
          title: 'My projects',
          description: 'Projects you contributed to recently and where they stand.',
          members: '{{count}} members',
          group: {
            product: 'Product',
            design: 'Design',
            operations: 'Operations',
            research: 'Research',
          },
          aurora: {
            name: 'Aurora Console',
            quote:
              'The next milestone for unified identity and access governance, auditability first.',
          },
          nebula: {
            name: 'Nebula Design System',
            quote: 'Converge semantic tokens and component contracts to reduce per-page drift.',
          },
          harbor: {
            name: 'Harbor Operations',
            quote: 'Turn daily operations into reviewable flows instead of scattered spreadsheets.',
          },
          atlas: {
            name: 'Atlas Data Portal',
            quote: 'Give analytics a stable metric definition and data dictionary.',
          },
          lumen: {
            name: 'Lumen Usability Study',
            quote: 'Validate workspace accessibility with real keyboard and screen reader paths.',
          },
          orbit: {
            name: 'Orbit Notifications',
            quote: 'Rank notifications by importance so they do not interrupt active work.',
          },
        },

        activities: {
          title: 'Latest activity',
          description: 'The seven most recent updates from your teammates.',
          item: {
            'activity-1': 'updated the Aurora Console release plan.',
            'activity-2': 'shipped a contrast fix for the Nebula design system.',
            'activity-3': 'archived the Harbor weekly report template.',
            'activity-4': 'finished the Atlas metric definition review.',
            'activity-5': 'added keyboard walkthrough notes to the Lumen study.',
            'activity-6': 'reorganized the Orbit notification importance tiers.',
            'activity-7': 'created this week’s usability validation task.',
          },
        },

        people: {
          chen: 'Chen Yu',
          lin: 'Lin Jia',
          ada: 'Ada',
          mo: 'Mo Ran',
          kim: 'Kim',
        },

        todos: {
          title: 'Todos',
          description:
            'Checking a todo updates the todo counter in the greeting card immediately and persists in this browser.',
          progress: 'Completion',
          reset: 'Reset todos',
          item: {
            'review-access': 'Review this week’s new access requests',
            'publish-release': 'Publish the 2.4.0 release notes',
            'sync-metrics': 'Sync the weekly core metrics',
            'invite-design': 'Invite design and research to the review',
            'audit-permissions': 'Audit administrator permission changes',
          },
          priority: {
            high: 'High priority',
            normal: 'Normal',
          },
          empty: {
            title: 'All todos are done today',
            description: 'Reset the demo todos to try the checkbox and counter behaviour again.',
            action: 'Reset demo todos',
          },
          warning: {
            title: 'Local todo record is unavailable',
            'invalid-record':
              'The stored record failed validation, so default todos are shown. The original record was kept and will only be replaced after your next change.',
            'storage-error':
              'The local todo record could not be read (storage unavailable or corrupted). Default todos are shown and the stored record was not overwritten.',
            'unknown-items':
              'The stored record referenced todos that are no longer part of the demo list. Those entries were ignored; other completion states were kept.',
          },
        },
      },
    },
  },
};
