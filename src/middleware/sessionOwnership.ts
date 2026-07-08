import http from "http";
import { sendJSON } from "../utils/response.js";

/**
 * 校验会话是否属于当前用户
 */
export async function requireSessionOwnership(
  sessionId: string,
  userId: string,
  res: http.ServerResponse
): Promise<boolean> {
  const { getSessionById } = await import("../db.js");
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
