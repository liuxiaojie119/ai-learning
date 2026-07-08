import { hashPassword, verifyPassword, signToken, type AuthUser } from "../auth.js";
import { getUserByUsername, createUser } from "../db.js";

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export async function register(username: string, password: string): Promise<AuthResult> {
  const existing = await getUserByUsername(username);
  if (existing) {
    const error = new Error("用户名已存在");
    (error as Error & { statusCode?: number }).statusCode = 409;
    throw error;
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ username, passwordHash });
  const token = signToken({ id: user.id, username: user.username });

  return { token, user: { id: user.id, username: user.username } };
}

export async function login(username: string, password: string): Promise<AuthResult> {
  const user = await getUserByUsername(username);
  if (!user) {
    const error = new Error("用户名或密码错误");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const error = new Error("用户名或密码错误");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }

  const token = signToken({ id: user.id, username: user.username });
  return { token, user: { id: user.id, username: user.username } };
}
