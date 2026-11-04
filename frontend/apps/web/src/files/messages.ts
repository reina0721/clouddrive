import { loadFileAnnotationMessages } from '@clouddrive/surface/files/runtime';
import { appI18n } from '../i18n/i18n';

/** initializeFileMessages 在挂载文件Surface之前补齐私有整理界面文案。 */
export async function initializeFileMessages(): Promise<void> {
  appI18n.addResources(await loadFileAnnotationMessages());
}
