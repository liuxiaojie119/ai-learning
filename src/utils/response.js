/**
 * 发送 SSE 数据行
 */
export function sendSSE(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}
/**
 * 发送 JSON 响应
 */
export function sendJSON(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(data !== undefined ? JSON.stringify(data) : undefined);
}
