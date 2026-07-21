import "dotenv/config"; // 自动加载项目根目录的 .env 环境变量
import OpenAI from "openai"; // 智谱 GLM 提供 OpenAI 兼容接口，复用官方 SDK
/**
 * 读取必需的环境变量，若缺失则抛出明确错误
 * @param key 环境变量名
 * @returns 环境变量值
 */
function getRequiredEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`缺少必需的环境变量：${key}`);
    }
    return value;
}
// 初始化智谱客户端：apiKey 和 baseURL 均从 .env 读取
const zhipuClient = new OpenAI({
    apiKey: getRequiredEnv("ZHIPU_API_KEY"), // 智谱开放平台申请的 API Key
    baseURL: getRequiredEnv("ZHIPU_BASE_URL"), // OpenAI 兼容 endpoint，如 https://open.bigmodel.cn/api/paas/v4
});
/**
 * 流式调用智谱 GLM 大模型
 * @param messages 对话历史消息数组
 * @param onChunk 每次收到流式片段时的回调函数
 */
export async function streamZhipuChat(messages, onChunk) {
    const model = getRequiredEnv("ZHIPU_MODEL"); // 模型名，如 glm-4.7-flash
    console.log("流式调用智谱GLM-4.7-Flash...");
    // stream: true 表示启用 SSE 流式返回
    const stream = await zhipuClient.chat.completions.create({
        model,
        messages,
        temperature: 0.6,
        stream: true,
    });
    // 遍历异步迭代器，逐块读取模型返回的内容
    for await (const part of stream) {
        // delta.content 是本次流式片段新增的文本，可能为空字符串
        const delta = part.choices[0]?.delta?.content;
        if (delta) {
            onChunk(delta); // 将片段交给调用方处理（如推送给前端）
        }
    }
}
/**
 * 使用 Function Calling 让模型返回结构化经营事件数据
 * @param userMsg 用户输入
 * @returns 结构化事件列表
 */
export async function fetchEventsWithTool(userMsg) {
    const model = getRequiredEnv("ZHIPU_MODEL");
    const tools = [
        {
            type: "function",
            function: {
                name: "render_event_list",
                description: "当用户查询企业经营事件、签约、收入、回款、验收、预警等数据时，调用此函数返回结构化事件列表",
                parameters: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "模块标题，例如'2.2 上周关键经营事件'",
                        },
                        subtitle: {
                            type: "string",
                            description: "副标题，例如'事件流 · 签约 / 收入 / 回款 / 验收 / 预警'",
                        },
                        tabs: {
                            type: "array",
                            items: { type: "string" },
                            description: "筛选标签，例如['全部','签约','收入','回款','验收','预警']",
                        },
                        total: {
                            type: "number",
                            description: "事件总数",
                        },
                        data: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    date: { type: "string", description: "事件日期，格式 YYYY-MM-DD" },
                                    type: {
                                        type: "string",
                                        enum: ["签约", "收入", "回款", "验收", "预警"],
                                        description: "事件类型",
                                    },
                                    company: { type: "string", description: "客户公司名称" },
                                    project: { type: "string", description: "项目名称" },
                                    sales: { type: "string", description: "销售员姓名" },
                                    actualDate: { type: "string", description: "实际签约/发生时间" },
                                    expectedDate: {
                                        type: ["string", "null"],
                                        description: "预计签约时间，没有则填 null",
                                    },
                                    lastWeekAmount: {
                                        type: "number",
                                        description: "上周签约金额，单位万元",
                                    },
                                    opportunityAmount: {
                                        type: "number",
                                        description: "商机金额，单位万元",
                                    },
                                },
                                required: [
                                    "date",
                                    "type",
                                    "company",
                                    "project",
                                    "sales",
                                    "actualDate",
                                    "lastWeekAmount",
                                    "opportunityAmount",
                                ],
                            },
                        },
                        pagination: {
                            type: "object",
                            properties: {
                                page: { type: "number" },
                                pageSize: { type: "number" },
                                total: { type: "number" },
                            },
                        },
                    },
                    required: ["title", "subtitle", "tabs", "total", "data", "pagination"],
                },
            },
        },
    ];
    const response = await zhipuClient.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content: "你是企业经营数据助手。当用户查询经营事件、签约、收入、回款、验收、预警等数据时，必须调用 render_event_list 函数返回结构化数据。如果用户没有提供具体数据，请基于合理假设生成示例数据，确保金额、日期、公司名称看起来真实。",
            },
            { role: "user", content: userMsg },
        ],
        tools,
        tool_choice: "auto",
        temperature: 0.3,
    });
    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.type === "function" && "function" in toolCall) {
        const fn = toolCall.function;
        if (fn.name === "render_event_list") {
            return JSON.parse(fn.arguments);
        }
    }
    throw new Error("模型未返回事件列表数据");
}
// 保留原有非流式调用，向后兼容
export async function zhipuChat(userMsg) {
    try {
        const model = getRequiredEnv("ZHIPU_MODEL");
        console.log("调用智谱GLM-4.7-Flash...");
        // 一次性返回完整结果，无流式效果
        const res = await zhipuClient.chat.completions.create({
            model,
            messages: [
                { role: "system", content: "你是专业前端TS工程师，回答简洁规范" },
                { role: "user", content: userMsg }
            ],
            temperature: 0.6,
        });
        const choice = res.choices[0];
        if (!choice) {
            console.error("模型未返回有效选项");
            return undefined;
        }
        const reply = choice.message.content;
        console.log("AI回复：", reply);
        // 输出 token 消耗统计
        if (res.usage) {
            console.log(`Token消耗：${res.usage.total_tokens}`);
        }
        return reply ?? undefined;
    }
    catch (err) {
        console.error("调用失败：", err.message);
        return undefined;
    }
}
// 仅直接运行此文件时执行测试（被其他文件导入时不会触发）
if (import.meta.url === `file://${process.argv[1]}`) {
    zhipuChat("写一段ts-node读取.env调用大模型的通用工具");
}
