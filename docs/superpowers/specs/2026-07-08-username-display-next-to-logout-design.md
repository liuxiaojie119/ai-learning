# 在登出按钮左侧显示用户名（下拉菜单方案）

## 背景与目标

当前 `ChatView.vue` 头部右侧仅有一个"登出"按钮。为提升用户信息感知，需要在登出按钮左侧展示当前登录用户名，并通过下拉菜单的方式将"登出"操作收纳到用户名菜单中。

目标：
- 在 Chat 页面 header 右侧显示当前用户名。
- 点击用户名弹出下拉菜单，菜单中包含"登出"选项。
- 保持与现有 UI 风格一致，不引入过度复杂的交互。

## 方案选择

实现方式对比：

| 方案 | 说明 | 优点 | 缺点 |
|------|------|------|------|
| 内联实现 | 在 `ChatView.vue` 中直接写按钮+下拉 | 无新依赖、改动最小 | 交互细节需手动处理 |
| 独立组件 | 封装 `UserMenu.vue` | 结构清晰、可复用 | 当前仅一处使用，收益有限 |
| 引入组件库 | 使用 Ant Design Vue 的 `a-dropdown` | 功能完善、维护成本低 | 增加依赖 |

最终采用 **方案 3：引入 Ant Design Vue**，由用户明确指定。

## 组件库选型

- **Ant Design Vue**：Vue 3 生态成熟组件库，提供 `a-dropdown`、`a-button`、`a-menu` 等组件，可直接实现需求。
- 引入方式：**按需引入**，通过 `unplugin-vue-components` 实现组件自动导入。

## 详细设计

### 数据流

1. `useAuthStore` 已暴露 `user`（`{ id, username }`）和 `logout`。
2. `ChatView.vue` 中移除原有"登出"按钮。
3. 在 header 右侧新增 `a-dropdown`：
   - 触发按钮显示 `👤 {{ authStore.user.value?.username ?? '用户' }} ▼`。
   - 下拉菜单项包含"登出"。
4. 点击"登出"后调用 `handleLogout`：
   - 调用 `authStore.logout()`。
   - 成功后 `router.push('/login')`。

### 修改文件

- `frontend/package.json`：新增 `ant-design-vue`、`unplugin-vue-components` 依赖。
- `frontend/vite.config.ts`：配置按需引入插件。
- `frontend/tsconfig.app.json`：包含自动生成的 `components.d.ts`。
- `frontend/.gitignore`：忽略 `components.d.ts`。
- `frontend/src/main.ts`：引入 Ant Design Vue 基础样式。
- `frontend/src/views/ChatView.vue`：替换 header 右侧按钮为用户名下拉菜单。

### UI 样式

- 触发按钮样式贴近原有 `logout-btn`：
  - 背景色 `#f3f4f6`
  - 文字色 `#606266`
  - 边框 `1px solid #dcdfe6`
  - 圆角 `6px`
  - 字号 `13px`
- 通过局部样式覆盖实现视觉一致。

### 交互细节

- 下拉触发方式：`trigger="click"`，避免误触。
- 下拉位置：`placement="bottomRight"`。
- 触发按钮添加 `aria-label="用户菜单"`，装饰性 emoji/箭头使用 `aria-hidden="true"`。
- 用户名文本过长时截断显示（`text-overflow: ellipsis`）。

### 边界处理

- `user` 为空时显示 fallback 文本"用户"。
- 登出请求失败仍清除本地状态并跳转登录页（复用现有逻辑）。
- 点击下拉外部自动关闭（组件库内置）。

## 依赖变更

新增：
- `ant-design-vue`
- `unplugin-vue-components`（dev）

## 验收标准

- [ ] 登录后 Chat 页面 header 右侧显示当前用户名。
- [ ] 点击用户名展开下拉菜单，菜单中包含"登出"。
- [ ] 点击"登出"后跳转至登录页并清除登录状态。
- [ ] 构建通过，无 TypeScript / ESLint 错误。
- [ ] 样式与现有 header 风格协调。
