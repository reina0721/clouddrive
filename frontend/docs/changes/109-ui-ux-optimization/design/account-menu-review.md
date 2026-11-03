# UserIdentity 与账户菜单专项

2026-10-09，延续108审查与109实施，用户参考图用于信息结构校准。

## 发现与现役能力

浏览器实测原菜单：语言、主题、设置平铺，无当前值和明确选择；设置说明堆放八分类。
UserIdentity是Avatar/姓名/说明展示组件，不拥有认证与操作。顶栏现役资料Rin/产品负责人
是基座展示身份，无真实邮箱、资料路由、帮助中心、会话或退出能力，本轮不伪造这些入口。

MenuButton原为平铺MenuAction；PopoverCard用于说明，NavigationFlyout用于侧栏导航，
均不替代账户操作集合。已核对全部MenuButton消费者：顶栏账户、PageTabs溢出入口、UI Overlay权威。
原平铺消费者保留契约，账户与权威页共同使用扩展分组/二级能力。

偏好真相源是既有Shell Store：localeRegion.language支持zh-CN/en，appearance.themeMode
支持light/dark/system。持久化key/version/migrate不变，沿用既有Host解析系统主题。

## 外部校准与方案

实测 [TailAdmin React Dropdowns](https://react-demo.tailadmin.com/dropdowns) 关闭态、
Options分隔组打开态、顶栏用户菜单打开态。参考图/页面体现身份置顶、图标对齐、
分隔语义组、语言当前值、会话单列。只学习组织规律，不复制源码、DOM、CSS或具体尺寸。
[HeroUI官方Dropdown](https://heroui.com/en/docs/react/components/dropdown)提供公开
Section/Header/Separator、SubmenuTrigger和单选状态，已核对安装版3.2.4。

1. 顶栏桌面Avatar+Rin、手机Avatar，完整角色集中在菜单身份摘要，减少触发器重复说明。
2. 偏好组：语言/当前语言、主题/当前模式，各自二级单选，保留显式勾选。
3. 应用组：真实设置中心入口，删除长说明，保留现役路由和离开确认。
4. 顶部快捷主题/语言按钮保留，显式选择与快捷切换同步同一Store；跟随系统仍可选。
5. 原生名称简体中文/English通过i18n资源提供。当前无RTL语言，不增加国旗或虚假地区。
   选择即时更新界面、关闭菜单并保存；重开有当前值，刷新保持。

## 复用、边界与修复

AccountMenu是Host Shell组合；UserIdentity/Avatar默认行为不变，导航回调继续由AppShell
负责。MenuButton扩展items/groups互斥契约、MenuGroup/MenuChoice稳定语义，不透传vendor
props/slot。身份作为首组Header，头像仅装饰，保留可访问姓名与角色文本。

邻接/向下层叠是明确布局语义；实际viewport判定归Host。HeroUI仍管理同一浮层树的
定位、自动翻转、Selection、Keyboard、Focus、外部关闭和Escape，无自制鼠标计时器或
独立弹窗堆叠。语义宽度/最大高度与滚动限制复用现役Token和HeroUI计算值，无新Token。

专项捕捉到默认缩放入场与选中English聚焦滚动冲突，造成刷新后父菜单移出视口。
最终采用现役content-fade-in/out Primitive与control duration的淡入淡出，取消缩放和
transform预建层，保留vendor lifecycle。未使用固定位置补偿、重置页面滚动、关闭键盘
自动聚焦或放宽边界；滚动后sticky顶栏定位继续验证。Reduced与高对比度沿用统一Policy。

UI Overlay权威新增同源分组/二级示例，原平铺危险/禁用示例保留。验证登记更新原Contract。

## 验证

测试与当前成绩见[验证记录](../evidence/account-menu-verification.md)。
本轮4项新视觉差异已获独立人工确认，并限定更新；上轮28项批准未用于覆盖新变化。
