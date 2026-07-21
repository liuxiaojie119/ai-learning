# 前端工程师转应用工程师：ai-learning 项目学习路线图计划

## 背景与目标

本项目当前是一个基于 **Vue 3 + Vite + Node.js + MySQL + Zhipu AI** 的流式对话应用，已实现：

- 用户注册 / 登录 / JWT 鉴权
- 多会话管理与 MySQL 持久化
- SSE 流式输出与打字机效果
- 简单 Function Calling（经营事件渲染）
- 前端状态管理（Composable）与路由

作为前端工程师向应用工程师（全栈方向）进阶，当前项目已经覆盖了完整的数据链路。接下来需要系统性地补齐后端基础、工程化和 AI 应用开发能力，把 Demo 打磨成可维护、可扩展的真实应用。

本计划按优先级分为 4 个阶段，每个阶段都能直接在现有代码基座上落地。

---

## 学习路线图

| 阶段 | 主题 | 建议周期 | 核心能力 | 阶段产出 |
|---|---|---|---|---|
| **Phase 1** | 吃透当前项目数据流 | 1–2 周 | HTTP / RESTful API、三层架构、数据库、JWT、SSE | 能独立 trace 从前端到数据库的完整请求链路 |
| **Phase 2** | 后端现代化重构 | 2–4 周 | Express / Fastify、ORM、输入校验、测试 | 后端代码量减半、可测试、类型安全 |
| **Phase 3** | 前端工程化与体验 | 2–3 周 | Pinia、错误处理、组件化、性能优化 | 前端结构清晰、交互体验完整 |
| **Phase 4** | AI 应用进阶 | 持续 | Prompt Engineering、RAG、多模型、Agent | 从调用模型到构建知识库 / Agent |

**执行原则**：按顺序推进，Phase 1 是后续所有高级能力的地基；每个阶段做完整后再进入下一阶段。

---

## Phase 1：吃透当前项目数据流

### 目标
从前端工程师视角，彻底理解一条请求从点击按钮到数据返回的完整路径。

### 核心任务

1. **Trace 后端数据流**
   - 从 `frontend/src/composables/useChatStore.ts` 出发，跟踪到 `src/routes/chat.ts` → `src/controllers/chatController.ts` → `src/services/chatService.ts` → `src/db.ts` → MySQL。
   - 用 curl / Postman 手动调通 `/api/auth/login`、`/api/sessions`、`/api/chat`。
   - 在数据库里直接查询 `chat_sessions`、`messages` 表，观察数据形态。

2. **理解认证与权限**
   - 研究 `auth.ts`（JWT 签发）、`middleware/auth.ts`（鉴权）、`useAuthStore.ts`（前端存 token）。
   - 尝试修改 JWT 过期时间，观察前端如何处理过期。
   - 对比 `localStorage` token 与 `httpOnly cookie` 在 XSS 防护上的差异。

3. **掌握 SSE 流式输出**
   - 用 curl 直接调智谱 SSE 接口，观察数据分块效果。
   - 阅读 `TypeWriter.vue` 与 `ChatView.vue` 的流式渲染逻辑。
   - 尝试实现"停止生成"按钮：使用 `AbortController` 中断 SSE 连接。

### 交付标准
- 能不看文档说出一次登录、一次聊天的完整数据流。
- 能独立定位前后端联调问题。
- 完成"停止生成"功能。

---

## Phase 2：后端现代化重构

### 目标
把当前手写 HTTP 服务的 Demo 后端，升级为符合工程标准的 Node.js 后端。

### 核心任务

1. **引入 Express / Fastify**
   - 将 `http.createServer` 替换为 Express 或 Fastify。
   - 用 `express.Router()` 重写 `routes/*.ts`。
   - 用统一错误中间件替代每个路由里的 `try/catch`。

2. **引入 ORM（推荐 Prisma）**
   - 用 `schema.prisma` 定义 `User`、`ChatSession`、`Message` 模型。
   - 用 Prisma Client 重写 `db.ts` 里的 SQL。
   - 用 migration 管理数据库变更。

3. **输入校验（Zod）**
   - 定义 `loginSchema`、`chatMessageSchema`。
   - 在 Controller 层先 `schema.parse(req.body)`，再执行业务。
   - 前端表单复用同一份 Zod schema。

4. **补测试**
   - 用 Vitest 给 `authService` 写单元测试。
   - 用 `supertest` 给 `/api/auth/login` 写集成测试。
   - 测试数据库使用独立 test database 或 SQLite 内存版。

### 交付标准
- 后端路由清晰、Controller 薄、Service 可测试。
- 所有 API 入参都有类型安全的校验。
- 核心接口有集成测试覆盖。

---

## Phase 3：前端工程化与体验

### 目标
把前端从"能跑"升级为"好维护、体验完整"。

### 核心任务

1. **状态管理升级（Pinia）**
   - 将 `useChatStore`、`useAuthStore` 迁移到 Pinia。
   - 拆分 `auth`、`chat`、`session` 三个 store。
   - 使用 `pinia-plugin-persistedstate` 持久化登录态。

2. **错误处理与 Loading 状态**
   - 所有异步操作补全 `loading` / `error` / `retry` 状态。
   - 聊天发送中禁用输入框、显示骨架屏。
   - 网络错误时提供可重试提示。

3. **组件化重构**
   - 将 `ChatView.vue` 拆分为 `ChatInput`、`MessageList`、`MessageItem`、`SessionSidebar`。
   - 练习 `defineModel`、`defineExpose`、父子组件通信。
   - 引入 `unplugin-auto-import` 减少样板代码。

4. **工程化配置**
   - 配置 ESLint + Prettier。
   - 引入 Vitest 做前端单元测试。
   - 配置 Husky + lint-staged，提交前自动格式化。

### 交付标准
- 前端组件职责单一，无超大 Vue 文件。
- 异步状态完整，用户能感知 loading / error / retry。
- 有基础的代码规范和测试覆盖。

---

## Phase 4：AI 应用进阶

### 目标
从"调用大模型"进阶到"构建 AI 应用系统"。

### 核心任务

1. **Prompt Engineering**
   - 将系统 prompt 从硬编码改为数据库可配置。
   - 设计 prompt 模板选择器，支持不同场景（代码助手、营销文案、数据分析）。
   - 学习上下文压缩与提示词优化技巧。

2. **RAG 知识库**
   - 接入 Embedding 模型（智谱或 OpenAI）。
   - 使用向量数据库（Chroma / pgvector / 内存版）。
   - 实现文档上传、文本分块、向量检索、增强生成。

3. **多模型切换与 Function Calling 扩展**
   - 抽象当前 `fetchEventsWithTool` 为通用 `ToolRegistry`。
   - 支持动态注册工具（天气、计算、搜索 mock）。
   - 前端根据工具返回类型渲染不同组件。

4. **评估与监控**
   - 引入 prompt 版本管理。
   - 设计回答质量评估方案（人工评分 + 自动指标）。
   - 增加模型调用超时、重试、错误日志。

### 交付标准
- 支持基于文档的问答。
- 支持多工具组合调用。
- 有基础的调用监控和可量化的质量评估。

---

## 下一步建议

如果只能选一件开始，建议：

> **实现"停止生成"按钮**

这件事能覆盖：SSE、AbortController、Vue 响应式、异步状态管理，且是几乎每个 AI 聊天产品都有的功能，做完很有成就感。

完成后，再进入 Phase 2 的后端 Express / Prisma 重构，此时你对"前端需要后端提供什么接口"会有更清晰的理解。

---

## 相关文档

- [前端工程师转 AI 工程师路线图设计](../specs/2026-07-07-frontend-to-ai-engineer-roadmap-design.md)
- [AI 学习项目工程化改进建议](../project-improvement-suggestions.md)
