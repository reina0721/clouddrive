/**
 * Product Surface —— Surface 层语义资产文案。
 *
 * Plugin 自己的页面文案留在各自 i18n 模块；此处只放真正跨 Plugin 的 Surface
 * 层语义资产：
 * - shellNavigationGroups.*：plugins 范围公共 Group Alias（navigation-groups.ts）
 *   的 labelKey 翻译（Group Alias 属 Surface 治理的公共 IA）。
 * - productStates.*：产品状态语义的标准文案（loading/empty/error/.../retry），
 *   /states Authority 页与各 StateSurface 展示方共用同一套语义。
 * 页面专有词（如 page-archetypes 的 reference/formReference）随插件私有声明。
 * 由 Composition pipeline 与 Plugin i18n 一起聚合进 Host 运行时。
 */

import { identityI18n } from './identity/i18n';
export const surfaceShellI18nResources = {
  'zh-CN': {
    translation: {
      administration: {
        tokens: 'API 令牌',
        security: '安全设置',
        assignment: '组织分配',
        positions: '岗位管理',
        permissions: '权限',
        runtime: '运行状态',
        adminActions: '账户管理',
      },
      ...identityI18n['zh-CN'],
      shellNavigationGroups: {
        overview: '概览',
        management: '身份与访问',
        administration: '系统管理',
        system: '个人',
        development: '开发中心',
      },
      productStates: {
        eyebrow: 'Product semantics',
        title: '正常结果之外，状态也是产品的一部分',
        description: '共享状态语义让 Web 与 Desktop 在失败、等待与受限场景中保持一致且可预测。',
        retry: '重新尝试',
        loading: {
          title: '正在同步界面能力',
          description: '保留结构节奏，避免用全屏空白打断用户。',
        },
        empty: {
          title: '这里还没有内容',
          description: '说明空状态原因，并给出下一步而不是留下空白卡片。',
        },
        error: {
          title: '加载未完成',
          description: '保留原始失败语义，在当前决策边界提供恢复动作。',
        },
        recovered: {
          title: '能力已经恢复',
          description: '重新尝试已完成，当前成功结果替代了先前失败状态。',
        },
        success: { title: '更改已经保存', description: '成功反馈简短、明确，不制造额外确认步骤。' },
        warning: {
          title: '部分能力受到限制',
          description: '说明影响范围，健康路径不会被误记为错误。',
        },
        disabled: { title: '操作当前不可用', description: '禁用原因可理解，不能只降低透明度。' },
        pending: {
          title: '等待后台确认',
          description: 'Pending 与 Loading 分离，避免误导用户重复提交。',
        },
        offline: {
          title: '当前处于离线状态',
          description: '保留设备内可用能力，并标明数据新鲜度。',
        },
        'permission-denied': {
          title: '没有访问权限',
          description: '不泄露受保护内容，同时给出申请权限路径。',
        },
      },
    },
  },
  en: {
    translation: {
      administration: {
        tokens: 'API tokens',
        security: 'Security settings',
        assignment: 'Organization assignments',
        positions: 'Positions',
        permissions: 'Permissions',
        runtime: 'Runtime status',
        adminActions: 'Account administration',
      },
      ...identityI18n.en,
      shellNavigationGroups: {
        overview: 'Overview',
        management: 'Identity and access',
        administration: 'System administration',
        system: 'Personal',
        development: 'Developer center',
      },
      productStates: {
        eyebrow: 'Product semantics',
        title: 'Product states matter beyond the happy path',
        description:
          'Shared semantics keep Web and Desktop predictable through failure, waiting, and access limits.',
        retry: 'Try again',
        loading: {
          title: 'Synchronizing interface capabilities',
          description: 'Preserve layout rhythm instead of interrupting users with a blank screen.',
        },
        empty: {
          title: 'Nothing here yet',
          description: 'Explain why the state is empty and offer a meaningful next step.',
        },
        error: {
          title: 'Loading did not finish',
          description: 'Preserve failure semantics and offer recovery at the decision boundary.',
        },
        recovered: {
          title: 'Capability restored',
          description:
            'The retry completed and the current success result replaced the prior failure.',
        },
        success: {
          title: 'Changes saved',
          description: 'Success feedback stays brief and avoids unnecessary confirmation steps.',
        },
        warning: {
          title: 'Some capabilities are limited',
          description: 'Describe impact without presenting a healthy path as an error.',
        },
        disabled: {
          title: 'Action unavailable',
          description: 'A disabled action explains why instead of only reducing opacity.',
        },
        pending: {
          title: 'Waiting for confirmation',
          description: 'Pending stays distinct from loading to prevent duplicate submissions.',
        },
        offline: {
          title: 'You are offline',
          description: 'Keep device-local capabilities available and state data freshness.',
        },
        'permission-denied': {
          title: 'Access denied',
          description: 'Protect content while offering a path to request access.',
        },
      },
    },
  },
} as const;
