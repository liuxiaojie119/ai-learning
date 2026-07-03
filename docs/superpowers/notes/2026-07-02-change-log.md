# 2026-07-02 变更记录

## 背景

当前项目是一个基于 Vue 3 + TypeScript + Vite 的 AI 对话 Demo，后端通过 Node.js SSE 接口 `/api/chat` 提供流式回复。本次变更是将原本的单轮对话页面改造为类似 QQ/微信的会话式聊天界面，并针对长对话场景做性能优化。

相关设计/计划文档：
- `docs/superpowers/specs/2026-07-02-chat-history-qq-layout-design.md`
- `docs/superpowers/plans/2026-07-02-chat-history-qq-layout-plan.md`

---

## 主要变更

### 1. 聊天界面改为会话式布局

**目标：** 保留当前页面会话的历史问答记录，发送新消息后上一次问答仍然可见。

**实现：**
- `App.vue` 中新增 `messages` 消息列表，替代原来的 `displayedText` / `responseType` / `eventListData` 单轮状态。
- 发送问题时追加一条 `role='user'` 消息；同时追加一条 `role='assistant'` 占位消息。
- SSE 流式输出实时更新最后一条 AI 消息的内容。
- 事件列表（`event-list`）类型的回复作为历史消息直接嵌入展示。

### 2. 新建 `ChatMessage.vue` 组件

**文件：** `frontend/src/components/ChatMessage.vue`

**职责：**
- 单条消息渲染：头像、昵称、时间戳。
- 根据 `role` 区分左右布局：
  - 用户消息：靠右，蓝色气泡 `#409eff`，头像在右侧。
  - AI 消息：靠左，灰色气泡 `#f5f5f5`，头像在左侧。
- 根据 `type` 渲染内容：
  - `text`：使用 `TypeWriter.vue` 渲染 Markdown。
  - `event-list`：使用 `EventList.vue` 渲染结构化事件列表。

### 3. 样式细节调整

- 移除 `TypeWriter.vue` 默认的 `min-height: 60px`，让空消息/短消息的气泡高度随内容增长。
- 用户消息气泡与头像颜色统一为发送按钮颜色 `#409eff`。
- 调整气泡圆角、间距等视觉细节。

### 4. 修复 SSE 流式输出不显示的 Bug

**现象：** 浏览器控制台能看到 SSE 数据到达，但页面没有渲染内容。

**原因：** 代码中直接修改了本地变量 `assistantMessage.content`，而该变量并未指向 Vue 响应式数组中的代理对象，因此视图没有更新。

**修复：** `push` 占位消息后，通过 `messages.value[messages.value.length - 1]` 重新获取响应式引用，后续所有更新都针对该引用进行。

### 5. 引入虚拟滚动优化长对话性能

**目标：** 当对话超过 50-100 条时，避免 DOM 节点过多导致页面卡顿。

**实现：**
- 安装依赖：`vue-virtual-scroller@2`（Vue 3 版本，对应 React 中的 `react-virtuoso`）。
- 在 `App.vue` 中用 `DynamicScroller` / `DynamicScrollerItem` 替换原来的 `v-for` 消息列表。
- 配置 `:min-item-size="54"` 和 `:size-dependencies` 以支持文本消息、事件列表卡片的动态高度。
- `scrollToBottom` 改为调用 `scroller.scrollToItem(messages.value.length - 1)`。

---

## 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/components/ChatMessage.vue` | 新建 + 调整 | 单条聊天消息组件，包含头像/时间/左右布局 |
| `frontend/src/App.vue` | 大幅修改 | 消息列表管理、SSE 解析、虚拟滚动、自动滚动 |
| `frontend/package.json` | 修改 | 新增依赖 `vue-virtual-scroller@2` |
| `frontend/package-lock.json` | 修改 | 依赖锁定文件同步更新 |

未修改但复用的组件：
- `frontend/src/components/TypeWriter.vue`
- `frontend/src/components/EventList.vue`

---

## 验证结果

- ✅ 前端生产构建：`npm run build`（在 `frontend/` 目录）通过，`vue-tsc` 无类型错误，`vite build` 成功。
- ✅ 后端构建：`npm run build`（在项目根目录）通过，`tsc` 无类型错误。
- ✅ 后端 SSE 接口 `curl` 测试正常，返回流式数据。
- ⚠️ 项目当前无测试脚本，`npm test` 返回 `Error: no test specified`（既有状态）。
- ⚠️ 虚拟滚动和长对话性能需要在浏览器中手动验证（对话 50+ 条后检查 DOM 节点数量）。

---

## 关键决策与注意事项

1. **历史记录仅当前会话保留**
   - 消息列表存储在 `App.vue` 的内存中，页面刷新后清空。
   - 未引入 Pinia/Vuex 或 localStorage，避免过度设计。

2. **事件列表作为历史消息嵌入**
   - 经营事件查询返回的 `EventList` 卡片直接作为一条 AI 消息展示在历史记录中。

3. **虚拟滚动选型**
   - 选用 `vue-virtual-scroller` 的 `DynamicScroller`，因为消息高度不固定（文本长短、事件列表卡片高度差异大）。

4. **非 git 仓库**
   - 当前项目目录未初始化 git，所有修改未提交。
   - 如需版本管理，可在项目根目录执行 `git init`。

---

## 待验证/待优化项

- [ ] 浏览器中连续发送 50+ 条消息，确认虚拟滚动生效且滚动流畅。
- [ ] 事件列表消息在虚拟滚动中的高度计算是否准确。
- [ ] 长对话场景下 `scrollToBottom` 是否仍能准确滚动到底部。
- [ ] 是否需要补充 ESLint / 单元测试。

---

## 相关命令

```bash
# 前端开发服务器
cd frontend && npm run dev

# 前端生产构建
cd frontend && npm run build

# 后端构建（项目根目录）
npm run build

# 启动后端 SSE 服务
npm run server
```
