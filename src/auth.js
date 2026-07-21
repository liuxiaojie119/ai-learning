import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
const SALT_ROUNDS = 10;
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("缺少必需的环境变量：JWT_SECRET");
    }
    return secret;
}
export function hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
}
export function verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
}
export function signToken(user) {
    const payload = { userId: user.id, username: user.username };
    return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}
export function verifyToken(token) {
    return jwt.verify(token, getJwtSecret());
}
/**
 * 从请求头中提取 Bearer Token
 */
export function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return null;
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer")
        return null;
    return parts[1] || null;
}
/**
 * 从请求头中解析当前登录用户
 */
export function getCurrentUser(req) {
    const token = extractToken(req);
    if (!token)
        return null;
    try {
        return verifyToken(token);
    }
    catch {
        return null;
    }
}
