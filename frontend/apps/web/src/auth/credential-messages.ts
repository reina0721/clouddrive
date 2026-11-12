/** 登录与已登录会话的密码复核共用的消息，不携带登录页面内容。 */
export const credentialMessages = {
  'zh-CN': {
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    errors: {
      'mfa-required': '请输入动态验证码或恢复码。',
      locked: '尝试次数过多，账户暂时锁定，请稍后重试。',
      configuration: '认证配置无效，请联系部署维护者。',
      credentials: '邮箱或密码不正确，请重试。',
      'account-exists': '此邮箱已有账户，请前往登录。',
      expired: '会话已失效，请重新登录。',
      forbidden: '访问被拒绝，请联系管理员。',
      network: '无法连接认证服务，请检查网络后重试。',
      timeout: '认证请求超时，请重试。',
      protocol: '认证响应或本地记录无效，请联系维护者。',
      unavailable: '认证服务或本地存储暂时不可用，请稍后重试。',
    },
  },
  en: {
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    errors: {
      'mfa-required': 'Enter your verification or recovery code.',
      locked: 'Too many attempts. Your account is temporarily locked. Try again later.',
      configuration: 'Authentication configuration is invalid. Contact the deployment owner.',
      credentials: 'Your email or password is incorrect. Try again.',
      'account-exists': 'An account already uses this email. Sign in instead.',
      expired: 'Your session is no longer valid. Sign in again.',
      forbidden: 'Access denied. Contact your administrator.',
      network: 'Cannot reach the authentication service. Check your connection and retry.',
      timeout: 'Authentication timed out. Try again.',
      protocol: 'The authentication response or local record is invalid. Contact the maintainer.',
      unavailable: 'Authentication or local storage is temporarily unavailable. Try again later.',
    },
  },
};
