import http from "http";
import url from "url";
import { corsMiddleware } from "./middleware/cors.js";
import { handleAuthRoutes } from "./routes/auth.js";
import { handleSessionRoutes } from "./routes/sessions.js";
import { handleChatRoutes } from "./routes/chat.js";
import { sendJSON } from "./utils/response.js";
import { handleRequestError } from "./middleware/errorHandler.js";
import { getUserByUsername, createUser } from "./db.js";
import { hashPassword } from "./auth.js";
const PORT = Number(process.env.PORT) || 3000;
/**
 * 服务启动时创建默认账号 admin / 1
 */
async function initializeDefaultUser() {
    try {
        const existing = await getUserByUsername("admin");
        if (existing)
            return;
        const passwordHash = await hashPassword("1");
        await createUser({ username: "admin", passwordHash });
        console.log("默认账号已创建：admin / 1");
    }
    catch (err) {
        console.error("创建默认账号失败：", err.message);
    }
}
const server = http.createServer((req, res) => {
    corsMiddleware(req, res, async () => {
        try {
            const parsedUrl = url.parse(req.url || "", true);
            const pathname = parsedUrl.pathname || "";
            const method = req.method || "";
            const handled = (await handleAuthRoutes(pathname, method, req, res)) ||
                (await handleSessionRoutes(pathname, method, req, res)) ||
                (await handleChatRoutes(pathname, method, req, res));
            if (!handled) {
                sendJSON(res, 404, { error: "Not Found" });
            }
        }
        catch (err) {
            handleRequestError(res, err);
        }
    });
});
server.listen(PORT, async () => {
    console.log(`服务已启动：http://localhost:${PORT}`);
    await initializeDefaultUser();
});
