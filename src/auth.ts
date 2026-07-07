import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { IncomingMessage } from "http";

export interface AuthUser {
  id: string;
  username: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
}

const SALT_ROUNDS = 10;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("缺少必需的环境变量：JWT_SECRET");
  }
  return secret;
}

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = { userId: user.id, username: user.username };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

/**
 * 从请求头中提取 Bearer Token
 */
export function extractToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] || null;
}

/**
 * 从请求头中解析当前登录用户
 */
export function getCurrentUser(req: IncomingMessage): JwtPayload | null {
  const token = extractToken(req);
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
