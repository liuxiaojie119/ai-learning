# 聊天界面改造设计文档

## 背景与目标

当前前端页面为单轮对话：用户点击发送后，上一次的问题与回答会被清空，无法回溯查看。本设计目标是将页面改造为类似 QQ/微信的会话式聊天界面，并实现当前页面会话内的历史记录保留。

## 需求范围

1. 保留当前页面会话的问答历史（页面刷新后清空）。
2. 聊天布局改为：**用户消息靠右，AI 消息靠左**。
3. 每条消息显示头像、昵称、时间戳。
4. 底部输入框位置与交互保持现状。
5. 事件列表（`event-list`）作为历史记录中的一条 AI 消息直接嵌入展示。
6. 文本消息继续沿用 `TypeWriter` 组件的 Markdown 渲染与打字机效果。

## 数据模型

新增统一消息类型 `ChatMessage`：

```typescript
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  type: 'text' | 'event-list'
  content: string
  payload: EventListPayload | null
  timestamp: number
  isTyping: boolean
}
```

- `role`: 区分用户与 AI。
- `type`: 区分文本回复与结构化事件列表。
- `content`: `type='text'` 时的完整 Markdown 文本。
- `payload`: `type='event-list'` 时的结构化数据，沿用现有 `EventListPayload` 类型。
- `timestamp`: 消息创建时间戳，用于展示时间。
- `isTyping`: 仅对当前正在流式输出的 AI 消息为 `true`。

## 组件结构

| 组件 | 职责 |
|------|------|
| `App.vue` | 状态管理、发送消息、SSE 解析、列表滚动、错误提示。 |
| `ChatMessage.vue`（新建） | 单条消息渲染：头像、昵称、时间戳、左右布局、内部根据类型渲染 `TypeWriter` 或 `EventList`。 |
| `TypeWriter.vue` | 保持现有功能，作为文本消息的渲染器。 |
| `EventList.vue` | 保持现有功能，作为事件列表消息的渲染器。 |

## 状态流转

1. 用户输入并点击发送。
2. `App.vue` push 一条 `role='user'` 的消息到 `messages` 数组。
3. 立即 push 一条 `role='assistant'` 的空占位消息：`type='text'`, `content=''`, `isTyping=true`。
4. 发起 SSE 请求，逐 chunk 更新最后一条 AI 消息的 `content`。
5. 若后端返回 `type='event-list'`，将该条 AI 消息切换为 `type='event-list'` 并赋值 `payload`，同时 `isTyping=false`。
6. 收到 `done` 后设置 `isTyping=false`。
7. 出现网络或解析错误时，在输入框上方显示 `errorMsg`（沿用现有方式），不插入历史记录。
8. 每次消息列表变化后自动滚动到底部。

## UI 布局

- 顶部：保留标题 `🤖 AI 流式对话 Demo`。
- 中部：消息列表区域，`flex: 1`，垂直滚动。
  - 用户消息：靠右，蓝色气泡，头像在右侧。
  - AI 消息：靠左，浅灰色气泡，头像在左侧。
  - 事件列表消息：作为 AI 消息的一种，气泡内直接渲染 `EventList` 卡片。
- 底部：保留现有固定输入栏。

## 关键样式草案

```css
.message-row.user { justify-content: flex-end; }
.message-row.assistant { justify-content: flex-start; }

.bubble.user {
  background: #409eff;
  color: #fff;
  border-radius: 12px 12px 4px 12px;
}

.bubble.assistant {
  background: #f5f5f5;
  color: #333;
  border-radius: 12px 12px 12px 4px;
}
```

## 边界处理

- 空输入或 AI 正在输出时，发送按钮禁用。
- 发送新消息后自动滚动到底部。
- 事件列表消息内部的分页、筛选状态由 `EventList` 组件自行维护。
- 页面刷新后历史清空，符合"仅当前会话保留"的约束。

## 非目标

- 不引入 Pinia/Vuex 等全局状态管理（当前需求内存数组足够）。
- 不持久化到 localStorage 或后端数据库。
- 不改造后端接口，仅消费现有 `/api/chat` SSE 接口。
