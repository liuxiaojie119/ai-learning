<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

// 定义组件接收的属性
interface Props {
  // 当前已显示的完整文本内容
  content: string
  // 是否正在流式输出中
  isTyping: boolean
}

const props = defineProps<Props>()

// 初始化 Markdown 渲染器：支持代码高亮、表格、加粗等格式
const md = new MarkdownIt({
  html: false,        // 禁止原始 HTML，防止 XSS
  linkify: true,      // 自动识别链接
  typographer: true,  // 优化排版
})

// 将完整内容渲染为 HTML
const renderedHtml = computed(() => md.render(props.content))
</script>

<template>
  <div class="type-writer">
    <!-- 使用 v-html 渲染 Markdown 转换后的 HTML -->
    <div class="markdown-body" v-html="renderedHtml" />
    <!-- 闪烁光标：仅在输出中显示 -->
    <span v-if="isTyping" class="cursor">|</span>
  </div>
</template>

<style scoped>
.type-writer {
  min-height: 40px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #333;
  word-break: break-word;
}

@media (min-width: 768px) {
  .type-writer {
    padding: 16px;
    font-size: 14px;
  }
}

/* Markdown 基础样式 */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin-top: 16px;
  margin-bottom: 12px;
  font-weight: 600;
  line-height: 1.25;
  color: #24292e;
}

.markdown-body :deep(p) {
  margin: 0 0 12px 0;
}

.markdown-body :deep(strong) {
  font-weight: 600;
  color: #24292e;
}

.markdown-body :deep(code) {
  padding: 2px 6px;
  background: rgba(175, 184, 193, 0.2);
  border-radius: 4px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.markdown-body :deep(pre) {
  padding: 12px;
  overflow-x: auto;
  background: #f6f8fa;
  border-radius: 8px;
  margin-bottom: 16px;
}

@media (min-width: 768px) {
  .markdown-body :deep(pre) {
    padding: 16px;
  }
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
  font-size: 13px;
  line-height: 1.6;
  word-break: normal;
  white-space: pre;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin-bottom: 12px;
}

.markdown-body :deep(li) {
  margin-bottom: 4px;
}

.markdown-body :deep(table) {
  display: block;
  width: 100%;
  max-width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  overflow-x: auto;
}

.markdown-body :deep(thead),
.markdown-body :deep(tbody) {
  display: table;
  width: 100%;
  min-width: 480px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid #d0d7de;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f6f8fa;
  font-weight: 600;
}

.markdown-body :deep(blockquote) {
  margin: 0 0 12px 0;
  padding: 0 12px;
  color: #57606a;
  border-left: 4px solid #d0d7de;
}

.markdown-body :deep(a) {
  color: #0969da;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.cursor {
  display: inline-block;
  color: #409eff;
  font-weight: bold;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
