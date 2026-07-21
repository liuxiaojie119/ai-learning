import * as chatController from "../controllers/chatController.js";
export async function handleChatRoutes(pathname, method, req, res) {
    if (pathname === "/api/chat" && method === "POST") {
        await chatController.handleChat(req, res);
        return true;
    }
    return false;
}
