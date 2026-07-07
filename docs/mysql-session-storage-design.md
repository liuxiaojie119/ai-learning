# 会话存储从 localStorage 迁移到 MySQL 技术方案

> 文档版本：v1.0
> 编写日期：2026-07-07
> 目标读者：前后端开发者
> 适用范围：ai-learning 项目 Phase 2

---

## 一、背景与目标

### 1.1 当前现状

Phase 1 已实现多轮对话与会话管理，但会话数据存储在前端浏览器的 `localStorage` 中：

- 存储 Key：`ai-learning-chat-sessions`
- 数据内容：所有会话列表及每个会话的消息历史
- 生命周期：跟随当前浏览器，换设备/换浏览器/清除缓存后数据丢失

### 1.2 存在问题

| 问题 | 说明 | 影响 |
|------|------|------|
| **无法跨设备同步** | localStorage 绑定浏览器 | 用户在电脑 A 聊的内容，电脑 B 看不到 |
| **无法多用户隔离** | 所有打开页面的人共享同一份本地数据 | 没有账号体系时无法区分用户 |
| **容量受限** | 浏览器一般限制 5-10MB | 消息多了可能存不下 |
| **数据易丢失** | 清除缓存、无痕模式、重装系统都会丢失 | 重要对话历史无法长期保留 |
| **服务端无法利用历史** | 后端只接收当前请求的消息数组 | 无法做消息搜索、统计分析、上下文优化 |

### 1.3 迁移目标

将会话（Session）和消息（Message）数据从浏览器 `localStorage` 迁移到服务端 **MySQL** 数据库：

1. 数据持久化保存在服务端
2. 支持按用户隔离会话数据
3. 支持跨设备、跨浏览器访问同一套会话
4. 前后端通过 REST API 读写会话和消息
5. 保留现有前端交互体验（新建/切换/删除会话、流式回复）

---

## 二、技术选型

基于当前项目技术栈，本次迁移**不引入 Java/Spring Boot**，继续沿用现有 Node.js 后端：

| 层级 | 当前技术 | 迁移后技术 | 说明 |
|------|---------|-----------|------|
| 前端 | Vue 3 + TypeScript | 不变 | 仅改造 `useChatStore` |
| 后端 | Node.js + TypeScript + 原生 http | 不变 | 新增数据库访问模块 |
| 数据库 | 无 | MySQL 8.x | 新增会话表和消息表 |
| ORM/驱动 | 无 | `mysql2` | 原生 SQL 驱动，轻量可控 |
| 连接池 | 无 | `generic-pool` 或 `mysql2` 内置 pool | 生产环境避免频繁建连 |
| ID 生成 | `crypto.randomUUID()` | 不变 | 继续使用 UUID 作为主键 |
| 配置 | `.env` | `.env` 新增数据库配置 | 不改动现有配置读取方式 |

**为什么不选 ORM（Prisma/TypeORM/Sequelize）？**

当前项目后端非常轻量，只有 1 个接口文件（`src/server.ts`）和 1 个模型调用文件（`src/index.ts`）。引入 ORM 会增加学习成本、构建依赖和部署复杂度。使用 `mysql2` + 手写 SQL 更符合项目当前阶段"简单可控"的原则。

---

## 三、数据库设计

### 3.1 ER 图

```
┌─────────────────────┐       ┌─────────────────────┐
│   chat_sessions     │       │   chat_messages     │
├─────────────────────┤       ├─────────────────────┤
│ PK id               │◄──────┤ FK session_id       │
│    user_id (可选)   │       │ PK id               │
│    title            │       │    role             │
│    created_at       │       │    type             │
│    updated_at       │       │    content          │
└─────────────────────┘       │    payload (JSON)   │
                              │    timestamp        │
                              │    created_at       │
                              └─────────────────────┘
```

### 3.2 表结构

#### chat_sessions（会话表）

```sql
CREATE TABLE chat_sessions (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY COMMENT '会话ID（UUID）',
  user_id     VARCHAR(64)  NULL     COMMENT '用户ID，未登录时可为空',
  title       VARCHAR(255) NOT NULL DEFAULT '新对话' COMMENT '会话标题',
  created_at  BIGINT       NOT NULL COMMENT '创建时间戳（毫秒）',
  updated_at  BIGINT       NOT NULL COMMENT '最后更新时间戳（毫秒）',

  KEY idx_user_id_updated (user_id, updated_at DESC) COMMENT '按用户查询最近会话'
) COMMENT='AI 对话会话表';
```

#### chat_messages（消息表）

```sql
CREATE TABLE chat_messages (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY COMMENT '消息ID（UUID）',
  session_id  VARCHAR(64)  NOT NULL COMMENT '所属会话ID',
  role        VARCHAR(16)  NOT NULL COMMENT '角色：system/user/assistant',
  type        VARCHAR(16)  NOT NULL DEFAULT 'text' COMMENT '类型：text/event-list',
  content     TEXT         NOT NULL COMMENT '消息内容',
  payload     JSON         NULL     COMMENT '经营事件等结构化数据',
  timestamp   BIGINT       NOT NULL COMMENT '消息时间戳（毫秒）',
  created_at  BIGINT       NOT NULL COMMENT '入库时间戳（毫秒）',

  CONSTRAINT fk_session
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    ON DELETE CASCADE,

  KEY idx_session_created (session_id, created_at) COMMENT '按会话查询消息'
) COMMENT='AI 对话消息表';
```

### 3.3 设计说明

1. **不使用自增 ID**：与现有前端 `crypto.randomUUID()` 保持一致，避免 ID 格式不一致。
2. **时间戳使用 BIGINT**：与前端 `Date.now()` 毫秒时间戳对齐，避免时区和格式转换问题。
3. **`payload` 用 JSON 类型**：经营事件等结构化数据直接存 JSON，MySQL 8 支持 JSON 索引和查询。
4. **外键级联删除**：删除会话时自动删除关联消息，保持数据一致性。
5. **预留 `user_id`**：当前未登录，先预留字段，后续接入账号体系时直接复用。

---

## 四、后端 API 设计

### 4.1 接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET`  | `/api/sessions` | 获取当前用户的会话列表 |
| `POST` | `/api/sessions` | 创建新会话 |
| `GET`  | `/api/sessions/:id/messages` | 获取某会话的消息列表 |
| `POST` | `/api/sessions/:id/messages` | 向某会话添加一条消息 |
| `DELETE` | `/api/sessions/:id` | 删除某会话 |
| `POST` | `/api/chat` | 流式对话（改造后从 MySQL 读取历史） |

### 4.2 接口详情

#### GET /api/sessions

**响应示例：**

```json
{
  "sessions": [
    {
      "id": "uuid-1",
      "title": "介绍一下任素汐",
      "createdAt": 1717777777777,
      "updatedAt": 1717778888888
    }
  ]
}
```

**SQL：**

```sql
SELECT id, user_id, title, created_at, updated_at
FROM chat_sessions
WHERE user_id = ?
ORDER BY updated_at DESC;
```

#### POST /api/sessions

**请求体：**

```json
{
  "title": "新对话"
}
```

**响应示例：**

```json
{
  "id": "uuid-new",
  "title": "新对话",
  "createdAt": 1717779999999,
  "updatedAt": 1717779999999
}
```

**SQL：**

```sql
INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
VALUES (?, ?, ?, ?, ?);
```

#### GET /api/sessions/:id/messages

**响应示例：**

```json
{
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "type": "text",
      "content": "你好",
      "payload": null,
      "timestamp": 1717777777777
    }
  ]
}
```

**SQL：**

```sql
SELECT id, session_id, role, type, content, payload, timestamp
FROM chat_messages
WHERE session_id = ?
ORDER BY timestamp ASC;
```

#### POST /api/sessions/:id/messages

**请求体：**

```json
{
  "role": "assistant",
  "type": "text",
  "content": "你好！",
  "payload": null,
  "timestamp": 1717777778888
}
```

**SQL：**

```sql
INSERT INTO chat_messages (id, session_id, role, type, content, payload, timestamp, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);
```

同时更新会话 `updated_at`：

```sql
UPDATE chat_sessions SET updated_at = ? WHERE id = ?;
```

#### DELETE /api/sessions/:id

**SQL：**

```sql
DELETE FROM chat_sessions WHERE id = ?;
```

外键级联会自动删除消息。

#### POST /api/chat（改造后）

改造要点：

1. 请求体保持 `{ messages: [...] }` 不变
2. 但在调用模型前，后端**不再只信任前端传来的 messages**
3. 后端根据 `sessionId` 从 MySQL 读取真实历史，校验前端传来消息的合法性
4. 最终透传给模型的 `messages` 由后端组装

**推荐流程：**

```
前端发送:
{
  "sessionId": "uuid-1",
  "messages": [ { role: "user", content: "我叫小明" } ]
}

后端处理:
1. 校验 sessionId 存在
2. 把用户消息写入 chat_messages
3. 从 MySQL 读取该会话最近 20 条消息
4. 调用 streamZhipuChat(messages)
5. 流式返回 assistant 内容
6. 把完整 assistant 回复写入 chat_messages
```

---

## 五、前端改造方案

### 5.1 useChatStore 改造

当前 `useChatStore` 直接读写 `localStorage`，改造后变为调用后端 API：

```ts
// 改造前
const sessions = ref<ChatSession[]>(loadSessions())
watch(sessions, saveSessions, { deep: true })

// 改造后
async function loadSessions(): Promise<void> {
  const res = await fetch('/api/sessions')
  const data = await res.json()
  sessions.value = data.sessions
}

async function createSession(): Promise<ChatSession> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '新对话' })
  })
  const session = await res.json()
  sessions.value.unshift(session)
  currentSessionId.value = session.id
  return session
}
```

### 5.2 状态管理变化

| 能力 | 改造前 | 改造后 |
|------|--------|--------|
| 加载会话 | 从 localStorage 同步读取 | 页面挂载时异步调用 API |
| 创建会话 | 本地生成 UUID 写入 localStorage | 请求后端创建 |
| 添加消息 | 本地 push + localStorage | 请求后端写入 |
| 切换会话 | 本地切换 ID | 本地切换，消息按需加载 |
| 删除会话 | 本地 filter + localStorage | 请求后端删除 |

### 5.3 Loading 与错误处理

新增状态：

```ts
const isLoading = ref(false)
const error = ref<string | null>(null)
```

- 加载会话时显示 loading
- API 失败时显示错误提示，不破坏本地状态
- 发送消息时采用乐观更新：先显示用户消息，再调后端

---

## 六、数据流时序图

### 6.1 页面首次加载

```
浏览器                    前端 Vue                      后端 Node.js                 MySQL
  │                         │                              │                          │
  │  打开页面                │                              │                          │
  │────────────────────────>│                              │                          │
  │                         │  onMounted()                 │                          │
  │                         │  useChatStore.loadSessions() │                          │
  │                         │─────────────────────────────>│                          │
  │                         │                              │  SELECT sessions         │
  │                         │                              │─────────────────────────>│
  │                         │                              │  返回会话列表             │
  │                         │                              │<─────────────────────────│
  │                         │  渲染会话列表                 │                          │
  │<────────────────────────│                              │                          │
```

### 6.2 发送消息并流式回复

```
浏览器        前端 Vue              后端 Node.js           MySQL           智谱 API
  │             │                       │                    │                │
  │ 输入+发送    │                       │                    │                │
  │────────────>│                       │                    │                │
  │             │ POST /api/chat        │                    │                │
  │             │ {sessionId, messages} │                    │                │
  │             │──────────────────────>│                    │                │
  │             │                       │ INSERT user msg    │                │
  │             │                       │───────────────────>│                │
  │             │                       │ SELECT history     │                │
  │             │                       │───────────────────>│                │
  │             │                       │ streamZhipuChat()  │                │
  │             │                       │─────────────────────────────────────>│
  │             │                       │ SSE chunk          │                │
  │             │ SSE chunk             │<─────────────────────────────────────│
  │  逐字显示    │<─────────────────────│                    │                │
  │<────────────│                       │                    │                │
  │             │                       │ INSERT assistant   │                │
  │             │                       │───────────────────>│                │
```

---

## 七、错误处理与边界情况

### 7.1 网络异常

| 场景 | 处理策略 |
|------|---------|
| 加载会话列表失败 | 显示错误提示，保留空列表，允许重试 |
| 创建会话失败 | 提示用户，不切换当前会话 |
| 发送消息失败 | 移除空的 assistant 占位消息，保留用户消息 |
| 数据库写入成功但 SSE 失败 | 用户消息已保存，可重试获取回复 |

### 7.2 数据一致性

- 所有写操作放在同一个数据库事务中
- 用户消息写入和 `updated_at` 更新必须原子完成
- assistant 回复写入失败不影响用户消息

### 7.3 并发场景

- 同一用户在多个标签页同时操作：以数据库最终状态为准
- 切换会话时重新拉取最新消息，避免本地缓存过期

### 7.4 容量限制

- 单条 content 最大 64KB（TEXT 类型足够）
- 继续保留最近 20 条消息截断策略
- 后续可考虑按时间归档老消息

---

## 八、迁移方案

### 8.1 实施步骤

| 步骤 | 任务 | 文件 |
|------|------|------|
| 1 | 搭建 MySQL 并执行建表 SQL | `sql/chat_schema.sql` |
| 2 | 后端新增数据库模块 | `src/db.ts` |
| 3 | 后端新增会话/消息 API | `src/server.ts` |
| 4 | 改造 `/api/chat` 从 MySQL 读取历史 | `src/server.ts` |
| 5 | 前端改造 `useChatStore` | `frontend/src/composables/useChatStore.ts` |
| 6 | 前端新增 loading/error 状态 | `frontend/src/composables/useChatStore.ts` |
| 7 | 手动验证：创建/切换/删除/刷新/多设备 | 浏览器 |
| 8 | 删除 localStorage 相关代码 | 全项目清理 |

### 8.2 数据迁移（可选）

如果希望保留现有 localStorage 中的会话数据，可以写一个一次性迁移脚本：

```ts
// scripts/migrate-localstorage-to-mysql.ts
const raw = localStorage.getItem('ai-learning-chat-sessions')
const sessions = raw ? JSON.parse(raw) : []
for (const session of sessions) {
  await insertSession(session)
  for (const message of session.messages) {
    await insertMessage(session.id, message)
  }
}
```

运行方式：在浏览器控制台执行，或导出 localStorage 文件后用 Node 脚本导入。

---

## 九、风险与回滚

### 9.1 主要风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 数据库连接泄露 | 服务不可用 | 使用连接池，确保每次 query 后 release |
| SQL 注入 | 数据泄露 | 全部使用参数化查询 |
| API 响应变慢 | 用户体验差 | 加索引、分页加载、必要时加 Redis 缓存 |
| 前端状态与数据库不一致 | 消息重复或丢失 | 关键操作以数据库为准，切换会话时刷新 |

### 9.2 回滚方案

如需回滚到 localStorage 方案：

1. 恢复 `useChatStore` 的 localStorage 读写逻辑
2. 后端 `/api/chat` 恢复为只接收前端传来的 messages
3. 保留 MySQL 数据一段时间，避免数据丢失

---

## 十、附录

### 10.1 新增依赖

后端 `package.json`：

```json
{
  "dependencies": {
    "mysql2": "^3.10.0"
  }
}
```

### 10.2 环境变量

`.env` 新增：

```env
# MySQL 配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ai_learning
DB_USER=root
DB_PASSWORD=root
```

### 10.3 初始化 SQL

见 `sql/chat_schema.sql`：

```sql
CREATE DATABASE IF NOT EXISTS ai_learning DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ai_learning;

CREATE TABLE chat_sessions (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id     VARCHAR(64)  NULL,
  title       VARCHAR(255) NOT NULL DEFAULT '新对话',
  created_at  BIGINT       NOT NULL,
  updated_at  BIGINT       NOT NULL,
  KEY idx_user_id_updated (user_id, updated_at DESC)
);

CREATE TABLE chat_messages (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  session_id  VARCHAR(64)  NOT NULL,
  role        VARCHAR(16)  NOT NULL,
  type        VARCHAR(16)  NOT NULL DEFAULT 'text',
  content     TEXT         NOT NULL,
  payload     JSON         NULL,
  timestamp   BIGINT       NOT NULL,
  created_at  BIGINT       NOT NULL,
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  KEY idx_session_created (session_id, created_at)
);
```

---

> 本文档基于 ai-learning 项目当前 Node.js + TypeScript + Vue 3 技术栈设计，参考 Elden Flow 后端架构文档的工程化思路。
