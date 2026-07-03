# 流式输出停止/打断按钮设计文档

## 背景与目标

当前聊天界面在 AI 流式输出期间，底部按钮显示为禁用状态的"输出中..."，用户只能等待回复完成。本设计目标是在 AI 输出期间提供一个"停止"按钮，允许用户随时打断流式输出，并将已输出的内容保留为最终回复。

## 需求范围

1. AI 流式输出期间，底部"发送"按钮切换为"停止"按钮。
2. 点击"停止"后立即中止 SSE 请求，AI 不再继续输出。
3. 保留已输出的文本或事件列表内容，作为最终回复展示在历史记录中。
4. 停止后用户可以立即输入并发送下一条消息。
5. 不引入"暂停/继续"功能，不支持从中断点恢复输出。
6. 不改动后端接口，仅在前端 `App.vue` 中实现中止逻辑。

## 交互设计

### 输出前
- 输入框可输入。
- 底部按钮显示"发送"。
- "发送"按钮在输入为空时禁用。

### 输出中
- 用户点击"发送"后，按钮立即切换为"停止"。
- 输入框保持可输入，用户可提前准备下一条问题。
- 当前 AI 消息以占位消息形式显示，并带有 `isTyping=true` 的打字机效果。

### 点击停止
- 立即调用 `AbortController.abort()` 中止当前 fetch 请求。
- `reader.read()` 抛出 `AbortError`，流式循环退出。
- 当前 AI 消息的 `isTyping` 设为 `false`，全局 `isTyping` 设为 `false`。
- 按钮恢复为"发送"。
- 不显示红色错误提示。

### 停止后
- 用户可立即发送新消息。
- 新消息追加到历史记录末尾，按现有流程继续。

## 状态与数据流

### 新增状态（`App.vue`）

```typescript
const abortController = ref<AbortController | null>(null)
```

- 在 `sendMessage` 发起 fetch 前创建新的 `AbortController` 实例。
- 将 `signal` 传入 `fetch` 的 `options.signal`。
- 输出自然结束或被手动停止后，清理为 `null`。

### 新增函数

```typescript
function stopGenerating() {
  const controller = abortController.value
  if (controller) {
    controller.abort()
    abortController.value = null
  }
}
```

### `sendMessage` 调整

1. 发送前检查：若存在旧 `abortController`（理论上不应发生），先 abort 并清理。
2. 创建 `AbortController` 并保存到 `abortController`。
3. `fetch('/api/chat', { ..., signal: abortController.value.signal })`。
4. 在 `while (true)` 循环中读取 SSE chunk，正常追加到 `lastMessage.content`。
5. 当用户点击"停止"：
   - `reader.read()` 抛出 `AbortError`。
   - 进入 `catch` 分支，判断错误类型：
     - 若是 `AbortError`，仅结束输出状态，不显示 `errorMsg`。
     - 若是其他错误，沿用现有错误处理（显示 `errorMsg` 并移除 AI 占位消息）。
6. `finally` 中设置 `isTyping.value = false` 和 `lastMessage.isTyping = false`，清理 `abortController`。

## UI 变更

### 按钮模板

```vue
<button
  class="send-btn"
  :class="{ 'stop-btn': isTyping }"
  :disabled="!isTyping && !userInput.trim()"
  @click="isTyping ? stopGenerating() : sendMessage()"
>
  {{ isTyping ? '停止' : '发送' }}
</button>
```

### 按钮样式

沿用现有 `.send-btn` 样式。为"停止"状态增加一个可区分的变体类 `.stop-btn`，例如背景色改为 `#f56c6c`（红色）或 `#e6a23c`（橙色），以明确提示这是一个破坏性/中断操作。

```css
.stop-btn {
  background: #f56c6c;
}

.stop-btn:hover:not(:disabled) {
  background: #f89898;
}
```

## 边界处理

| 场景 | 行为 |
|------|------|
| 用户连续点击"停止" | 第一次调用 `abort()` 后 `abortController` 已清理，后续点击无操作 |
| 在事件列表输出期间停止 | 保留已返回的 `payload`，AI 消息切换为 `event-list` 类型并展示 |
| 网络错误与手动停止区分 | 手动停止不显示 `errorMsg`；真实网络错误仍显示 |
| 输出自然完成 | 按钮自动恢复为"发送"，无需用户干预 |
| 页面刷新 | 状态清空，符合现有设计 |

## 非目标

- 不实现"暂停/继续"功能。
- 不支持从中断点恢复输出。
- 不将未完成的回复保存到本地存储或后端。
- 不改动 `ChatMessage.vue`、`TypeWriter.vue`、`EventList.vue` 组件。
- 不改动后端 SSE 接口。

## 验证标准

1. 点击"发送"后按钮立即变为"停止"。
2. AI 输出过程中点击"停止"，输出立即停止，已显示内容保留。
3. 停止后不显示红色错误提示。
4. 停止后可立即输入并发送下一条消息。
5. 自然输出完成后按钮恢复为"发送"。
6. `npm run build` 通过，无类型错误。
