import mysql from "mysql2/promise";

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
  updated_at: number;
}

export interface CreateUserInput {
  username: string;
  passwordHash: string;
}

export interface SessionRow {
  id: string;
  user_id: string | null;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  session_id: string;
  role: "system" | "user" | "assistant";
  type: "text" | "event-list";
  content: string;
  payload: Record<string, unknown> | null;
  timestamp: number;
  created_at: number;
}

export interface CreateSessionInput {
  title?: string | undefined;
  userId?: string | null | undefined;
}

export interface CreateMessageInput {
  sessionId: string;
  role: "system" | "user" | "assistant";
  type?: "text" | "event-list" | undefined;
  content: string;
  payload?: Record<string, unknown> | null | undefined;
  timestamp?: number | undefined;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || "ai_learning",
  user: process.env.DB_USER || "root",
  ...(process.env.DB_PASSWORD ? { password: process.env.DB_PASSWORD } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
});

/**
 * 获取会话列表，按 updated_at 降序排列
 */
export async function getSessions(userId?: string | null): Promise<SessionRow[]> {
  const [rows] = userId
    ? await pool.execute(
        "SELECT id, user_id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
        [userId]
      )
    : await pool.execute(
        "SELECT id, user_id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC"
      );
  return (rows as mysql.RowDataPacket[]).map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string | null,
    title: row.title as string,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  }));
}

/**
 * 根据 ID 获取单个会话
 */
export async function getSessionById(id: string): Promise<SessionRow | null> {
  const [rows] = await pool.execute(
    "SELECT id, user_id, title, created_at, updated_at FROM chat_sessions WHERE id = ?",
    [id]
  );
  const row = (rows as mysql.RowDataPacket[])[0];
  if (!row) return null;
  return {
    id: row.id as string,
    user_id: row.user_id as string | null,
    title: row.title as string,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

/**
 * 创建新会话
 */
export async function createSession(input: CreateSessionInput): Promise<SessionRow> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const title = input.title?.trim() || "新对话";
  const userId = input.userId ?? null;

  await pool.execute(
    "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [id, userId, title, now, now]
  );

  return {
    id,
    user_id: userId,
    title,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 删除会话，关联消息会由外键级联删除
 */
export async function deleteSession(id: string): Promise<void> {
  await pool.execute("DELETE FROM chat_sessions WHERE id = ?", [id]);
}

/**
 * 获取某会话的消息列表，按 timestamp 升序排列
 */
export async function getMessages(sessionId: string): Promise<MessageRow[]> {
  const [rows] = await pool.execute(
    "SELECT id, session_id, role, type, content, payload, timestamp, created_at FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC",
    [sessionId]
  );
  return (rows as mysql.RowDataPacket[]).map((row) => ({
    id: row.id as string,
    session_id: row.session_id as string,
    role: row.role as "system" | "user" | "assistant",
    type: row.type as "text" | "event-list",
    content: row.content as string,
    payload: row.payload ? (JSON.parse(row.payload as string) as Record<string, unknown>) : null,
    timestamp: Number(row.timestamp),
    created_at: Number(row.created_at),
  }));
}

/**
 * 向会话添加一条消息，并更新会话的 updated_at
 */
export async function addMessage(input: CreateMessageInput): Promise<MessageRow> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const timestamp = input.timestamp ?? now;
  const type = input.type || "text";
  const payload = input.payload ?? null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      "INSERT INTO chat_messages (id, session_id, role, type, content, payload, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, input.sessionId, input.role, type, input.content, payload ? JSON.stringify(payload) : null, timestamp, now]
    );

    await connection.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", [now, input.sessionId]);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return {
    id,
    session_id: input.sessionId,
    role: input.role,
    type,
    content: input.content,
    payload,
    timestamp,
    created_at: now,
  };
}

/**
 * 获取某会话最近 N 条非 system 消息，用于构造大模型上下文
 */
export async function getRecentMessages(
  sessionId: string,
  limit = 20
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const [rows] = await pool.execute(
    "SELECT role, content FROM chat_messages WHERE session_id = ? AND role != 'system' ORDER BY timestamp ASC LIMIT ?",
    [sessionId, String(limit)]
  );
  return (rows as mysql.RowDataPacket[])
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content as string,
    }));
}

/**
 * 根据用户名查询用户
 */
export async function getUserByUsername(username: string): Promise<UserRow | null> {
  const [rows] = await pool.execute(
    "SELECT id, username, password_hash, created_at, updated_at FROM users WHERE username = ?",
    [username]
  );
  const row = (rows as mysql.RowDataPacket[])[0];
  if (!row) return null;
  return {
    id: row.id as string,
    username: row.username as string,
    password_hash: row.password_hash as string,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

/**
 * 根据 ID 查询用户
 */
export async function getUserById(id: string): Promise<UserRow | null> {
  const [rows] = await pool.execute(
    "SELECT id, username, password_hash, created_at, updated_at FROM users WHERE id = ?",
    [id]
  );
  const row = (rows as mysql.RowDataPacket[])[0];
  if (!row) return null;
  return {
    id: row.id as string,
    username: row.username as string,
    password_hash: row.password_hash as string,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

/**
 * 创建新用户
 */
export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await pool.execute(
    "INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [id, input.username, input.passwordHash, now, now]
  );

  return {
    id,
    username: input.username,
    password_hash: input.passwordHash,
    created_at: now,
    updated_at: now,
  };
}

/**
 * 更新会话标题
 */
export async function updateSessionTitle(id: string, title: string): Promise<void> {
  await pool.execute("UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?", [
    title,
    Date.now(),
    id,
  ]);
}

/**
 * 关闭数据库连接池，主要用于测试或进程退出时
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
