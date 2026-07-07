<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { useRouter } from 'vue-router'
import ChatMessage from '../components/ChatMessage.vue'
import SessionList from '../components/SessionList.vue'
import { useChatStore, type ChatMessage as StoreChatMessage } from '../composables/useChatStore'
import { useAuthStore } from '../composables/useAuthStore'

interface VirtualScrollerInstance extends ComponentPublicInstance {
  scrollToItem(index: number): void
}

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

interface ChatMessageItem {
  id: string
  role: 'user' | 'assistant'
  type: 'text' | 'event-list'
  content: string
  payload: EventListPayload | null
  timestamp: number
  isTyping: boolean
}

// 用户输入的问题
const userInput = ref('')
// 是否正在流式输出中
const isTyping = ref(false)
// 当前 SSE 请求的 AbortController，用于用户点击“停止”时中断输出
const abortController = ref<AbortController | null>(null)
// 错误提示
const errorMsg = ref('')
// 输入框 DOM 引用
const inputRef = ref<HTMLTextAreaElement | null>(null)
// 消息列表虚拟滚动组件引用
const messagesRef = ref<VirtualScrollerInstance | null>(null)

const store = useChatStore()
const authStore = useAuthStore()
const router = useRouter()
const messages = computed(() => store.currentSession.value?.messages ?? [])

onMounted(() => {
  store.loadSessions()
})

async function handleLogout(): Promise<void> {
  await authStore.logout()
  router.push('/login')
}

const displayMessages = computed<ChatMessageItem[]>(() =>
  messages.value
    .filter((m): m is StoreChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({
      id: m.id,
      role: m.role,
      type: m.type,
      content: m.content,
      payload: m.payload,
      timestamp: m.timestamp,
      isTyping: false,
    }))
)

// 是否正在发送消息流程中（包含写入用户消息和等待 AI 回复）
const isSending = ref(false)

/**
 * 根据内容自动调整 textarea 高度
 */
function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// 输入内容变化时自动调整高度
watch(userInput, () => {
  nextTick(autoResize)
})

// 页面进入时弹出欢迎提示
// onMounted(() => {
//   alert('欢迎来到 AI 流式对话 Demo')
// })

/**
 * 滚动消息列表到底部
 */
function scrollToBottom() {
  nextTick(() => {
    const scroller = messagesRef.value
    if (scroller && messages.value.length > 0) {
      scroller.scrollToItem(messages.value.length - 1)
    }
  })
}

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

/**
 * 发送消息并接收 SSE 流式响应
 */
async function sendMessage() {
  const message = userInput.value.trim()
  if (!message || isTyping.value || isSending.value) return

  let sessionId = store.currentSessionId.value
  if (!sessionId) {
    const newSession = await store.createSession()
    sessionId = newSession.id
  }

  isSending.value = true

  // 如果存在未清理的旧控制器（异常场景），先中止并清理
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }

  abortController.value = new AbortController()

  try {
    // 先确保用户消息写入后端，再添加 AI 占位消息
    await store.addMessage(sessionId, 'user', message)
    store.addMessage(sessionId, 'assistant', '')

    // 清空输入
    userInput.value = ''
    errorMsg.value = ''
    isTyping.value = true

    nextTick(() => {
      const el = inputRef.value
      if (el) el.style.height = 'auto'
      scrollToBottom()
    })

    const response = await authStore.fetchStream('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
      signal: abortController.value?.signal,
    })

    if (!response.ok) {
      // 非流式错误响应，读取错误信息
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.error || `请求失败：${response.status}`);
    }

    // 获取响应体的可读流读取器
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    // 循环读取流式数据
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // 保留未完整的一行到下一次处理
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        // SSE 数据行格式：data: {...}
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim()
          try {
            const data = JSON.parse(dataStr)
            if (data.type === 'event-list' && data.payload) {
              const session = store.currentSession.value
              const last = session?.messages.at(-1)
              if (last && last.role === 'assistant') {
                last.type = 'event-list'
                last.payload = data.payload as EventListPayload
              }
            }
            if (data.chunk) {
              // 追加每个流式文本片段
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

    // 处理缓冲区的最后残留数据
    if (buffer.trim().startsWith('data:')) {
      const dataStr = buffer.trim().slice(5).trim()
      try {
        const data = JSON.parse(dataStr)
        if (data.type === 'event-list' && data.payload) {
          const session = store.currentSession.value
          const last = session?.messages.at(-1)
          if (last && last.role === 'assistant') {
            last.type = 'event-list'
            last.payload = data.payload as EventListPayload
          }
        }
        if (data.chunk) {
          store.updateLastMessage(sessionId, data.chunk)
        }
      } catch (e) {
        console.error('解析缓冲区 SSE 数据失败：', dataStr, e)
      }
    }
  } catch (err) {
    const error = err as Error
    // 用户手动中止：保留已输出内容，不显示错误提示
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      errorMsg.value = ''
    } else {
      // 真实错误：移除空的 AI 占位消息
      const session = store.currentSession.value
      const last = session?.messages.at(-1)
      if (session && last && last.role === 'assistant' && last.content === '' && last.type === 'text') {
        session.messages.pop()
      }
      errorMsg.value = `调用失败：${error.message}`
    }
  } finally {
    isTyping.value = false
    isSending.value = false
    abortController.value = null
  }
}
</script>

<template>
  <div class="app-layout">
    <SessionList />
    <div class="chat-container">
      <header class="chat-header">
        <h1 class="title">🤖 AI 助手</h1>
        <button class="logout-btn" @click="handleLogout">登出</button>
      </header>

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
            :size-dependencies="[
              item.content,
              item.type,
              item.payload,
            ]"
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
          :disabled="(!isTyping && !userInput.trim()) || isSending"
          @click="isTyping ? stopGenerating() : sendMessage()"
        >
          {{ isTyping ? '停止' : isSending ? '发送中' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.chat-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-width: 100%;
  padding: 16px;
  padding-bottom: 0;
  text-align: left;
}

@media (min-width: 768px) {
  .chat-container {
    padding: 24px 40px;
    padding-bottom: 0;
  }
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  margin-bottom: 16px;
}

.title {
  text-align: left;
  margin: 0;
  color: #333;
  font-size: 18px;
}

.logout-btn {
  padding: 6px 14px;
  background: #f3f4f6;
  color: #606266;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: #e5e7eb;
  color: #409eff;
}

@media (min-width: 768px) {
  .chat-header {
    margin-bottom: 20px;
  }

  .title {
    font-size: 20px;
  }
}

.messages-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 16px;
}

.input-area {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  gap: 12px;
  padding: 12px 0;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  margin: 0 -16px;
  padding-left: 16px;
  padding-right: 16px;
}

@media (min-width: 768px) {
  .input-area {
    margin: 0 -40px;
    padding-left: 40px;
    padding-right: 40px;
  }
}

.chat-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  min-height: 28px;
  max-height: 120px;
  resize: none;
  overflow-y: auto;
  font-family: inherit;
}

.chat-input:focus {
  border-color: #409eff;
}

.send-btn {
  padding: 6px 14px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
  height: 28px;
  min-height: 28px;
  align-self: flex-start;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: #66b1ff;
}

.stop-btn {
  background: #f56c6c;
}

.stop-btn:hover:not(:disabled) {
  background: #f89898;
}

.send-btn:disabled {
  background: #a0cfff;
  cursor: not-allowed;
}

.error-msg {
  margin-top: 16px;
  color: #f56c6c;
  font-size: 14px;
}
</style>
