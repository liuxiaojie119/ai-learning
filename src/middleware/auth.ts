import http from "http";
import { getCurrentUser, type JwtPayload } from "../auth.js";
import { sendJSON } from "../utils/response.js";

/**
 * 校验请求是否已登录，返回当前用户信息
 */
export function requireAuth(req: http.IncomingMessage, res: http.ServerResponse): JwtPayload | null {
  const user = getCurrentUser(req);
  if (!user) {
    sendJSON(res, 401, { error: "未登录或 token 无效" });
  }
  return user;
}
