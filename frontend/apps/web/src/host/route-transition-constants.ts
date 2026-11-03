/**
 * Host 路由转场常量。
 *
 * `markForwardRouteIntent` 在 Router 提交前把「前进」意图写入
 * `document.documentElement.dataset.routeIntent`；RouteTransition 读取后设
 * `data-route-kind=forward`，surface-foundation CSS 据此选择方向位移 recipe。
 *
 * 注意：`transitionTypes` prop（传给 Next Link/router）是为 React ViewTransition
 * 保留的类型标记；本 Host 的方向过渡由 data-route-kind + CSS 实现，不依赖
 * ViewTransition，因此这里不再定义 ViewTransition class 映射。
 */
export const pageTransitionTypes = {
  forward: 'nav-forward',
} as const;

/** markForwardRouteIntent 在 Router 提交前记录 Host 导航意图，供真实 DOM 内容进场选择延迟。 */
export function markForwardRouteIntent() {
  document.documentElement.dataset.routeIntent = 'forward';
}
