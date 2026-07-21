import http from "http";
import * as chatController from "../controllers/chatController.js";

export async function handleChatRoutes(
  pathname: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<boolean> {
  if (pathname === "/api/chat" && method === "POST") {
    await chatController.handleChat(req, res);
    return true;
  }

  return false;
}