import { getSessions, createSession, deleteSession, getMessages, addMessage, updateSessionTitle, } from "../db.js";
export async function listSessions(userId) {
    const sessions = await getSessions(userId);
    return sessions.map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
    }));
}
export async function createNewSession(title, userId) {
    const session = await createSession({ title, userId });
    return {
        id: session.id,
        title: session.title,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
    };
}
export async function removeSession(sessionId) {
    await deleteSession(sessionId);
}
export async function listMessages(sessionId) {
    const messages = await getMessages(sessionId);
    return messages.map((m) => ({
        id: m.id,
        role: m.role,
        type: m.type,
        content: m.content,
        payload: m.payload,
        timestamp: m.timestamp,
    }));
}
export async function saveMessage(sessionId, input) {
    const message = await addMessage({ sessionId, ...input });
    if (input.role === "user") {
        await updateSessionTitle(sessionId, input.content.slice(0, 20) || "新对话");
    }
    return {
        id: message.id,
        role: message.role,
        type: message.type,
        content: message.content,
        payload: message.payload,
        timestamp: message.timestamp,
    };
}
