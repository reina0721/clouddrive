import type { TranslationResources } from '@clouddrive/i18n';

/** loadFileAnnotationMessages 只在文件运行域加载整理界面文案，不增加登录首屏资源。 */
export async function loadFileAnnotationMessages(): Promise<TranslationResources> {
  const messages = await import('../../plugins/files/annotations-i18n');
  return {
    'zh-CN': { translation: { files: { annotations: messages.zhAnnotations } } },
    en: { translation: { files: { annotations: messages.enAnnotations } } },
  };
}
