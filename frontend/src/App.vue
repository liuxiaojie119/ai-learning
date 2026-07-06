<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import ChatMessage from './components/ChatMessage.vue'

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
// 当前会话的消息历史
const messages = ref<ChatMessageItem[]>([])

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
  if (!message || isTyping.value) return

  // 如果存在未清理的旧控制器（异常场景），先中止并清理
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }

  abortController.value = new AbortController()

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
  const assistantMessage: ChatMessageItem = {
    id: crypto.randomUUID(),
    role: 'assistant',
    type: 'text',
    content: '',
    payload: null,
    timestamp: Date.now(),
    isTyping: true,
  }
  messages.value.push(assistantMessage)

  // 通过响应式数组元素更新，确保 Vue 能追踪变化
  const lastMessage = messages.value[messages.value.length - 1]

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
      body: JSON.stringify({ message }),
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
              lastMessage.type = 'event-list'
              lastMessage.payload = data.payload as EventListPayload
              lastMessage.isTyping = false
            }
            if (data.chunk) {
              // 追加每个流式文本片段
              lastMessage.content += data.chunk
            }
            if (data.done) {
              lastMessage.isTyping = false
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
          lastMessage.type = 'event-list'
          lastMessage.payload = data.payload as EventListPayload
          lastMessage.isTyping = false
        }
        if (data.chunk) {
          lastMessage.content += data.chunk
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
      // 真实错误：移除占位 AI 消息，避免留下空气泡
      messages.value.pop()
      errorMsg.value = `调用失败：${error.message}`
    }
  } finally {
    isTyping.value = false
    lastMessage.isTyping = false
    abortController.value = null
  }
}
</script>

<template>
  <div class="chat-container">
    <h1 class="title">🤖 AI 流式对话 Demo</h1>

    <DynamicScroller
      ref="messagesRef"
      :items="messages"
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
        :disabled="!isTyping && !userInput.trim()"
        @click="isTyping ? stopGenerating() : sendMessage()"
      >
        {{ isTyping ? '停止' : '发送' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
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

.title {
  text-align: left;
  margin-bottom: 16px;
  color: #333;
  font-size: 18px;
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .title {
    font-size: 20px;
    margin-bottom: 20px;
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
