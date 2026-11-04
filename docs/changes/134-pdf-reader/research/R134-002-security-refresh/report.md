# R134-002：集中验收的安全刷新

事实：pnpm production audit返回19条公告（3 critical、5 high、8 moderate、3 low），模块限于原有Next、Zod、fast-uri、source-map-js与sharp；新增pdfjs-dist未命中。原锁定Next16.3.3、Zod4.5.2；在当前源码/next.config搜索未发现next/og/ImageResponse/use cache/dangerouslyAllowSVG调用，但这不构成所有公告不可达证明。完整审计和官方JSON快照存于ignored .data，交付报告只保留模块、公告与结果，不保留任何凭据。

官方证据：Next [v16.4.5 release](https://github.com/vercel/next.js/releases/tag/v16.4.5)于11月3日发布，包含本月进一步缓存、代理响应和SVG安全修复；只升16.3.8仍不能覆盖公告中的16.4.1修复下界。npm registry exact16.4.5返回200、MIT、Node>=20.9，与现有Node24.19/项目>=22.18和React19兼容。Zod [官方仓库](https://github.com/colinhacks/zod)及[GitHub安全数据库](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)说明小于4.6.6的集合校验内存问题；exact registry4.6.6返回200、MIT。fast-uri exact3.1.9返回200、BSD-3-Clause；公告的修复下界3.1.9。source-map-js下界1.2.2，sharp下界0.35.5，Next16.4.5的官方optionalDependencies已要求sharp^0.35.5。

判断：延续成熟Next/Zod/Ajv体系和当前composition，升级同一主版本中已修复版本，收益是移除明确命中公告而非架构换新。Next全部声明统一16.4.5，Zod全部声明统一4.6.6，不能保留第二套旧版本。对Ajv内部fast-uri、PostCSS内部source-map-js使用父依赖限定的精确修复覆盖，避免新增没有调用方的顶层直接依赖。退出条件：上游父依赖的实际解析下界已保证修复版本时移除覆盖；任何API/路由/预算回归须定向处理，不提高旧预算、不增加兼容双轨。

门禁通过：候选均有当前官方版本证据，不需要新业务边界、迁移或数据操作。修复限于dependency声明/锁定及其必要验证；PDF20项已接通后才开始本轮验证，此安全修复属于集中验证发现的问题修复，不计为额外20项功能。所有受影响前端验证和两份生产构建必须在最终版本重新执行；Go实现不因JS依赖变化重开研究。
