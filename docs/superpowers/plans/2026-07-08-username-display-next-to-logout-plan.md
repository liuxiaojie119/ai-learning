# 在登出按钮左侧显示用户名（Ant Design Vue 下拉菜单）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Chat 页面 header 右侧用 Ant Design Vue 下拉菜单展示当前用户名，并将"登出"操作收纳到菜单中。

**Architecture:** 通过按需引入 Ant Design Vue，使用 `a-dropdown` 组件替换原有"登出"按钮；触发区显示用户图标+用户名，下拉项为"登出"，点击后复用现有 `handleLogout` 逻辑。

**Tech Stack:** Vue 3, Vite, TypeScript, Ant Design Vue, unplugin-vue-components

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/package.json` | 修改 | 新增 `ant-design-vue`、`unplugin-vue-components` 依赖 |
| `frontend/package-lock.json` | 修改 | 依赖更新后自动变更 |
| `frontend/vite.config.ts` | 修改 | 配置 `Components` 插件按需引入 Ant Design Vue |
| `frontend/tsconfig.app.json` | 修改 | 包含自动生成的 `components.d.ts` |
| `frontend/.gitignore` | 修改 | 忽略 `components.d.ts` |
| `frontend/src/main.ts` | 修改 | 引入 Ant Design Vue 基础样式 |
| `frontend/src/views/ChatView.vue` | 修改 | 替换 header 右侧按钮为用户名下拉菜单 |
| `docs/superpowers/specs/2026-07-08-username-display-next-to-logout-design.md` | 创建 | 设计文档 |
| `docs/superpowers/plans/2026-07-08-username-display-next-to-logout-plan.md` | 创建 | 本计划文档 |

---

### Task 1: 安装 Ant Design Vue 及按需引入插件

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: 安装依赖**

在 `frontend` 目录下执行：

```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/.worktrees/username-next-to-logout/frontend
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 24
npm install ant-design-vue unplugin-vue-components
```

- [ ] **Step 2: 确认 package.json 已更新**

执行：

```bash
grep -E '"ant-design-vue"|"unplugin-vue-components"' package.json
```

Expected: 两条依赖均出现在输出中，且 `unplugin-vue-components` 在 `devDependencies` 中。

---

### Task 2: 配置 Vite 按需引入

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: 修改 vite.config.ts**

将 `frontend/vite.config.ts` 替换为以下内容：

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [AntDesignVueResolver({ importStyle: 'css-in-js' })],
      dts: true,
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // 将前端的 /api 请求代理到后端 SSE 服务
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
```

- [ ] **Step 2: 验证 TypeScript 无报错**

执行：

```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/.worktrees/username-next-to-logout/frontend
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 24
npx tsc --noEmit -p tsconfig.node.json
```

Expected: 无错误输出。

---

### Task 3: 配置 TypeScript 与 gitignore

**Files:**
- Modify: `frontend/tsconfig.app.json`
- Modify: `frontend/.gitignore`

- [ ] **Step 1: 在 tsconfig.app.json 中包含 components.d.ts**

将 `include` 改为：

```json
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "components.d.ts"]
```

- [ ] **Step 2: 在 .gitignore 中忽略 components.d.ts**

在 `frontend/.gitignore` 中新增一行：

```
components.d.ts
```

---

### Task 4: 引入 Ant Design Vue 基础样式

**Files:**
- Modify: `frontend/src/main.ts`

- [ ] **Step 1: 在 main.ts 顶部引入样式**

将 `frontend/src/main.ts` 替换为：

```typescript
import { createApp } from 'vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')
```

---

### Task 5: 修改 ChatView.vue 实现用户名下拉菜单

**Files:**
- Modify: `frontend/src/views/ChatView.vue`

- [ ] **Step 1: 移除原有"登出"按钮，替换为 a-dropdown**

在 `frontend/src/views/ChatView.vue` 中，找到 `<header class="chat-header">...</header>` 区域，替换为：

```vue
      <header class="chat-header">
        <h1 class="title">🤖 AI 助手</h1>
        <a-dropdown trigger="click" placement="bottomRight">
          <a-button class="user-menu-btn" aria-label="用户菜单">
            <span aria-hidden="true">👤</span>
            <span class="username-text">{{ authStore.user.value?.username ?? '用户' }}</span>
            <span aria-hidden="true">▼</span>
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="logout" @click="handleLogout">
                登出
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </header>
```

- [ ] **Step 2: 添加 user-menu-btn 样式并删除旧样式**

从 `<style scoped>` 中删除 `.logout-btn` 和 `.logout-btn:hover` 规则。

在 `<style scoped>` 末尾追加：

```css
.user-menu-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #f3f4f6;
  color: #606266;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 13px;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.user-menu-btn:hover {
  background: #e5e7eb;
  color: #409eff;
  border-color: #c6e2ff;
}

.username-text {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: 确认 handleLogout 函数仍存在**

`handleLogout` 函数定义应保留：

```typescript
async function handleLogout(): Promise<void> {
  await authStore.logout()
  router.push('/login')
}
```

---

### Task 6: 构建与类型检查

**Files:**
- Test: 手动验证

- [ ] **Step 1: 运行类型检查**

```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/.worktrees/username-next-to-logout/frontend
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 24
npx vue-tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 2: 运行生产构建**

```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/.worktrees/username-next-to-logout/frontend
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 24
npm run build
```

Expected: 构建成功，输出 `dist/` 目录。

---

### Task 7: 手动验证功能

**Files:**
- Test: 手动验证

- [ ] **Step 1: 启动后端服务**

```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/.worktrees/username-next-to-logout
npm run server
```

Expected: 控制台输出 `服务已启动：http://localhost:3000`。

- [ ] **Step 2: 启动前端开发服务**

使用 Node 24 启动前端：

```bash
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 24
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/.worktrees/username-next-to-logout/frontend
npm run dev
```

Expected: Vite 启动在 `http://localhost:5173/`。

- [ ] **Step 3: 登录并验证**

1. 打开 http://localhost:5173/
2. 使用账号 `admin` / `1` 登录。
3. 进入 Chat 页面后，确认 header 右侧显示 `👤 admin ▼`。
4. 点击该按钮，确认出现下拉菜单，包含"登出"。
5. 点击"登出"，确认跳转回登录页面。

---

### Task 8: 提交变更

- [ ] **Step 1: 查看变更**

```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/.worktrees/username-next-to-logout
git status
```

- [ ] **Step 2: 提交代码**

```bash
 git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.app.json frontend/.gitignore frontend/src/main.ts frontend/src/views/ChatView.vue docs/superpowers/specs/2026-07-08-username-display-next-to-logout-design.md docs/superpowers/plans/2026-07-08-username-display-next-to-logout-plan.md
git commit -m "feat: 在 Chat 页面 header 用 Ant Design Vue 下拉菜单展示用户名并集成登出

- 引入 ant-design-vue，配置 Vite 按需引入
- 用 a-dropdown 替换原有登出按钮
- 触发区显示 👤 用户名 ▼，下拉项为登出
- 保持与现有 header 按钮风格一致

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 自我审查

**1. Spec coverage:**
- 在 header 显示用户名：Task 5 Step 1
- 使用下拉菜单：Task 5 Step 1（a-dropdown）
- 登出功能：Task 5 Step 1 + 复用 handleLogout
- Ant Design Vue：Task 1、Task 2、Task 4
- 按需引入：Task 2
- 样式一致：Task 5 Step 2

**2. Placeholder scan:**
- 无 TBD/TODO。
- 所有代码步骤均给出完整代码。
- 所有命令均给出具体命令和期望输出。

**3. Type consistency:**
- `authStore.user.value?.username` 与 `useAuthStore` 中 `AuthUser.username` 一致。
- `handleLogout` 复用现有函数，签名一致。

无问题，计划可执行。
