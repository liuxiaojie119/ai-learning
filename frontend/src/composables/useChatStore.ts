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

const STORAGE_KEY = 'ai-learning-chat-sessions'

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

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChatSession[]) : []
  } catch {
    return []
  }
}

function saveSessions(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value))
}

const sessions = ref<ChatSession[]>(loadSessions())
const currentSessionId = ref<string>(sessions.value[0]?.id ?? createSession().id)

const currentSession = computed(() =>
  sessions.value.find((s) => s.id === currentSessionId.value) ?? sessions.value[0]
)

function switchSession(id: string): void {
  if (sessions.value.some((s) => s.id === id)) {
    currentSessionId.value = id
  }
}

function deleteSession(id: string): void {
  sessions.value = sessions.value.filter((s) => s.id !== id)
  if (currentSessionId.value === id) {
    currentSessionId.value = sessions.value[0]?.id ?? createSession().id
  }
}

function addMessage(sessionId: string, role: MessageRole, content: string): void {
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

function updateLastMessage(sessionId: string, content: string): void {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return
  const last = session.messages.at(-1)
  if (last) {
    last.content += content
    session.updatedAt = Date.now()
  }
}

function setLastMessageTyping(sessionId: string, isTyping: boolean): void {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return
  const last = session.messages.at(-1)
  if (last) {
    ;(last as ChatMessage & { isTyping?: boolean }).isTyping = isTyping
  }
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
