import mysql from "mysql2/promise";
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
export async function getSessions(userId) {
    const [rows] = userId
        ? await pool.execute("SELECT id, user_id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC", [userId])
        : await pool.execute("SELECT id, user_id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC");
    return rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        created_at: Number(row.created_at),
        updated_at: Number(row.updated_at),
    }));
}
/**
 * 根据 ID 获取单个会话
 */
export async function getSessionById(id) {
    const [rows] = await pool.execute("SELECT id, user_id, title, created_at, updated_at FROM chat_sessions WHERE id = ?", [id]);
    const row = rows[0];
    if (!row)
        return null;
    return {
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        created_at: Number(row.created_at),
        updated_at: Number(row.updated_at),
    };
}
/**
 * 创建新会话
 */
export async function createSession(input) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const title = input.title?.trim() || "新对话";
    const userId = input.userId ?? null;
    await pool.execute("INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [id, userId, title, now, now]);
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
export async function deleteSession(id) {
    await pool.execute("DELETE FROM chat_sessions WHERE id = ?", [id]);
}
/**
 * 获取某会话的消息列表，按 timestamp 升序排列
 */
export async function getMessages(sessionId) {
    const [rows] = await pool.execute("SELECT id, session_id, role, type, content, payload, timestamp, created_at FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC", [sessionId]);
    return rows.map((row) => ({
        id: row.id,
        session_id: row.session_id,
        role: row.role,
        type: row.type,
        content: row.content,
        payload: row.payload ? JSON.parse(row.payload) : null,
        timestamp: Number(row.timestamp),
        created_at: Number(row.created_at),
    }));
}
/**
 * 向会话添加一条消息，并更新会话的 updated_at
 */
export async function addMessage(input) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const timestamp = input.timestamp ?? now;
    const type = input.type || "text";
    const payload = input.payload ?? null;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute("INSERT INTO chat_messages (id, session_id, role, type, content, payload, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [id, input.sessionId, input.role, type, input.content, payload ? JSON.stringify(payload) : null, timestamp, now]);
        await connection.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", [now, input.sessionId]);
        await connection.commit();
    }
    catch (err) {
        await connection.rollback();
        throw err;
    }
    finally {
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
export async function getRecentMessages(sessionId, limit = 20) {
    const [rows] = await pool.execute("SELECT role, content FROM chat_messages WHERE session_id = ? AND role != 'system' ORDER BY timestamp ASC LIMIT ?", [sessionId, String(limit)]);
    return rows
        .filter((row) => row.role === "user" || row.role === "assistant")
        .map((row) => ({
        role: row.role,
        content: row.content,
    }));
}
/**
 * 根据用户名查询用户
 */
export async function getUserByUsername(username) {
    const [rows] = await pool.execute("SELECT id, username, password_hash, created_at, updated_at FROM users WHERE username = ?", [username]);
    const row = rows[0];
    if (!row)
        return null;
    return {
        id: row.id,
        username: row.username,
        password_hash: row.password_hash,
        created_at: Number(row.created_at),
        updated_at: Number(row.updated_at),
    };
}
/**
 * 根据 ID 查询用户
 */
export async function getUserById(id) {
    const [rows] = await pool.execute("SELECT id, username, password_hash, created_at, updated_at FROM users WHERE id = ?", [id]);
    const row = rows[0];
    if (!row)
        return null;
    return {
        id: row.id,
        username: row.username,
        password_hash: row.password_hash,
        created_at: Number(row.created_at),
        updated_at: Number(row.updated_at),
    };
}
/**
 * 创建新用户
 */
export async function createUser(input) {
    const id = crypto.randomUUID();
    const now = Date.now();
    await pool.execute("INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [id, input.username, input.passwordHash, now, now]);
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
export async function updateSessionTitle(id, title) {
    await pool.execute("UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?", [
        title,
        Date.now(),
        id,
    ]);
}
/**
 * 关闭数据库连接池，主要用于测试或进程退出时
 */
export async function closePool() {
    await pool.end();
}
