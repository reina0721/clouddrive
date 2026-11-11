import {
  deniedSharePermissions,
  initialShareAudience,
  type ShareAudience,
} from '../../../src/files/sharing';

export type ShareAudienceChoice = 'anyone' | 'signed-in' | 'custom';

/** 仅识别完全匹配的简单策略；具体账号、角色和能力覆盖均保留为自定义。 */
export function shareAudienceChoice(value: ShareAudience): ShareAudienceChoice {
  if (value.accounts.length || value.roles.length || value.authenticated !== null) return 'custom';
  if (value.anonymous === null) return 'anyone';
  return Object.values(value.anonymous).some(Boolean) ? 'custom' : 'signed-in';
}

export function simpleShareAudience(choice: Exclude<ShareAudienceChoice, 'custom'>): ShareAudience {
  return {
    ...initialShareAudience(),
    anonymous: choice === 'signed-in' ? { ...deniedSharePermissions } : null,
  };
}
