export const pluginI18nResources = {
  'zh-CN': {
    translation: {
      systemSettings: {
        currentValue: '已保存状态',
        open: '开放注册',
        closed: '关闭注册',
        updatedAt: '最后更新时间',
        nav: '系统配置',
        title: '注册策略',
        description: '管理新账号的注册入口与默认角色；已有账号保持原有授权。',
        enabled: '开放公开注册',
        enabledHint: '关闭后拒绝新的公开注册，已有账号仍可登录。',
        role: '注册账号默认角色',
        roleHint: '仅可选择不含授权管理或系统写权限的角色，实际角色在提交注册时分配。',
        save: '保存策略',
        reset: '恢复已保存值',
        confirm: '确认注册策略变更',
        impact: '变更将立即影响新的注册请求，不修改已有账号的角色。',
        cancel: '取消',
        saved: '注册策略已保存',
        failure: '策略保存失败，请检查错误并重试。',
        readonly: '你可以查看策略，但没有修改权限。',
        invalid: '请选择有效的默认角色。',
        permissions: '所选角色的权限',
        noPermissions: '该角色没有授予权限。',
      },
    },
  },
  en: {
    translation: {
      systemSettings: {
        currentValue: 'Saved state',
        open: 'Registration open',
        closed: 'Registration closed',
        updatedAt: 'Last updated',
        nav: 'System configuration',
        title: 'Registration policy',
        description:
          'Manage public registration and the default role for new accounts. Existing grants remain unchanged.',
        enabled: 'Allow public registration',
        enabledHint:
          'Disabling registration rejects new signups. Existing accounts can still sign in.',
        role: 'Default role for registered accounts',
        roleHint:
          'Roles with grant-management or system-write permissions cannot be selected. The role is assigned when registration is submitted.',
        save: 'Save policy',
        reset: 'Restore saved values',
        confirm: 'Confirm registration policy changes',
        impact:
          'Changes apply immediately to new registrations without changing existing account roles.',
        cancel: 'Cancel',
        saved: 'Registration policy saved',
        failure: 'The policy could not be saved. Review the error and retry.',
        readonly: 'You can view this policy but do not have permission to change it.',
        invalid: 'Select a valid default role.',
        permissions: 'Selected role permissions',
        noPermissions: 'This role grants no permissions.',
      },
    },
  },
} as const;
