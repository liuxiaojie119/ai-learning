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
  margin-top: 16px;
}

.message-row.user {
  margin-bottom: 32px;
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
  padding: 12px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.bubble.user {
  padding: 8px 12px;
  background: #409eff;
  color: #fff;
  border-radius: 16px;
}

.bubble.assistant {
  background: #f5f5f5;
  color: #333;
  border-radius: 16px;
}

.bubble :deep(.type-writer) {
  background: transparent;
  padding: 0;
  min-height: auto;
}
</style>
