<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../composables/useAuthStore'

const authStore = useAuthStore()
const router = useRouter()
const isRegister = ref(false)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const localError = ref('')

const submitLabel = computed(() => (isRegister.value ? '注册' : '登录'))
const toggleLabel = computed(() =>
  isRegister.value ? '已有账号？去登录' : '没有账号？去注册'
)

function resetForm(): void {
  username.value = ''
  password.value = ''
  confirmPassword.value = ''
  localError.value = ''
  authStore.error.value = null
}

function toggleMode(): void {
  isRegister.value = !isRegister.value
  resetForm()
}

async function handleSubmit(): Promise<void> {
  localError.value = ''
  authStore.error.value = null

  if (!username.value.trim() || !password.value) {
    localError.value = '用户名和密码不能为空'
    return
  }

  if (isRegister.value && password.value !== confirmPassword.value) {
    localError.value = '两次输入的密码不一致'
    return
  }

  try {
    if (isRegister.value) {
      await authStore.register(username.value.trim(), password.value)
    } else {
      await authStore.login(username.value.trim(), password.value)
    }
    router.push('/')
  } catch {
    // 错误已由 store 写入 authStore.error
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-box">
      <div class="logo">🤖</div>
      <h1 class="title">AI 学习助手</h1>
      <p class="subtitle">{{ isRegister ? '注册新账号' : '欢迎回来' }}</p>

      <form class="form" @submit.prevent="handleSubmit">
        <div class="form-item">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            autocomplete="username"
          />
        </div>

        <div class="form-item">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
          />
        </div>

        <div v-if="isRegister" class="form-item">
          <label for="confirmPassword">确认密码</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            autocomplete="new-password"
          />
        </div>

        <p v-if="localError || authStore.error.value" class="error-msg">
          {{ localError || authStore.error.value }}
        </p>

        <button type="submit" class="submit-btn" :disabled="authStore.isLoading.value">
          {{ authStore.isLoading.value ? '请稍候...' : submitLabel }}
        </button>
      </form>

      <button class="toggle-btn" type="button" @click="toggleMode">
        {{ toggleLabel }}
      </button>

      <p class="hint">默认账号：admin / 1</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: #f8fafc;
  background-image: url('../assets/login-bg.svg');
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
}

.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(248, 250, 252, 0.25);
  pointer-events: none;
}

.login-box {
  position: relative;
  z-index: 1;
  width: 600px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 20px;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-sizing: border-box;
}

.logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: linear-gradient(135deg, #409eff 0%, #7e5cdc 100%);
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(64, 158, 255, 0.35);
}

.title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
  letter-spacing: 0.5px;
}

.subtitle {
  margin: 0 0 28px;
  font-size: 14px;
  color: #6b7280;
  text-align: center;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
}

.form-item label {
  width: 80px;
  flex-shrink: 0;
  margin-right: 20px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  text-align: right;
}

.form-item input {
  flex: 1;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  color: #1f2937;
  background: #ffffff;
  outline: none;
  transition: all 0.2s;
}

.form-item input::placeholder {
  color: #9ca3af;
}

.form-item input:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15);
}

.error-msg {
  margin: 0;
  font-size: 13px;
  color: #f56c6c;
  text-align: center;
}

.submit-btn {
  padding: 13px;
  background: linear-gradient(135deg, #409eff 0%, #7e5cdc 100%);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(64, 158, 255, 0.35);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(64, 158, 255, 0.45);
}

.submit-btn:disabled {
  background: #a0cfff;
  cursor: not-allowed;
  box-shadow: none;
}

.toggle-btn {
  margin-top: 18px;
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  color: #409eff;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.2s;
}

.toggle-btn:hover {
  color: #7e5cdc;
}

.hint {
  margin: 18px 0 0;
  padding-top: 18px;
  border-top: 1px dashed #e5e7eb;
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
}
</style>
