/** 两个 dev 入口共享同一显式选项；不在编译器失败时静默切换。 */
export function nextDevOptions(environment = process.env) {
  const bundler = environment.CLOUDDRIVE_DEV_BUNDLER;
  if (bundler && bundler !== 'webpack' && bundler !== 'turbopack') {
    throw new Error('CLOUDDRIVE_DEV_BUNDLER must be webpack or turbopack.');
  }
  return bundler === 'webpack' ? ['--webpack'] : [];
}
