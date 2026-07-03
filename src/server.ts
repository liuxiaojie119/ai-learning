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
          const { message } = JSON.parse(body) as { message?: string };
          if (!message || typeof message !== "string") {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "message 字段不能为空" }));
            return;
          }

          // 统一使用 SSE 格式返回，成功和错误都通过 data: 推送
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          });

          // 经营事件类查询：使用 GLM Function Calling 返回结构化数据
          if (/经营事件|签约|收入|回款|验收|预警/.test(message)) {
            try {
              const payload = await fetchEventsWithTool(message);
              sendSSE(res, { type: "event-list", payload });
            } catch (err) {
              sendSSE(res, { error: (err as Error).message });
            }
            sendSSE(res, { done: true });
            res.end();
            return;
          }

          const messages: ChatMessage[] = [
            { role: "system", content: "你是专业前端TS工程师，回答简洁规范" },
            { role: "user", content: message }
          ];

          await streamZhipuChat(messages, (chunk) => {
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
