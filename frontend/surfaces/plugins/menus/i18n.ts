export const pluginI18nResources = {
  'zh-CN': {
    translation: {
      menus: {
        nav: '菜单管理',
        eyebrow: '系统管理',
        title: '菜单管理',
        description:
          '菜单路由与页面组件来自部署期插件注册表（Plugin Route Registry）；本页只维护标题、排序、可见性与权限标识等展示/业务元数据，不新增、删除或改写任何路由与组件。',
        collection: '菜单结构',
        collectionDescription:
          '按分组、菜单、子菜单展示注册表条目；业务覆盖仅影响展示，分组与无路由父级不可编辑。',
        empty: {
          search: '没有匹配的菜单，请调整搜索关键词或取消“仅显示已修改”。',
        },
        type: {
          group: '分组',
          menu: '菜单',
          submenu: '子菜单',
        },
        columns: {
          title: '标题',
          type: '类型',
          permission: '权限标识',
          path: '路由地址',
          order: '排序',
          actions: '操作',
        },
        modified: '已修改',
        hidden: '隐藏',
        placeholder: '—',
        structuralReadonly: '不可编辑',
        expansion: {
          expand: '展开 {{label}}',
          collapse: '收起 {{label}}',
        },
        toolbar: {
          label: '菜单工具栏',
          search: '搜索菜单',
          searchPlaceholder: '按标题、路由地址或权限标识搜索',
          onlyModified: '仅显示已修改',
          savedNever: '尚无业务覆盖',
          savedAt: '已自动保存 · {{time}}',
          restoreAll: '恢复全部默认',
        },
        actions: {
          edit: '修改',
          hide: '隐藏',
          show: '恢复显示',
          reset: '恢复默认',
          clear: '删除覆盖',
          orderUp: '提高排序',
          orderDown: '降低排序',
        },
        dialog: {
          title: '修改菜单展示元数据',
          description:
            '只覆盖本菜单的展示信息；路由地址与页面组件由部署期注册表提供，不能在此修改。',
          label: '标题覆盖',
          labelHint: '留空表示使用注册表标题；非空时 1–40 个字符。',
          permission: '权限标识',
          permissionHint: '留空表示不声明权限；格式如 settings.update。',
          order: '排序',
          orderHint: '0–999 的整数；留空表示使用注册表顺序。',
          visibility: '可见性',
          visibilityDescription: '隐藏只影响业务菜单展示，不会从部署注册表移除路由或组件。',
          save: '保存',
          cancel: '取消',
          failure: '保存失败，请检查字段或冲突提示后重试。',
          validationFailure: '请修正标红的字段后再保存。',
        },
        validation: {
          label: '标题需为 1–40 个字符',
          permission: '权限标识需为小写点分格式，如 settings.update',
          order: '排序需为 0–999 的整数',
        },
        conflict: '该菜单已被其他操作更新，已重新载入最新值，请确认后再次保存。',
        readonlyTitle: '只读模式',
        readonlyDescription: '当前账号没有 settings.update 权限，只能查看菜单展示元数据。',
        permissionPending: '正在校验权限…',
        saveSuccess: '菜单展示元数据已保存',
        hideSuccess: '菜单已隐藏',
        showSuccess: '菜单已恢复显示',
        resetSuccess: '已恢复注册表默认展示',
        clearSuccess: '已删除该菜单的覆盖记录',
        clearAllSuccess: '已恢复全部菜单默认展示',
        delete: {
          title: '删除该菜单的覆盖记录？',
          description: '将删除“{{label}}”的标题、排序、权限与可见性覆盖。',
          impact: '删除后该菜单回到部署注册表的默认展示；路由与组件保持不变。',
          confirm: '删除覆盖',
          cancel: '取消',
          failure: '删除失败，可能与其他操作冲突，请重试。',
        },
        restore: {
          title: '恢复全部菜单默认？',
          description: '将删除所有菜单的标题、排序、权限与可见性覆盖。',
          impact: '路由与组件保持不变；恢复后侧边栏使用部署注册表的默认值。',
          confirm: '恢复全部默认',
          cancel: '取消',
          failure: '恢复失败，请重试。',
        },
        hydration: {
          title: '菜单覆盖记录无法读取',
          description:
            '本地保存的菜单覆盖记录已损坏，系统没有自动覆盖它。可重置本地记录后继续编辑。',
          reset: '重置本地记录',
        },
      },
    },
  },
  en: {
    translation: {
      menus: {
        nav: 'Menu administration',
        eyebrow: 'System administration',
        title: 'Menu administration',
        description:
          'Menu routes and page components come from the deployment-time plugin route registry. This page only maintains presentation and business metadata such as title, order, visibility, and permission. It never adds, deletes, or rewrites routes or components.',
        collection: 'Menu structure',
        collectionDescription:
          'Registered entries by group, menu, and submenu. Overrides affect presentation only; groups and route-less parents are read-only.',
        empty: {
          search: 'No matching menus. Adjust the search term or clear “Modified only”.',
        },
        type: {
          group: 'Group',
          menu: 'Menu',
          submenu: 'Submenu',
        },
        columns: {
          title: 'Title',
          type: 'Type',
          permission: 'Permission',
          path: 'Route',
          order: 'Order',
          actions: 'Actions',
        },
        modified: 'Modified',
        hidden: 'Hidden',
        placeholder: '—',
        structuralReadonly: 'Read-only',
        expansion: {
          expand: 'Expand {{label}}',
          collapse: 'Collapse {{label}}',
        },
        toolbar: {
          label: 'Menu toolbar',
          search: 'Search menus',
          searchPlaceholder: 'Search by title, route, or permission',
          onlyModified: 'Modified only',
          savedNever: 'No business overrides yet',
          savedAt: 'Autosaved · {{time}}',
          restoreAll: 'Restore all defaults',
        },
        actions: {
          edit: 'Edit',
          hide: 'Hide',
          show: 'Show again',
          reset: 'Restore defaults',
          clear: 'Delete override',
          orderUp: 'Increase order',
          orderDown: 'Decrease order',
        },
        dialog: {
          title: 'Edit menu presentation metadata',
          description:
            'Only presentation metadata for this menu is overridden. The route and page component come from the deployment-time registry and cannot be changed here.',
          label: 'Title override',
          labelHint: 'Leave empty to use the registry title; otherwise 1–40 characters.',
          permission: 'Permission identifier',
          permissionHint: 'Leave empty for no permission; for example settings.update.',
          order: 'Order',
          orderHint: 'Integer 0–999; leave empty to use the registry order.',
          visibility: 'Visibility',
          visibilityDescription:
            'Hiding affects business menu presentation only; the route and component stay in the deployment registry.',
          save: 'Save',
          cancel: 'Cancel',
          failure: 'The override could not be saved. Review the fields or conflict message.',
          validationFailure: 'Fix the highlighted fields before saving.',
        },
        validation: {
          label: 'Title must be 1–40 characters',
          permission: 'Permission must use lowercase dot notation, such as settings.update',
          order: 'Order must be an integer between 0 and 999',
        },
        conflict:
          'This menu was updated by another action. The latest values were reloaded; review them and save again.',
        readonlyTitle: 'Read-only mode',
        readonlyDescription:
          'This account does not have settings.update, so menu presentation metadata is read-only.',
        permissionPending: 'Checking permission…',
        saveSuccess: 'Menu presentation metadata saved',
        hideSuccess: 'Menu hidden',
        showSuccess: 'Menu visible again',
        resetSuccess: 'Registry presentation restored',
        clearSuccess: 'Menu override deleted',
        clearAllSuccess: 'All menu overrides removed',
        delete: {
          title: 'Delete this menu override?',
          description:
            'The title, order, permission, and visibility overrides for “{{label}}” will be removed.',
          impact:
            'The menu returns to the deployment registry defaults; routes and components are unchanged.',
          confirm: 'Delete override',
          cancel: 'Cancel',
          failure: 'The override could not be deleted because of a conflict. Retry.',
        },
        restore: {
          title: 'Restore all menu defaults?',
          description:
            'All title, order, permission, and visibility overrides will be removed from every menu.',
          impact:
            'Routes and components are unchanged; the sidebar will use deployment registry defaults.',
          confirm: 'Restore all defaults',
          cancel: 'Cancel',
          failure: 'The defaults could not be restored. Retry.',
        },
        hydration: {
          title: 'Menu overrides could not be read',
          description:
            'The locally saved menu override record is damaged and was not overwritten. Reset the local record to continue editing.',
          reset: 'Reset local record',
        },
      },
    },
  },
} as const;
