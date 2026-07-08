import {
  getSessions,
  createSession,
  deleteSession,
  getMessages,
  addMessage,
  updateSessionTitle,
  type CreateMessageInput,
} from "../db.js";

export interface SessionListItem {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export async function listSessions(userId: string): Promise<SessionListItem[]> {
  const sessions = await getSessions(userId);
  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));
}

export async function createNewSession(title: string | undefined, userId: string): Promise<SessionListItem> {
  const session = await createSession({ title, userId });
  return {
    id: session.id,
    title: session.title,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

export async function removeSession(sessionId: string): Promise<void> {
  await deleteSession(sessionId);
}

export async function listMessages(sessionId: string) {
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

export async function saveMessage(
  sessionId: string,
  input: Omit<CreateMessageInput, "sessionId">
) {
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
