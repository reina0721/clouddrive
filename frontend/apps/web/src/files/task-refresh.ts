const fileTaskRefreshIntervalMs = 5000;

/** watchFileTaskRefresh 只在前台刷新当前账号，页面和账号均可释放订阅。 */
export function watchFileTaskRefresh(
  assertCurrent: () => void,
  cleanups: Set<() => void>,
  refresh: () => void,
) {
  assertCurrent();
  let closed = false;
  const tick = () => {
    if (closed || document.visibilityState !== 'visible') return;
    try {
      assertCurrent();
    } catch {
      cleanup();
      return;
    }
    refresh();
  };
  const timer = window.setInterval(tick, fileTaskRefreshIntervalMs);
  const cleanup = () => {
    if (closed) return;
    closed = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', tick);
    cleanups.delete(cleanup);
  };
  document.addEventListener('visibilitychange', tick);
  cleanups.add(cleanup);
  return cleanup;
}
