import http from "http";

/**
 * 发送 SSE 数据行
 */
export function sendSSE(res: http.ServerResponse, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * 发送 JSON 响应
 */
export function sendJSON(res: http.ServerResponse, statusCode: number, data?: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(data !== undefined ? JSON.stringify(data) : undefined);
}
