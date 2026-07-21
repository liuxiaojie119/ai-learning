import { sendJSON } from "../utils/response.js";
/**
 * 统一错误处理：捕获异常并返回 500
 */
export function handleRequestError(res, err) {
    console.error("请求处理失败：", err.message);
    sendJSON(res, 500, { error: err.message });
}
