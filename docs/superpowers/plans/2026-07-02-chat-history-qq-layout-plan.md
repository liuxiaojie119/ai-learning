# 聊天界面改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有单轮对话页面改造为 QQ/微信风格的会话式聊天界面，保留当前页面会话的历史问答记录。

**Architecture:** 前端 `App.vue` 维护内存消息数组；新增 `ChatMessage.vue` 负责单条消息渲染（头像、时间戳、左右布局、文本/事件列表分支）；SSE 流式输出实时更新最后一条 AI 消息；事件列表作为历史消息直接嵌入展示。

**Tech Stack:** Vue 3 + TypeScript + Vite，沿用现有 `TypeWriter.vue` 与 `EventList.vue`。

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/components/ChatMessage.vue` | 新建 | 单条聊天消息组件 |
| `frontend/src/App.vue` | 修改 | 维护消息列表、SSE 解析、滚动控制 |
| `frontend/src/components/TypeWriter.vue` | 不修改 | 复用现有 Markdown 文本渲染 |
| `frontend/src/components/EventList.vue` | 不修改 | 复用现有事件列表渲染 |

---

## Task 1: 新建 `ChatMessage.vue` 组件

**Files:**
- Create: `frontend/src/components/ChatMessage.vue`

- [ ] **Step 1: 写入组件代码**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import TypeWriter from './TypeWriter.vue'
import EventList from './EventList.vue'

interface EventItem {
  date: string
  type: string
  company: string
  project: string
  sales: string
  actualDate: string
  expectedDate: string | null
  lastWeekAmount: number
  opportunityAmount: number
}

interface Pagination {
  page: number
  pageSize: number
  total: number
}

interface EventListPayload {
  title: string
  subtitle: string
  tabs: string[]
  total: number
  data: EventItem[]
  pagination: Pagination
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  type: 'text' | 'event-list'
  content: string
  payload: EventListPayload | null
  timestamp: number
  isTyping: boolean
}

interface Props {
  message: ChatMessage
}

const props = defineProps<Props>()

const avatarChar = computed(() => (props.message.role === 'user' ? '我' : 'AI'))
const displayName = computed(() => (props.message.role === 'user' ? '我' : 'AI 助手'))
const timeText = computed(() => {
  const d = new Date(props.message.timestamp)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
})
</script>

<template>
  <div class="message-row" :class="message.role">
    <div class="avatar">{{ avatarChar }}</div>
    <div class="message-body">
      <div class="message-meta">
        <span class="name">{{ displayName }}</span>
        <span class="time">{{ timeText }}</span>
      </div>
      <div class="bubble" :class="message.role">
        <TypeWriter
          v-if="message.type === 'text'"
          :content="message.content"
          :is-typing="message.isTyping"
        />
        <EventList
          v-else-if="message.type === 'event-list' && message.payload"
          v-bind="message.payload"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.message-row.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.message-row.assistant .avatar {
  background: #9aa3b8;
}

.message-body {
  display: flex;
  flex-direction: column;
  max-width: calc(100% - 60px);
}

.message-row.user .message-body {
  align-items: flex-end;
}

.message-row.assistant .message-body {
  align-items: flex-start;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
  color: #8b92a8;
}

.name {
  color: #606266;
}

.bubble {
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.bubble.user {
  background: #409eff;
  color: #fff;
  border-radius: 12px 12px 4px 12px;
}

.bubble.assistant {
  background: #f5f5f5;
  color: #333;
  border-radius: 12px 12px 12px 4px;
}

.bubble :deep(.type-writer) {
  background: transparent;
  padding: 0;
}
</style>
```

- [ ] **Step 2: 验证组件语法**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/frontend && npx vue-tsc --noEmit
```

Expected: 无输出或通过（此时 App.vue 尚未引用，仅检查 ChatMessage.vue 自身类型）。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatMessage.vue
git commit -m "feat: add ChatMessage component for chat history rendering"
```

---

## Task 2: 改造 `App.vue` 维护消息列表

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 引入 `ChatMessage` 并定义消息类型**

在 `<script setup>` 顶部添加：

```typescript
import ChatMessage from './components/ChatMessage.vue'

// 保留原有 EventItem / EventListPayload 接口，新增 ChatMessage 接口
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  type: 'text' | 'event-list'
  content: string
  payload: EventListPayload | null
  timestamp: number
  isTyping: boolean
}
```

- [ ] **Step 2: 替换单轮状态为消息列表**

删除以下响应式变量：
```typescript
const displayedText = ref('')
const responseType = ref<'text' | 'event-list'>('text')
const eventListData = ref<EventListPayload | null>(null)
```

新增：
```typescript
const messages = ref<ChatMessage[]>([])
const messagesRef = ref<HTMLDivElement | null>(null)
```

保留：
```typescript
const userInput = ref('')
const isTyping = ref(false)
const errorMsg = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
```

- [ ] **Step 3: 添加滚动到底部函数**

```typescript
function scrollToBottom() {
  nextTick(() => {
    const el = messagesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
```

- [ ] **Step 4: 重写 `sendMessage` 函数**

替换整个 `sendMessage` 函数为：

```typescript
async function sendMessage() {
  const message = userInput.value.trim()
  if (!message || isTyping.value) return

  // 追加用户消息
  messages.value.push({
    id: crypto.randomUUID(),
    role: 'user',
    type: 'text',
    content: message,
    payload: null,
    timestamp: Date.now(),
    isTyping: false,
  })

  // 追加 AI 占位消息
  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'text',
    content: '',
    payload: null,
    timestamp: Date.now(),
    isTyping: true,
  }
  messages.value.push(assistantMessage)

  // 清空输入
  userInput.value = ''
  errorMsg.value = ''
  isTyping.value = true

  nextTick(() => {
    const el = inputRef.value
    if (el) el.style.height = 'auto'
    scrollToBottom()
  })

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
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
            if (data.type === 'event-list' && data.payload) {
              assistantMessage.type = 'event-list'
              assistantMessage.payload = data.payload as EventListPayload
              assistantMessage.isTyping = false
            }
            if (data.chunk) {
              assistantMessage.content += data.chunk
            }
            if (data.done) {
              assistantMessage.isTyping = false
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
        if (data.type === 'event-list' && data.payload) {
          assistantMessage.type = 'event-list'
          assistantMessage.payload = data.payload as EventListPayload
          assistantMessage.isTyping = false
        }
        if (data.chunk) {
          assistantMessage.content += data.chunk
        }
      } catch (e) {
        console.error('解析缓冲区 SSE 数据失败：', dataStr, e)
      }
    }
  } catch (err) {
    // 出错时移除占位 AI 消息，避免留下空气泡
    messages.value.pop()
    errorMsg.value = `调用失败：${(err as Error).message}`
  } finally {
    isTyping.value = false
    assistantMessage.isTyping = false
  }
}
```

- [ ] **Step 5: 重写模板**

替换 `<template>` 为：

```vue
<template>
  <div class="chat-container">
    <h1 class="title">🤖 AI 流式对话 Demo</h1>

    <div ref="messagesRef" class="messages-area">
      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />
    </div>

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
        :disabled="isTyping || !userInput.trim()"
        @click="sendMessage"
      >
        {{ isTyping ? '输出中...' : '发送' }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 6: 调整样式**

将 `.content-area` 相关样式替换为 `.messages-area`：

```css
.messages-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 16px;
}
```

删除 `.content-area` 样式块（如果存在）。

- [ ] **Step 7: 类型检查**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/frontend && npm run build
```

Expected: 构建成功，输出到 `frontend/dist/`。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.vue
git commit -m "feat: switch to chat history layout with user/assistant bubbles"
```

---

## Task 3: 端到端验证

**Files:**
- 无新文件

- [ ] **Step 1: 启动后端服务**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning && npm run server
```

Expected: 控制台输出 `SSE 服务已启动：http://localhost:3000/api/chat`。

- [ ] **Step 2: 启动前端开发服务器**

在另一个终端运行：
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/frontend && npm run dev
```

Expected: Vite 启动在 `http://localhost:5173/`。

- [ ] **Step 3: 浏览器验证**

打开 `http://localhost:5173/`，依次验证：

1. 发送第一条问题 → 用户气泡出现在右侧，AI 气泡出现在左侧并流式输出。
2. 发送第二条问题 → 第一条问答仍保留在上方，新问答追加到底部。
3. 输入经营事件类问题（如"签约"）→ 事件列表以 AI 消息形式嵌入在历史中展示。
4. 页面刷新后 → 历史记录清空（符合设计）。
5. 空输入或 AI 输出中时 → 发送按钮禁用。

- [ ] **Step 4: Commit 验证结果（可选）**

如无需代码改动，无需额外 commit。

---

## Task 4: 最终构建与提交前检查

**Files:**
- 无新文件

- [ ] **Step 1: 前端生产构建**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning/frontend && npm run build
```

Expected: `vue-tsc -b && vite build` 成功，无类型错误。

- [ ] **Step 2: 后端构建**

Run:
```bash
cd /Users/liuxiaojie/Desktop/我的项目/ai-learning && npm run build
```

Expected: `tsc` 成功，无类型错误。

- [ ] **Step 3: ESLint 说明**

当前项目根目录与 `frontend/` 目录均未配置 ESLint。本计划以 `npm run build`（TypeScript 类型检查）作为提交前质量门槛。如需补充 ESLint，请另行说明。

- [ ] **Step 4: 最终 Commit**

```bash
git status
```

确认变更文件后：

```bash
git add docs/superpowers/specs/2026-07-02-chat-history-qq-layout-design.md

git add docs/superpowers/plans/2026-07-02-chat-history-qq-layout-plan.md

git commit -m "docs: add chat history QQ-layout design and implementation plan"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** 设计文档中的消息类型、组件拆分、状态流转、UI 布局均有对应任务。
- [x] **Placeholder scan:** 无 TBD/TODO/"稍后实现"。
- [x] **Type consistency:** `ChatMessage` 接口在 `ChatMessage.vue` 与 `App.vue` 中字段一致。
- [x] **Scope check:** 未引入全局状态管理或后端改动，符合"仅当前会话保留"的约束。

---

## 执行方式选择

计划已保存到 `docs/superpowers/plans/2026-07-02-chat-history-qq-layout-plan.md`。

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 分配给独立子代理执行，我负责审查。
2. **Inline Execution** — 在当前会话中按 Task 逐步执行。

请选择一种方式，确认后立即开始编码。
