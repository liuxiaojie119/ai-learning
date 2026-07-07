import http from "http";
import cors from "cors";
import { streamZhipuChat, fetchEventsWithTool, type ChatMessage } from "./index.js";

const PORT = Number(process.env.PORT) || 3000;

const corsMiddleware = cors({
  origin: "*",
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

/**
 * 发送 SSE 数据行
 * @param res HTTP 响应对象
 * @param data 要发送的数据对象
 */
function sendSSE(res: http.ServerResponse, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const server = http.createServer((req, res) => {
  corsMiddleware(req, res, async () => {
    if (req.url === "/api/chat" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const { messages } = JSON.parse(body) as { messages?: { role: string; content: string }[] };
          if (!Array.isArray(messages) || messages.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "messages 字段必须是非空数组" }));
            return;
          }

          // 统一使用 SSE 格式返回，成功和错误都通过 data: 推送
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          });

          // 经营事件类查询：使用 GLM Function Calling 返回结构化数据
          const lastUserMessage = messages.filter((m) => m.role === "user").pop();
          if (lastUserMessage && /经营事件|签约|收入|回款|验收|预警/.test(lastUserMessage.content)) {
            try {
              const payload = await fetchEventsWithTool(lastUserMessage.content);
              sendSSE(res, { type: "event-list", payload });
            } catch (err) {
              sendSSE(res, { error: (err as Error).message });
            }
            sendSSE(res, { done: true });
            res.end();
            return;
          }

          const chatMessages: ChatMessage[] = messages
            .filter((m): m is { role: "system" | "user" | "assistant"; content: string } =>
              ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string"
            )
            .map((m) => ({ role: m.role, content: m.content }));

          await streamZhipuChat(chatMessages, (chunk) => {
            sendSSE(res, { chunk });
          });

          sendSSE(res, { done: true });
          res.end();
        } catch (err) {
          // 注意：此时可能已发送 200 SSE 头，所以错误也用 SSE 格式推送
          sendSSE(res, { error: (err as Error).message });
          res.end();
        }
      });
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Not Found" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`SSE 服务已启动：http://localhost:${PORT}/api/chat`);
});
