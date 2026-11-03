/**
 * Product Surface —— Shell 公共导出。
 *
 * 只导出 Registry→Shell model 转换、icon vocabulary（受控 semantic presentation
 * metadata）与 i18n 资源，不暴露 plugins/* 内部实现；Host 通过 Composition Root
 * 装配。Group Alias 属 plugins 范围公共 IA（plugins/navigation-groups.ts），
 * 不从这里导出。
 */

export {
  convertRegistryToShellNavigation,
  navigationIconVocabulary,
  UNKNOWN_NAVIGATION_ICON,
  collectUnknownNavigationIconDiagnostics,
  type NavigationIconId,
  type NavigationIconReference,
  type NavigationIconDiagnostic,
} from './shell-model';

export { surfaceShellI18nResources } from './i18n';
export { loadAdministrationMessages } from './administration/messages';
export { mergeTranslationResources, type SurfaceComposition } from './composition';
