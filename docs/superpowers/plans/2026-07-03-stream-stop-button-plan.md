# 流式输出停止/打断按钮实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI 流式输出期间，将底部"发送"按钮切换为"停止"按钮，用户点击后可立即中止 SSE 并保留已输出内容。

**Architecture:** 在 `App.vue` 中新增 `AbortController` 引用与 `stopGenerating()` 函数；`sendMessage` 发起 fetch 时传入 signal；输出期间按钮文案与点击行为切换；被中止时不显示错误提示。

**Tech Stack:** Vue 3 + TypeScript + Vite，沿用现有 SSE 读取逻辑。

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/App.vue` | 修改 | 增加中止控制器、停止函数、按钮状态切换、停止样式 |
| `docs/superpowers/specs/2026-07-03-stream-stop-button-design.md` | 读取 | 设计文档，实现依据 |

---

## Task 1: 在 `App.vue` 中增加 `AbortController` 与 `stopGenerating`

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 在 `<script setup>` 顶部新增 `abortController` 引用与 `stopGenerating` 函数**

在 `const isTyping = ref(false)` 之后、其他变量之前添加：

```typescript
// 当前 SSE 请求的 AbortController，用于用户点击“停止”时中断输出
const abortController = ref<AbortController | null>(null)
```

在 `sendMessage` 函数定义之前添加：

```typescript
/**
 * 用户手动停止当前 AI 流式输出
 */
function stopGenerating() {
  const controller = abortController.value
  if (controller) {
    controller.abort()
    abortController.value = null
  }
}
```

- [ ] **Step 2: 验证新增代码无语法问题**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/frontend && npx vue-tsc --noEmit
```

Expected: 无输出或通过（此时还未修改 fetch 调用，仅检查类型定义）。

---

## Task 2: 修改 `sendMessage` 使用 `AbortController` 并处理中止状态

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 在 `sendMessage` 开头创建 `AbortController` 并清理旧实例**

将 `sendMessage` 中的：

```typescript
async function sendMessage() {
  const message = userInput.value.trim()
  if (!message || isTyping.value) return
```

替换为：

```typescript
async function sendMessage() {
  const message = userInput.value.trim()
  if (!message || isTyping.value) return

  // 如果存在未清理的旧控制器（异常场景），先中止并清理
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }

  abortController.value = new AbortController()
```

- [ ] **Step 2: 在 `fetch` 调用中传入 `signal`**

将：

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message })
})
```

替换为：

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message }),
  signal: abortController.value?.signal,
})
```

- [ ] **Step 3: 在 `catch` 中区分手动中止与真实错误**

将 `catch` 块：

```typescript
} catch (err) {
  // 出错时移除占位 AI 消息，避免留下空气泡
  messages.value.pop()
  errorMsg.value = `调用失败：${(err as Error).message}`
} finally {
  isTyping.value = false
  lastMessage.isTyping = false
}
```

替换为：

```typescript
} catch (err) {
  const error = err as Error
  // 用户手动中止：保留已输出内容，不显示错误提示
  if (error.name === 'AbortError' || error.message?.includes('aborted')) {
    errorMsg.value = ''
  } else {
    // 真实错误：移除占位 AI 消息，避免留下空气泡
    messages.value.pop()
    errorMsg.value = `调用失败：${error.message}`
  }
} finally {
  isTyping.value = false
  lastMessage.isTyping = false
  abortController.value = null
}
```

- [ ] **Step 4: 运行类型检查**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/frontend && npx vue-tsc --noEmit
```

Expected: 无输出或通过。

---

## Task 3: 修改底部按钮以支持"停止"状态

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 替换按钮模板，根据 `isTyping` 切换文案与行为**

将：

```vue
      <button
        class="send-btn"
        :disabled="isTyping || !userInput.trim()"
        @click="sendMessage"
      >
        {{ isTyping ? '输出中...' : '发送' }}
      </button>
```

替换为：

```vue
      <button
        class="send-btn"
        :class="{ 'stop-btn': isTyping }"
        :disabled="!isTyping && !userInput.trim()"
        @click="isTyping ? stopGenerating() : sendMessage()"
      >
        {{ isTyping ? '停止' : '发送' }}
      </button>
```

- [ ] **Step 2: 在 `<style scoped>` 中添加 `.stop-btn` 样式**

在 `.send-btn:hover:not(:disabled)` 样式块之后添加：

```css
.stop-btn {
  background: #f56c6c;
}

.stop-btn:hover:not(:disabled) {
  background: #f89898;
}
```

- [ ] **Step 3: 运行前端构建检查**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/frontend && npm run build
```

Expected: `vue-tsc -b && vite build` 成功，输出到 `frontend/dist/`。

---

## Task 4: 端到端验证

**Files:**
- 无新文件

- [ ] **Step 1: 确认后端服务已启动**

若未启动，运行：
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning && npm run server
```

Expected: 控制台输出 `SSE 服务已启动：http://localhost:3000/api/chat`。

- [ ] **Step 2: 确认前端开发服务器已启动**

若未启动，运行：
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/frontend && npm run dev
```

Expected: Vite 启动在 `http://localhost:5173/`。

- [ ] **Step 3: 浏览器验证停止功能**

打开 `http://localhost:5173/`，依次验证：

1. 输入问题并点击"发送" → 按钮立即变为红色"停止"。
2. AI 开始流式输出后，在输出完成前点击"停止" → 输出立即停止，已显示文本保留在 AI 消息气泡中。
3. 停止后按钮恢复为"发送"，且不显示红色错误提示。
4. 停止后可立即输入并发送下一条消息。
5. 不点击"停止"，等待 AI 自然输出完成 → 按钮自动恢复为"发送"。

- [ ] **Step 4: 验证事件列表场景**

输入经营事件类问题（如"查询上周签约和收入的经营事件"），在事件列表卡片渲染前点击"停止" → 已返回的内容（若有）保留，无内容则保留空 AI 消息。

---

## Task 5: 最终构建与提交前检查

**Files:**
- 无新文件

- [ ] **Step 1: 前端生产构建**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/frontend && npm run build
```

Expected: 构建成功，无类型错误。

- [ ] **Step 2: 后端构建（确认未破坏后端）**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning && npm run build
```

Expected: `tsc` 成功，无类型错误。

- [ ] **Step 3: ESLint 说明**

当前项目未配置 ESLint。本计划以 `npm run build` 作为提交前质量门槛。

- [ ] **Step 4: 最终 Commit（如用户需要提交）**

若用户要求提交：

```bash
git add frontend/src/App.vue
git commit -m "feat: add stream stop button to interrupt AI output"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** 设计文档中的中止逻辑、按钮切换、保留已输出内容、错误处理均有对应任务。
- [x] **Placeholder scan:** 无 TBD/TODO/"稍后实现"，所有步骤包含具体代码或命令。
- [x] **Type consistency:** `abortController` 类型、`stopGenerating` 函数、`sendMessage` 中的 signal 使用一致。
- [x] **Scope check:** 仅修改 `App.vue`，未引入无关改动。

---

## 执行方式选择

计划已保存到 `docs/superpowers/plans/2026-07-03-stream-stop-button-plan.md`。

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 分配给独立子代理执行，我负责审查。
2. **Inline Execution** — 在当前会话中按 Task 逐步执行。

由于用户要求"每一步都需要经过我的同意"，建议选择 **Inline Execution**，便于每个 step 完成后暂停确认。

请选择一种方式，确认后立即开始编码。
