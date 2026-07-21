import { parseBody } from "../utils/bodyParser.js";
import { sendJSON } from "../utils/response.js";
import { requireAuth } from "../middleware/auth.js";
import * as authService from "../services/authService.js";
function validateCredentials(body) {
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
        const error = new Error("用户名和密码不能为空");
        error.statusCode = 400;
        throw error;
    }
    if (username.length > 64 || password.length > 128) {
        const error = new Error("用户名或密码长度超出限制");
        error.statusCode = 400;
        throw error;
    }
    return { username, password };
}
export async function handleRegister(req, res) {
    const body = await parseBody(req);
    const { username, password } = validateCredentials(body);
    const result = await authService.register(username, password);
    sendJSON(res, 201, result);
}
export async function handleLogin(req, res) {
    const body = await parseBody(req);
    const { username, password } = validateCredentials(body);
    const result = await authService.login(username, password);
    sendJSON(res, 200, result);
}
export function handleMe(req, res) {
    const user = requireAuth(req, res);
    if (!user)
        return;
    sendJSON(res, 200, { user: { id: user.userId, username: user.username } });
}
export function handleLogout(req, res) {
    const user = requireAuth(req, res);
    if (!user)
        return;
    sendJSON(res, 200, { message: "登出成功" });
}
