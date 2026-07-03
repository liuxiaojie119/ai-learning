<script setup lang="ts">
import { ref, computed } from 'vue'

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

interface Props {
  title: string
  subtitle: string
  tabs: string[]
  total: number
  data: EventItem[]
  pagination: Pagination
}

const props = defineProps<Props>()

const activeTab = ref(props.tabs[0] ?? '全部')
const currentPage = ref(props.pagination.page)

const filteredData = computed(() => {
  if (activeTab.value === '全部') return props.data
  return props.data.filter(item => item.type === activeTab.value)
})

const totalPages = computed(() =>
  Math.ceil(filteredData.value.length / props.pagination.pageSize)
)

const pagedData = computed(() => {
  const start = (currentPage.value - 1) * props.pagination.pageSize
  return filteredData.value.slice(start, start + props.pagination.pageSize)
})

function switchTab(tab: string) {
  activeTab.value = tab
  currentPage.value = 1
}

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(date: string | null): string {
  return date ?? '-'
}
</script>

<template>
  <div class="event-list">
    <header class="event-header">
      <div class="event-header-main">
        <span class="event-dot" />
        <h3 class="event-title-text">{{ title }}</h3>
        <span class="event-subtitle">{{ subtitle }}</span>
      </div>
      <span class="event-total">共 {{ total }} 事件</span>
    </header>

    <nav class="event-tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        class="event-tab"
        :class="{ active: activeTab === tab }"
        @click="switchTab(tab)"
      >
        {{ tab }}
      </button>
    </nav>

    <div class="event-timeline">
      <div
        v-for="(item, index) in pagedData"
        :key="`${item.project}-${index}`"
        class="event-item"
      >
        <div class="event-item-left">
          <div class="event-timeline-line" />
          <div class="event-timeline-dot" />
        </div>

        <div class="event-item-right">
          <div class="event-item-meta">
            <span class="event-item-date">{{ item.date }}</span>
            <span class="event-item-type">{{ item.type }}</span>
          </div>

          <div class="event-item-card">
            <div class="event-item-head">
              <span class="event-company">{{ item.company }}</span>
              <span class="event-amp">&amp;</span>
              <span class="event-project">{{ item.project }}</span>
            </div>

            <div class="event-item-tag">{{ item.type }}</div>

            <div class="event-item-body">
              <span>销售员：{{ item.sales }}</span>
              <span class="dot" />
              <span>签约客户：{{ item.company }}</span>
              <span class="dot" />
              <span>实际签约时间：{{ item.actualDate }}</span>
              <span class="dot" />
              <span>预计签约时间：{{ formatDate(item.expectedDate) }}</span>
              <span class="dot" />
              <span>上周签约：{{ formatMoney(item.lastWeekAmount) }} 万</span>
              <span class="dot" />
              <span>商机金额：{{ formatMoney(item.opportunityAmount) }} 万</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer v-if="totalPages > 1" class="event-pagination">
      <button
        class="event-page-btn"
        :disabled="currentPage === 1"
        @click="prevPage"
      >
        上一页
      </button>
      <span class="event-page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button
        class="event-page-btn"
        :disabled="currentPage === totalPages"
        @click="nextPage"
      >
        下一页
      </button>
    </footer>
  </div>
</template>

<style scoped>
.event-list {
  background: linear-gradient(180deg, #1a1d29 0%, #11131a 100%);
  border-radius: 12px;
  padding: 16px;
  color: #e4e6eb;
  font-size: 13px;
  line-height: 1.5;
}

@media (min-width: 768px) {
  .event-list {
    padding: 24px;
  }
}

.event-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.event-header-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00d4ff;
  flex-shrink: 0;
}

.event-title-text {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.event-subtitle {
  color: #8b92a8;
  font-size: 12px;
}

.event-total {
  color: #8b92a8;
  font-size: 12px;
  flex-shrink: 0;
}

.event-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.event-tab {
  padding: 5px 12px;
  border-radius: 16px;
  border: 1px solid #2e3344;
  background: transparent;
  color: #9aa3b8;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.event-tab:hover {
  border-color: #4a5570;
  color: #c8ceda;
}

.event-tab.active {
  background: #2b6aff;
  border-color: #2b6aff;
  color: #ffffff;
}

.event-timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-item {
  display: flex;
  gap: 12px;
}

.event-item-left {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}

.event-timeline-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #2e3344;
}

.event-timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #00d4ff;
  background: #1a1d29;
  margin-top: 4px;
  z-index: 1;
}

.event-item-right {
  flex: 1;
  min-width: 0;
}

.event-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.event-item-date {
  color: #8b92a8;
  font-size: 12px;
}

.event-item-type {
  padding: 2px 8px;
  border-radius: 4px;
  background: #2a3a4a;
  color: #7dd3c0;
  font-size: 11px;
}

.event-item-card {
  background: #222636;
  border-radius: 10px;
  padding: 12px;
  border: 1px solid #2e3344;
}

.event-item-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.event-company,
.event-project {
  word-break: break-word;
}

.event-amp {
  color: #8b92a8;
  font-weight: 400;
}

.event-item-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  background: rgba(125, 211, 192, 0.15);
  color: #7dd3c0;
  font-size: 11px;
  margin-bottom: 10px;
}

.event-item-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: #9aa3b8;
  font-size: 12px;
  line-height: 1.6;
}

.event-item-body .dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #5a6278;
  flex-shrink: 0;
}

.event-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #2e3344;
}

.event-page-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #2e3344;
  background: transparent;
  color: #c8ceda;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.event-page-btn:hover:not(:disabled) {
  border-color: #4a5570;
  background: #2a2f40;
}

.event-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.event-page-info {
  color: #8b92a8;
  font-size: 12px;
}
</style>
