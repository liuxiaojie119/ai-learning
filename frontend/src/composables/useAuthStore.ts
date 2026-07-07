import { ref, computed } from 'vue'

export interface AuthUser {
  id: string
  username: string
}

const token = ref<string | null>(localStorage.getItem('ai-learning-token'))
const user = ref<AuthUser | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

const isAuthenticated = computed(() => !!token.value && !!user.value)

function setAuth(newToken: string, newUser: AuthUser): void {
  token.value = newToken
  user.value = newUser
  localStorage.setItem('ai-learning-token', newToken)
}

function clearAuth(): void {
  token.value = null
  user.value = null
  localStorage.removeItem('ai-learning-token')
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  }
  if (token.value) {
    headers.Authorization = `Bearer ${token.value}`
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    clearAuth()
    throw new Error('登录已过期，请重新登录')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(data.error || `请求失败：${res.status}`)
  }

  return res.json() as Promise<T>
}

async function stream(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  }
  if (token.value) {
    headers.Authorization = `Bearer ${token.value}`
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    clearAuth()
    throw new Error('登录已过期，请重新登录')
  }

  return res
}

async function login(username: string, password: string): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    const data = await api<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setAuth(data.token, data.user)
  } catch (err) {
    error.value = (err as Error).message
    throw err
  } finally {
    isLoading.value = false
  }
}

async function register(username: string, password: string): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    const data = await api<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setAuth(data.token, data.user)
  } catch (err) {
    error.value = (err as Error).message
    throw err
  } finally {
    isLoading.value = false
  }
}

async function logout(): Promise<void> {
  try {
    await api('/api/auth/logout', { method: 'POST' })
  } catch {
    // 即使后端请求失败也清除本地状态
  } finally {
    clearAuth()
  }
}

async function restoreSession(): Promise<void> {
  const savedToken = token.value
  if (!savedToken) return

  isLoading.value = true
  try {
    const data = await api<{ user: AuthUser }>('/api/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
    user.value = data.user
  } catch {
    clearAuth()
  } finally {
    isLoading.value = false
  }
}

export function useAuthStore() {
  return {
    token,
    user,
    isLoading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    restoreSession,
    fetchWithAuth: api,
    fetchStream: stream,
  }
}
