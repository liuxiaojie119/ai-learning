import { streamZhipuChat, fetchEventsWithTool } from "../index.js";
import { getRecentMessages, addMessage } from "../db.js";
import { sendSSE } from "../utils/response.js";
export async function handleChat(sessionId, res) {
    const history = await getRecentMessages(sessionId, 20);
    const lastUserMessage = history.filter((m) => m.role === "user").pop();
    if (!lastUserMessage) {
        sendSSE(res, { error: "会话中至少需要一条 user 消息" });
        res.end();
        return;
    }
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });
    // 经营事件类查询：使用 GLM Function Calling 返回结构化数据
    if (/经营事件|签约|收入|回款|验收|预警/.test(lastUserMessage.content)) {
        try {
            const payload = await fetchEventsWithTool(lastUserMessage.content);
            sendSSE(res, { type: "event-list", payload });
            await addMessage({
                sessionId,
                role: "assistant",
                type: "event-list",
                content: payload.title || "经营事件列表",
                payload: payload,
                timestamp: Date.now(),
            });
        }
        catch (err) {
            sendSSE(res, { error: err.message });
        }
        sendSSE(res, { done: true });
        res.end();
        return;
    }
    const chatMessages = history.map((m) => ({ role: m.role, content: m.content }));
    let assistantContent = "";
    await streamZhipuChat(chatMessages, (chunk) => {
        assistantContent += chunk;
        sendSSE(res, { chunk });
    });
    if (assistantContent.trim().length > 0) {
        await addMessage({
            sessionId,
            role: "assistant",
            content: assistantContent,
            timestamp: Date.now(),
        });
    }
    sendSSE(res, { done: true });
    res.end();
}
