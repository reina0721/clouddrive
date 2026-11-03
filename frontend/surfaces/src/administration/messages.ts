/** Product management messages load with the session runtime, before its pages render. */
export async function loadAdministrationMessages() {
  const [{ administrationI18n }, { managementI18n }] = await Promise.all([
    import('./i18n'),
    import('../identity/management-i18n'),
  ]);
  return {
    'zh-CN': { translation: { ...administrationI18n['zh-CN'], ...managementI18n['zh-CN'] } },
    en: { translation: { ...administrationI18n.en, ...managementI18n.en } },
  };
}
