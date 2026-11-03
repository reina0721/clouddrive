# Vben 页面切换动画实测证据

日期：2026-10-27。环境：Windows + Node 24 + Playwright Chromium；`www.vben.pro` 经系统
代理 `127.0.0.1:7897`，Chromium 参数 `--proxy-server=127.0.0.1:7897 --disable-http2`。

## 1. 访问与登录

- 打开 `https://www.vben.pro/`，重定向到 `#/auth/login`；
- 表单预填 `vben / 123456`，需拖过滑块（验证通过后按钮可用）；
- 登录成功进入 `#/dashboard/analytics`。

## 2. 偏好设置结构

顶栏齿轮（tooltip「偏好设置」）打开右侧抽屉，页签为「外观 / 布局 / 快捷键 / 通用 / 拓展」。

「通用」页文本（实测抓取）：

```text
通用 语言 简体中文 时区 Europe/London (GMT+0) 动态标题 水印 定时检查更新
显示复制偏好设置按钮 动画 页面切换进度条 页面切换 Loading 页面切换动画
```

「外观」页无页面切换选项；「布局」页只含布局/侧边栏/标签栏/小部件配置。

结论：演示 UI 只提供「页面切换动画」开关（`role="switch"`，默认 `aria-checked="true"`），
没有动画名下拉。

## 3. 动画名集合（运行期 bundle）

在已登录页面抓取 `performance.getEntriesByType('resource')`，定位
`/js/basic-C1cBGvOD.js`，其中：

```js
c = [`fade`, `fade-slide`, `fade-up`, `fade-down`];
```

与之配套的 props 为 `transitionName / transitionEnable / transitionProgress / transitionLoading`，
即这四个动画名是 Vben 运行期的可选集合。

`/js/preferences-fyDdNSqp.js` 中默认值为：

```js
transition: { enable: !0, loading: !0, name: `fade-slide`, progress: !0 }
```

## 4. CSS recipe 参数（运行期 styleSheets）

从已加载样式表文本抽取：

```css
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-slide-enter-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translate(-30px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translate(30px);
}

.fade-up-enter-active {
  transition:
    opacity 0.2s,
    transform 0.25s;
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateY(10%);
}
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(-10%);
}

.fade-down-enter-from {
  opacity: 0;
  transform: translateY(-10%);
}
.fade-down-leave-to {
  opacity: 0;
  transform: translateY(10%);
}

.fade-scale-enter-from {
  opacity: 0;
  transform: scale(1.2);
}
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
```

`page-route-*` 负责路由容器层：`page-route-container:has(> .fade-slide-enter-active) { overflow-x: hidden; }`，
用于吸收水平位移，避免横向滚动。

## 5. 对实现的约束

| 观察                     | 本项目处理                                                         |
| ------------------------ | ------------------------------------------------------------------ |
| 可选集合 4 个            | 全部实现，外加项目默认 `default` 与 `none`                         |
| 默认 `fade-slide`        | 不采用；用户要求保留本项目默认动画                                 |
| leave 过渡               | 不实现（React 提交模型无同构离场），以 enter 等效                  |
| 30px / 10% 位移          | 不复制，使用 `--motion-distance-enter` Token                       |
| `fade-scale` 未暴露      | 不实现，避免无对照能力                                             |
| 路由容器 overflow-x 处理 | 本项目已有 `.surface-route-content { overflow-x: clip }`，直接复用 |

## 6. 证据限制

- 演示 UI 无动画名下拉，无法在页面上逐项触发并截图四种动画；动画名与默认值来自运行期
  bundle，CSS 参数来自运行期样式表，均属可复现实测数据；
- Vben 后端接口在本次访问中未用于本特性，无相关依赖；
- 未获取/复制 Vben 源码，仅记录运行期观察。
