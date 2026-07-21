# Phase 1：多轮对话与会话管理 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让现有单轮对话 Demo 支持多轮上下文、多会话管理、刷新后历史不丢失。

**Architecture:** 前端使用 Vue 3 Composition API 组合式函数管理会话状态，通过 `localStorage` 持久化；后端 `/api/chat` 从接收单条 `message` 改为接收完整 `messages` 数组，直接透传给大模型。会话列表作为侧边栏组件独立维护。

**Tech Stack:** Vue 3 + TypeScript + Vite（前端），Node.js + TypeScript + 原生 `http` + `openai` SDK（后端），`localStorage` 做本地持久化。

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `src/server.ts` | 修改 | 接收 `messages` 数组，透传给模型 |
| `frontend/src/composables/useChatStore.ts` | 创建 | 会话状态管理：当前会话、消息列表、新建/切换/删除、持久化 |
| `frontend/src/components/SessionList.vue` | 创建 | 会话列表侧边栏 UI |
| `frontend/src/App.vue` | 修改 | 集成会话管理，发送完整历史 |
| `frontend/src/components/ChatMessage.vue` | 不修改 | 保持现有消息渲染逻辑 |
| `frontend/src/components/TypeWriter.vue` | 不修改 | 保持现有打字机效果 |

---

## Task 1：后端接口接收完整 messages 数组

**Files:**
- Modify: `src/server.ts:30-62`

- [ ] **Step 1: 修改请求体解析逻辑**

将 `const { message } = JSON.parse(body)` 改为解构 `messages` 数组，并校验数组非空。

```ts
const { messages } = JSON.parse(body) as { messages?: { role: string; content: string }[] };
if (!Array.isArray(messages) || messages.length === 0) {
  res.statusCode = 400;
  res.end(JSON.stringify({ error: "messages 字段必须是非空数组" }));
  return;
}
```

- [ ] **Step 2: 使用传入的 messages 调用流式接口**

替换掉原先硬编码的 `messages` 数组，使用用户传入的上下文。

```ts
const chatMessages: ChatMessage[] = messages
  .filter((m): m is { role: "system" | "user" | "assistant"; content: string } =>
    ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string"
  )
  .map((m) => ({ role: m.role, content: m.content }));

await streamZhipuChat(chatMessages, (chunk) => {
  sendSSE(res, { chunk });
});
```

- [ ] **Step 3: 保留经营事件特殊处理（可选保持原样）**

经营事件查询仍走 `fetchEventsWithTool`，但注意它目前只接收单条用户消息。本阶段先不动它，后续 Phase 2 再考虑把工具调用也接入上下文。

- [ ] **Step 4: 手动验证后端变更**

运行后端：

```bash
npm run dev
```

用 curl 测试新接口：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"system","content":"你是 helpful 助手"},{"role":"user","content":"你好"},{"role":"assistant","content":"你好！有什么可以帮你？"},{"role":"user","content":"刚才你说什么了？"}]}'
```

Expected: 返回 SSE 流，AI 能根据上文回答“我刚才说了你好”。

- [ ] **Step 5: Commit**

```bash
git add src/server.ts
git commit -m "feat: /api/chat 接收完整 messages 数组以支持多轮上下文"
```

---

## Task 2：创建会话状态管理组合式函数

**Files:**
- Create: `frontend/src/composables/useChatStore.ts`

- [ ] **Step 1: 定义类型与常量**

```ts
import { ref, computed, watch } from 'vue'

export type MessageRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const SYSTEM_PROMPT: ChatMessage = {
  id: 'system',
  role: 'system',
  content: '你是专业前端 TS 工程师，回答简洁规范',
  timestamp: 0,
}

const STORAGE_KEY = 'ai-learning-chat-sessions'
```

- [ ] **Step 2: 实现核心状态与方法**

```ts
const sessions = ref<ChatSession[]>(loadSessions())
const currentSessionId = ref<string>(sessions.value[0]?.id ?? createSession().id)

const currentSession = computed(() =>
  sessions.value.find((s) => s.id === currentSessionId.value) ?? sessions.value[0]
)

function createSession(): ChatSession {
  const session: ChatSession = {
    id: crypto.randomUUID(),
    title: '新对话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  sessions.value.unshift(session)
  currentSessionId.value = session.id
  return session
}

function switchSession(id: string) {
  if (sessions.value.some((s) => s.id === id)) {
    currentSessionId.value = id
  }
}

function deleteSession(id: string) {
  sessions.value = sessions.value.filter((s) => s.id !== id)
  if (currentSessionId.value === id) {
    currentSessionId.value = sessions.value[0]?.id ?? createSession().id
  }
}

function addMessage(sessionId: string, role: MessageRole, content: string) {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return
  session.messages.push({
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
  })
  session.updatedAt = Date.now()
  if (session.messages.filter((m) => m.role === 'user').length === 1 && role === 'user') {
    session.title = content.slice(0, 20) || '新对话'
  }
}

function updateLastMessage(sessionId: string, content: string) {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return
  const last = session.messages.at(-1)
  if (last) {
    last.content += content
    session.updatedAt = Date.now()
  }
}

function setLastMessageTyping(sessionId: string, isTyping: boolean) {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return
  const last = session.messages.at(-1)
  if (last) {
    ;(last as ChatMessage & { isTyping?: boolean }).isTyping = isTyping
  }
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChatSession[]) : []
  } catch {
    return []
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value))
}

watch(sessions, saveSessions, { deep: true })

export function useChatStore() {
  return {
    sessions,
    currentSessionId,
    currentSession,
    createSession,
    switchSession,
    deleteSession,
    addMessage,
    updateLastMessage,
    setLastMessageTyping,
  }
}
```

- [ ] **Step 3: 手动验证 store**

在 `frontend/src/main.ts` 临时打印：

```ts
import { useChatStore } from './composables/useChatStore'
const store = useChatStore()
console.log('sessions', store.sessions.value)
store.createSession()
store.addMessage(store.currentSessionId.value, 'user', '测试消息')
console.log('after add', store.currentSession.value)
```

Expected: 控制台能看到新会话和消息，且刷新页面后数据仍在 `localStorage` 中。

验证后删除临时代码。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/composables/useChatStore.ts
mkdir -p frontend/src/composables
git commit -m "feat: 添加会话管理组合式函数 useChatStore"
```

---

## Task 3：创建会话列表侧边栏组件

**Files:**
- Create: `frontend/src/components/SessionList.vue`

- [ ] **Step 1: 编写组件模板与逻辑**

```vue
<script setup lang="ts">
import { useChatStore } from '../composables/useChatStore'

const store = useChatStore()
</script>

<template>
  <aside class="session-list">
    <button class="new-session-btn" @click="store.createSession">+ 新建对话</button>
    <ul class="sessions">
      <li
        v-for="session in store.sessions.value"
        :key="session.id"
        class="session-item"
        :class="{ active: session.id === store.currentSessionId.value }"
        @click="store.switchSession(session.id)"
      >
        <span class="session-title">{{ session.title }}</span>
        <button
          class="delete-btn"
          @click.stop="store.deleteSession(session.id)"
          title="删除会话"
        >
          ×
        </button>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.session-list {
  width: 240px;
  min-width: 240px;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  background: #f9fafb;
  padding: 16px;
  box-sizing: border-box;
}

.new-session-btn {
  width: 100%;
  padding: 10px;
  margin-bottom: 16px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.new-session-btn:hover {
  background: #66b1ff;
}

.sessions {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 8px;
  transition: background 0.2s;
}

.session-item:hover {
  background: #e5e7eb;
}

.session-item.active {
  background: #dbeafe;
}

.session-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-size: 14px;
  color: #333;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.delete-btn:hover {
  color: #f56c6c;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SessionList.vue
git commit -m "feat: 添加会话列表侧边栏组件 SessionList"
```

---

## Task 4：重构 App.vue 集成会话管理

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 引入 useChatStore 和 SessionList**

```ts
import { useChatStore } from './composables/useChatStore'
import SessionList from './components/SessionList.vue'
```

- [ ] **Step 2: 替换本地 messages 为 store 驱动**

删除原来独立的 `messages` ref，改用：

```ts
const store = useChatStore()
const messages = computed(() => store.currentSession.value?.messages ?? [])
```

注意：之前 `ChatMessageItem` 包含 `type`、`payload`、`isTyping` 等字段用于经营事件渲染。为了兼容，需要先把 store 里的 `ChatMessage` 转换成 `ChatMessageItem` 展示，或者调整类型定义。本阶段先简化：保留 `ChatMessageItem` 作为 UI 展示类型，在 computed 中转换。

```ts
const displayMessages = computed<ChatMessageItem[]>(() =>
  messages.value.map((m) => ({
    id: m.id,
    role: m.role === 'system' ? 'assistant' : m.role,
    type: 'text',
    content: m.content,
    payload: null,
    timestamp: m.timestamp,
    isTyping: false,
  }))
)
```

> 说明：system 消息不展示，所以转换时不会用到。这里为了类型安全做了兜底。

- [ ] **Step 3: 修改 sendMessage 使用完整上下文**

```ts
async function sendMessage() {
  const message = userInput.value.trim()
  if (!message || isTyping.value) return

  const sessionId = store.currentSessionId.value

  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
  abortController.value = new AbortController()

  store.addMessage(sessionId, 'user', message)
  store.addMessage(sessionId, 'assistant', '')

  userInput.value = ''
  errorMsg.value = ''
  isTyping.value = true

  nextTick(() => {
    const el = inputRef.value
    if (el) el.style.height = 'auto'
    scrollToBottom()
  })

  const history = [
    { role: 'system', content: '你是专业前端 TS 工程师，回答简洁规范' },
    ...messages.value
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
      signal: abortController.value?.signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      throw new Error(errorData.error || `请求失败：${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim()
          try {
            const data = JSON.parse(dataStr)
            if (data.chunk) {
              store.updateLastMessage(sessionId, data.chunk)
            }
            if (data.done) {
              isTyping.value = false
            }
            scrollToBottom()
          } catch (e) {
            console.error('解析 SSE 数据失败：', dataStr, e)
          }
        }
      }
    }

    if (buffer.trim().startsWith('data:')) {
      const dataStr = buffer.trim().slice(5).trim()
      try {
        const data = JSON.parse(dataStr)
        if (data.chunk) {
          store.updateLastMessage(sessionId, data.chunk)
        }
      } catch (e) {
        console.error('解析缓冲区 SSE 数据失败：', dataStr, e)
      }
    }
  } catch (err) {
    const error = err as Error
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      errorMsg.value = ''
    } else {
      store.deleteSession(sessionId)
      errorMsg.value = `调用失败：${error.message}`
    }
  } finally {
    isTyping.value = false
    abortController.value = null
  }
}
```

> 注意：这里删除了经营事件相关处理，是为了让 Phase 1 聚焦于多轮对话。经营事件功能在 Phase 2 再以更完整的方式回归。

- [ ] **Step 4: 更新模板，加入 SessionList 和调整消息绑定**

```vue
<template>
  <div class="app-layout">
    <SessionList />
    <div class="chat-container">
      <h1 class="title">🤖 AI 流式对话 Demo</h1>
      <DynamicScroller
        ref="messagesRef"
        :items="displayMessages"
        :min-item-size="54"
        class="messages-area"
      >
        <template #default="{ item, index, active }">
          <DynamicScrollerItem
            :item="item"
            :active="active"
            :size-dependencies="[item.content]"
            :data-index="index"
          >
            <ChatMessage :message="item" />
          </DynamicScrollerItem>
        </template>
      </DynamicScroller>
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <div class="input-area">
        <textarea
          ref="inputRef"
          v-model="userInput"
          class="chat-input"
          rows="1"
          placeholder="请输入你的问题..."
          @input="autoResize"
          @keydown.enter.prevent="sendMessage"
        />
        <button
          class="send-btn"
          :class="{ 'stop-btn': isTyping }"
          :disabled="!isTyping && !userInput.trim()"
          @click="isTyping ? stopGenerating() : sendMessage()"
        >
          {{ isTyping ? '停止' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 5: 添加布局样式**

在 `<style scoped>` 顶部添加：

```css
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
```

- [ ] **Step 6: 手动验证**

启动前后端：

```bash
# 终端 1
npm run dev

# 终端 2
cd frontend && npm run dev
```

验证场景：
1. 发送“我叫小明”，AI 回复后发送“我叫什么”，应能回答“你叫小明”。
2. 点击“新建对话”创建第二个会话，两个会话历史互不干扰。
3. 刷新页面，两个会话仍在。
4. 删除会话后，自动切换到下一个会话。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.vue
git commit -m "feat: App.vue 集成多轮对话与会话管理"
```

---

## Task 5：上下文截断策略（进阶）

**Files:**
- Modify: `frontend/src/composables/useChatStore.ts`

- [ ] **Step 1: 添加截断方法**

在 `useChatStore` 中增加 `buildMessages(sessionId, maxMessages)` 方法：

```ts
function buildMessages(sessionId: string, maxMessages = 20): { role: 'user' | 'assistant'; content: string }[] {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return []
  return session.messages
    .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .slice(-maxMessages)
    .map((m) => ({ role: m.role, content: m.content }))
}
```

- [ ] **Step 2: 在 App.vue 中替换手动 history 构建**

```ts
const history = [
  { role: 'system' as const, content: '你是专业前端 TS 工程师，回答简洁规范' },
  ...store.buildMessages(sessionId, 20),
]
```

- [ ] **Step 3: 验证**

在一个会话中发送超过 20 轮消息，确认第 21 轮仍然能正常回复（虽然最前面的历史会被截断）。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/composables/useChatStore.ts frontend/src/App.vue
git commit -m "feat: 添加上下文截断策略，限制历史消息数量"
```

---

## 自审检查

1. **Spec coverage**: Phase 1 设计中的多轮上下文、会话管理、持久化、截断策略均已对应任务。
2. **Placeholder scan**: 无 TBD/TODO，所有步骤包含具体代码和验证命令。
3. **Type consistency**: `ChatMessage`、`ChatSession`、`MessageRole` 在 store 和 App.vue 中保持一致；后端 `ChatMessage` 接口来自 `src/index.ts` 未改动。

---

## 执行方式

计划已完成并保存到 `docs/superpowers/plans/2026-07-07-multi-turn-session-management-plan.md`。

**由于你要求每一步都需确认，实际执行时我会逐条任务询问你是否开始，完成后再进入下一条。**

可选执行方式：
1. **Subagent-Driven（推荐）**：每个 Task 派发独立子代理执行，我在每步完成后向你确认
2. **Inline Execution**：在当前会话中逐步执行，每步都先征求你同意

你倾向于哪种？或者我们先从 Task 1 开始？
