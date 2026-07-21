import * as sessionController from "../controllers/sessionController.js";
export async function handleSessionRoutes(pathname, method, req, res) {
    // GET /api/sessions
    if (pathname === "/api/sessions" && method === "GET") {
        await sessionController.handleListSessions(req, res);
        return true;
    }
    // POST /api/sessions
    if (pathname === "/api/sessions" && method === "POST") {
        await sessionController.handleCreateSession(req, res);
        return true;
    }
    // /api/sessions/:id/messages
    const messagesMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
    if (messagesMatch && messagesMatch[1]) {
        const sessionId = messagesMatch[1];
        if (method === "GET") {
            await sessionController.handleListMessages(sessionId, req, res);
            return true;
        }
        if (method === "POST") {
            await sessionController.handleCreateMessage(sessionId, req, res);
            return true;
        }
    }
    // DELETE /api/sessions/:id
    const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch && sessionMatch[1] && method === "DELETE") {
        await sessionController.handleDeleteSession(sessionMatch[1], req, res);
        return true;
    }
    return false;
}
