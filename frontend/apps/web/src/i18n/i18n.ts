import { createFrontendI18n, type TranslationResources } from '@clouddrive/i18n';
import { mergeTranslationResources } from '@clouddrive/surface/shell';
import { generatedSurfaceI18nResources } from '@clouddrive/surface/generated/composition';

import { resources } from './resources';

export type SupportedLocale = 'zh-CN' | 'en';

const compositionResources: TranslationResources = mergeTranslationResources(
  resources,
  generatedSurfaceI18nResources,
);

export const appI18n = createFrontendI18n({
  resources: compositionResources,
  defaultLocale: 'zh-CN',
  supportedLocales: ['zh-CN', 'en'],
});
