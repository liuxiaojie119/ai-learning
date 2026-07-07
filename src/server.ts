import http from "http";
import url from "url";
import cors from "cors";
import { streamZhipuChat, fetchEventsWithTool, type ChatMessage } from "./index.js";
import {
  getSessions,
  createSession,
  deleteSession,
  getMessages,
  addMessage,
  getSessionById,
  getRecentMessages,
  getUserByUsername,
  getUserById,
  createUser,
  updateSessionTitle,
  type CreateMessageInput,
} from "./db.js";
import { hashPassword, verifyPassword, signToken, getCurrentUser, type JwtPayload } from "./auth.js";

const PORT = Number(process.env.PORT) || 3000;

const corsMiddleware = cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

/**
 * 发送 SSE 数据行
 * @param res HTTP 响应对象
 * @param data 要发送的数据对象
 */
function sendSSE(res: http.ServerResponse, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * 解析 JSON 请求体
 */
function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * 发送 JSON 响应
 */
function sendJSON(res: http.ServerResponse, statusCode: number, data?: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(data !== undefined ? JSON.stringify(data) : undefined);
}

/**
 * 校验请求是否已登录，返回当前用户信息
 */
function requireAuth(req: http.IncomingMessage, res: http.ServerResponse): JwtPayload | null {
  const user = getCurrentUser(req);
  if (!user) {
    sendJSON(res, 401, { error: "未登录或 token 无效" });
  }
  return user;
}

/**
 * 校验会话是否属于当前用户
 */
async function requireSessionOwnership(
  sessionId: string,
  userId: string,
  res: http.ServerResponse
): Promise<boolean> {
  const session = await getSessionById(sessionId);
  if (!session) {
    sendJSON(res, 404, { error: "会话不存在" });
    return false;
  }
  if (session.user_id !== userId) {
    sendJSON(res, 403, { error: "无权访问该会话" });
    return false;
  }
  return true;
}

/**
 * 服务启动时创建默认账号 admin / 1
 */
async function initializeDefaultUser(): Promise<void> {
  try {
    const existing = await getUserByUsername("admin");
    if (existing) return;
    const passwordHash = await hashPassword("1");
    await createUser({ username: "admin", passwordHash });
    console.log("默认账号已创建：admin / 1");
  } catch (err) {
    console.error("创建默认账号失败：", (err as Error).message);
  }
}

const server = http.createServer((req, res) => {
  corsMiddleware(req, res, async () => {
    try {
      const parsedUrl = url.parse(req.url || "", true);
      const pathname = parsedUrl.pathname || "";
      const method = req.method || "";

      // POST /api/auth/register
      if (pathname === "/api/auth/register" && method === "POST") {
        const body = await parseBody(req);
        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!username || !password) {
          sendJSON(res, 400, { error: "用户名和密码不能为空" });
          return;
        }
        if (username.length > 64 || password.length > 128) {
          sendJSON(res, 400, { error: "用户名或密码长度超出限制" });
          return;
        }

        const existing = await getUserByUsername(username);
        if (existing) {
          sendJSON(res, 409, { error: "用户名已存在" });
          return;
        }

        const passwordHash = await hashPassword(password);
        const user = await createUser({ username, passwordHash });
        const token = signToken({ id: user.id, username: user.username });

        sendJSON(res, 201, {
          token,
          user: { id: user.id, username: user.username },
        });
        return;
      }

      // POST /api/auth/login
      if (pathname === "/api/auth/login" && method === "POST") {
        const body = await parseBody(req);
        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";

        const user = await getUserByUsername(username);
        if (!user) {
          sendJSON(res, 401, { error: "用户名或密码错误" });
          return;
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
          sendJSON(res, 401, { error: "用户名或密码错误" });
          return;
        }

        const token = signToken({ id: user.id, username: user.username });
        sendJSON(res, 200, {
          token,
          user: { id: user.id, username: user.username },
        });
        return;
      }

      // GET /api/auth/me
      if (pathname === "/api/auth/me" && method === "GET") {
        const user = requireAuth(req, res);
        if (!user) return;
        sendJSON(res, 200, { user: { id: user.userId, username: user.username } });
        return;
      }

      // POST /api/auth/logout
      if (pathname === "/api/auth/logout" && method === "POST") {
        const user = requireAuth(req, res);
        if (!user) return;
        sendJSON(res, 200, { message: "登出成功" });
        return;
      }

      // GET /api/sessions
      if (pathname === "/api/sessions" && method === "GET") {
        const user = requireAuth(req, res);
        if (!user) return;
        const sessions = await getSessions(user.userId);
        sendJSON(res, 200, {
          sessions: sessions.map((s) => ({
            id: s.id,
            title: s.title,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
          })),
        });
        return;
      }

      // POST /api/sessions
      if (pathname === "/api/sessions" && method === "POST") {
        const user = requireAuth(req, res);
        if (!user) return;
        const body = await parseBody(req);
        const title = typeof body.title === "string" ? body.title : undefined;
        const session = await createSession({ title, userId: user.userId });
        sendJSON(res, 201, {
          id: session.id,
          title: session.title,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
        });
        return;
      }

      // GET /api/sessions/:id/messages
      const messagesMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
      if (messagesMatch && messagesMatch[1] && method === "GET") {
        const user = requireAuth(req, res);
        if (!user) return;
        const sessionId = messagesMatch[1];
        const owned = await requireSessionOwnership(sessionId, user.userId, res);
        if (!owned) return;
        const messages = await getMessages(sessionId);
        sendJSON(res, 200, {
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            type: m.type,
            content: m.content,
            payload: m.payload,
            timestamp: m.timestamp,
          })),
        });
        return;
      }

      // POST /api/sessions/:id/messages
      if (messagesMatch && messagesMatch[1] && method === "POST") {
        const user = requireAuth(req, res);
        if (!user) return;
        const sessionId = messagesMatch[1];
        const owned = await requireSessionOwnership(sessionId, user.userId, res);
        if (!owned) return;
        const body = await parseBody(req);
        const role = body.role;
        const type = body.type;
        const content = body.content;

        if (!role || (role !== "system" && role !== "user" && role !== "assistant")) {
          sendJSON(res, 400, { error: "role 必须是 system、user 或 assistant" });
          return;
        }
        if (typeof content !== "string" || content.length === 0) {
          sendJSON(res, 400, { error: "content 必须是有效字符串" });
          return;
        }

        const message = await addMessage({
          sessionId,
          role,
          type: type === "event-list" ? "event-list" : "text",
          content,
          payload: body.payload as Record<string, unknown> | null | undefined,
          timestamp: typeof body.timestamp === "number" ? body.timestamp : undefined,
        });

        // 用户的第一条消息自动设置为会话标题
        if (role === "user") {
          await updateSessionTitle(sessionId, content.slice(0, 20) || "新对话");
        }

        sendJSON(res, 201, {
          id: message.id,
          role: message.role,
          type: message.type,
          content: message.content,
          payload: message.payload,
          timestamp: message.timestamp,
        });
        return;
      }

      // DELETE /api/sessions/:id
      const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessionMatch && sessionMatch[1] && method === "DELETE") {
        const user = requireAuth(req, res);
        if (!user) return;
        const sessionId = sessionMatch[1];
        const owned = await requireSessionOwnership(sessionId, user.userId, res);
        if (!owned) return;
        await deleteSession(sessionId);
        sendJSON(res, 204);
        return;
      }

      // POST /api/chat
      if (pathname === "/api/chat" && method === "POST") {
        const user = requireAuth(req, res);
        if (!user) return;
        const body = await parseBody(req);
        const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;

        if (!sessionId) {
          sendJSON(res, 400, { error: "sessionId 字段必填" });
          return;
        }

        const owned = await requireSessionOwnership(sessionId, user.userId, res);
        if (!owned) return;

        // 从数据库读取真实历史
        const history = await getRecentMessages(sessionId, 20);
        const lastUserMessage = history.filter((m) => m.role === "user").pop();
        if (!lastUserMessage) {
          sendJSON(res, 400, { error: "会话中至少需要一条 user 消息" });
          return;
        }

        // 统一使用 SSE 格式返回，成功和错误都通过 data: 推送
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });

        // 经营事件类查询：使用 GLM Function Calling 返回结构化数据
        if (/经营事件|签约|收入|回款|验收|预警/.test(lastUserMessage.content)) {
          try {
            const payload = await fetchEventsWithTool(lastUserMessage.content);
            sendSSE(res, { type: "event-list", payload });

            // 将经营事件结果作为 assistant 消息持久化
            await addMessage({
              sessionId,
              role: "assistant",
              type: "event-list",
              content: payload.title || "经营事件列表",
              payload: payload as unknown as Record<string, unknown>,
              timestamp: Date.now(),
            });
          } catch (err) {
            sendSSE(res, { error: (err as Error).message });
          }
          sendSSE(res, { done: true });
          res.end();
          return;
        }

        const chatMessages: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.content }));

        let assistantContent = "";
        await streamZhipuChat(chatMessages, (chunk) => {
          assistantContent += chunk;
          sendSSE(res, { chunk });
        });

        // 持久化 assistant 完整回复
        if (assistantContent.trim().length > 0) {
          await addMessage({
            sessionId,
            role: "assistant",
            content: assistantContent,
            timestamp: Date.now(),
          });
        }

        sendSSE(res, { done: true });
        res.end();
        return;
      }

      sendJSON(res, 404, { error: "Not Found" });
    } catch (err) {
      console.error("请求处理失败：", (err as Error).message);
      sendJSON(res, 500, { error: (err as Error).message });
    }
  });
});

server.listen(PORT, async () => {
  console.log(`服务已启动：http://localhost:${PORT}`);
  await initializeDefaultUser();
});
