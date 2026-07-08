import http from "http";
import { parseBody } from "../utils/bodyParser.js";
import { sendJSON } from "../utils/response.js";
import { requireAuth } from "../middleware/auth.js";
import { requireSessionOwnership } from "../middleware/sessionOwnership.js";
import * as sessionService from "../services/sessionService.js";

export async function handleListSessions(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const user = requireAuth(req, res);
  if (!user) return;
  const sessions = await sessionService.listSessions(user.userId);
  sendJSON(res, 200, { sessions });
}

export async function handleCreateSession(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const user = requireAuth(req, res);
  if (!user) return;
  const body = await parseBody(req);
  const title = typeof body.title === "string" ? body.title : undefined;
  const session = await sessionService.createNewSession(title, user.userId);
  sendJSON(res, 201, session);
}

export async function handleDeleteSession(
  sessionId: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const user = requireAuth(req, res);
  if (!user) return;
  const owned = await requireSessionOwnership(sessionId, user.userId, res);
  if (!owned) return;
  await sessionService.removeSession(sessionId);
  sendJSON(res, 204);
}

export async function handleListMessages(
  sessionId: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const user = requireAuth(req, res);
  if (!user) return;
  const owned = await requireSessionOwnership(sessionId, user.userId, res);
  if (!owned) return;
  const messages = await sessionService.listMessages(sessionId);
  sendJSON(res, 200, { messages });
}

export async function handleCreateMessage(
  sessionId: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const user = requireAuth(req, res);
  if (!user) return;
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

  const message = await sessionService.saveMessage(sessionId, {
    role,
    type: type === "event-list" ? "event-list" : "text",
    content,
    payload: body.payload as Record<string, unknown> | null | undefined,
    timestamp: typeof body.timestamp === "number" ? body.timestamp : undefined,
  });

  sendJSON(res, 201, message);
}
