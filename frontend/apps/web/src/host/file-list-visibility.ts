/** observeFileListEnd 在宿主中订阅尾部可见性，释放后忽略已排队的回调。 */
export function observeFileListEnd(element: HTMLElement, onVisible: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => undefined;
  let observing = true;
  const observer = new IntersectionObserver((entries) => {
    if (observing && entries.some((entry) => entry.isIntersecting)) onVisible();
  });
  observer.observe(element);
  return () => {
    observing = false;
    observer.disconnect();
  };
}
