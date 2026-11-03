# 实施前研究

十四组浏览器页面与截图见 [清单](../evidence/before/inventory.json)。复用现有多选表格、Collection 与表单；移动审计内部控件裁切是本轮确认问题。

日期控件扩展前复核 [TailAdmin Form Elements](https://react-demo.tailadmin.com/form-elements)：实际打开 Date Picker Input，检查标签、焦点、日历浮层、选中与关闭态，以及同页禁用／错误输入层级。仅校准视觉规律，不复制 DOM、CSS 或尺寸。官方受控值依据为 [HeroUI DatePicker](https://heroui.com/en/docs/react/components/date-picker) value/onChange 与 [迁移说明](https://heroui.com/cn/docs/react/migration/date-picker)。复用已安装的 @internationalized/date 3.12.3，并将直接依赖限定到 UI Adapter。
