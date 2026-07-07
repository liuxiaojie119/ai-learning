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
