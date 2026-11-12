import { credentialMessages } from '../auth/credential-messages';

export const lockScreenResources = {
  'zh-CN': {
    translation: {
      auth: credentialMessages['zh-CN'],
      shell: {
        lock: {
          title: '锁屏',
          idleTitle: '因长时间无操作已锁定',
          subtitle: '{{name}}，请输入当前账号密码继续。',
          password: '账号密码',
          passwordRequired: '请输入密码。',
          unlock: '解锁',
          checking: '正在验证…',
          errorDescription: '密码复核未通过，内容保持锁定。',
          lockedDescription: '错误次数已达到账号限制，请等待锁定时间结束后重试，或退出登录。',
          signInDescription: '当前会话已失效或账号需要处理，请退出后重新登录。',
          clientOnly: '客户端锁定：清除本站数据或新开标签页即可绕过，不构成安全边界。',
        },
      },
    },
  },
  en: {
    translation: {
      auth: credentialMessages.en,
      shell: {
        lock: {
          title: 'Locked',
          idleTitle: 'Locked after inactivity',
          subtitle: '{{name}}, enter your account password to continue.',
          password: 'Account password',
          passwordRequired: 'Enter your password.',
          unlock: 'Unlock',
          checking: 'Checking…',
          errorDescription: 'The password check failed; content stays locked.',
          lockedDescription:
            'The account attempt limit was reached. Wait for the lockout to expire, or sign out.',
          signInDescription:
            'The session expired or the account needs attention. Sign out and sign in again.',
          clientOnly:
            'Client-side lock: clearing site data or opening a new tab bypasses it. Not a security boundary.',
        },
      },
    },
  },
};
