import { ref, computed } from 'vue'
import { useAuthStore } from './useAuthStore'

export type MessageRole = 'system' | 'user' | 'assistant'
export type MessageType = 'text' | 'event-list'

export interface EventItem {
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

export interface Pagination {
  page: number
  pageSize: number
  total: number
}

export interface EventListPayload {
  title: string
  subtitle: string
  tabs: string[]
  total: number
  data: EventItem[]
  pagination: Pagination
}

export interface ChatMessage {
  id: string
  role: MessageRole
  type: MessageType
  content: string
  payload: EventListPayload | null
  timestamp: number
  isTyping?: boolean
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const sessions = ref<ChatSession[]>([])
const currentSessionId = ref<string>('')
const isLoading = ref(false)
const error = ref<string | null>(null)

const currentSession = computed(() =>
  sessions.value.find((s) => s.id === currentSessionId.value) ?? null
)

const authStore = useAuthStore()

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  return authStore.fetchWithAuth<T>(url, options)
}

async function loadSessions(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    const data = await api<{ sessions: Array<Omit<ChatSession, 'messages'>> }>('/api/sessions')
    sessions.value = data.sessions.map((s) => ({ ...s, messages: [] }))
    if (sessions.value.length > 0 && !currentSessionId.value) {
      currentSessionId.value = sessions.value[0].id
      await loadMessages(currentSessionId.value)
    }
    if (sessions.value.length === 0) {
      await createSession()
    }
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isLoading.value = false
  }
}

async function loadMessages(sessionId: string): Promise<void> {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return
  try {
    const data = await api<{ messages: ChatMessage[] }>(`/api/sessions/${sessionId}/messages`)
    session.messages = data.messages
  } catch (err) {
    error.value = (err as Error).message
  }
}

async function createSession(): Promise<ChatSession> {
  const session = await api<ChatSession>('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '新对话' }),
  })
  const newSession: ChatSession = { ...session, messages: [] }
  sessions.value.unshift(newSession)
  currentSessionId.value = newSession.id
  return newSession
}

async function switchSession(id: string): Promise<void> {
  if (sessions.value.some((s) => s.id === id)) {
    currentSessionId.value = id
    await loadMessages(id)
  }
}

async function deleteSession(id: string): Promise<void> {
  await api(`/api/sessions/${id}`, { method: 'DELETE' })
  sessions.value = sessions.value.filter((s) => s.id !== id)
  if (currentSessionId.value === id) {
    currentSessionId.value = sessions.value[0]?.id ?? ''
    if (!currentSessionId.value) {
      await createSession()
    } else {
      await loadMessages(currentSessionId.value)
    }
  }
}

async function addMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  type: MessageType = 'text',
  payload: EventListPayload | null = null
): Promise<void> {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return

  const tempMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role,
    type,
    content,
    payload,
    timestamp: Date.now(),
  }
  session.messages.push(tempMessage)
  session.updatedAt = Date.now()

  // 用户的第一条消息作为会话标题
  if (role === 'user' && session.messages.filter((m) => m.role === 'user').length === 1) {
    session.title = content.slice(0, 20) || '新对话'
  }

  // 用户消息需要持久化到后端；assistant 回复由 /api/chat 负责写入
  if (role !== 'user') return

  try {
    const saved = await api<ChatMessage>(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        type,
        content,
        payload,
        timestamp: tempMessage.timestamp,
      }),
    })
    const idx = session.messages.findIndex((m) => m.id === tempMessage.id)
    if (idx !== -1) {
      session.messages[idx] = saved
    }
  } catch (err) {
    error.value = (err as Error).message
  }
}

function updateLastMessage(
  sessionId: string,
  content: string,
  type: MessageType = 'text',
  payload: EventListPayload | null = null
): void {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return
  const last = session.messages.at(-1)
  if (!last) return
  last.content += content
  if (type !== 'text') {
    last.type = type
    last.payload = payload
  }
  session.updatedAt = Date.now()
}

function setLastMessageTyping(sessionId: string, isTyping: boolean): void {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return
  const last = session.messages.at(-1)
  if (last) {
    ;(last as ChatMessage & { isTyping?: boolean }).isTyping = isTyping
  }
}

export function useChatStore() {
  return {
    sessions,
    currentSessionId,
    currentSession,
    isLoading,
    error,
    loadSessions,
    createSession,
    switchSession,
    deleteSession,
    addMessage,
    updateLastMessage,
    setLastMessageTyping,
  }
}
