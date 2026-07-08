import http from "http";
import { parseBody } from "../utils/bodyParser.js";
import { sendJSON } from "../utils/response.js";
import { requireAuth } from "../middleware/auth.js";
import { requireSessionOwnership } from "../middleware/sessionOwnership.js";
import * as chatService from "../services/chatService.js";

export async function handleChat(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

  await chatService.handleChat(sessionId, res);
}
