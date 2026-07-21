import * as authController from "../controllers/authController.js";
export async function handleAuthRoutes(pathname, method, req, res) {
    if (pathname === "/api/auth/register" && method === "POST") {
        await authController.handleRegister(req, res);
        return true;
    }
    if (pathname === "/api/auth/login" && method === "POST") {
        await authController.handleLogin(req, res);
        return true;
    }
    if (pathname === "/api/auth/me" && method === "GET") {
        authController.handleMe(req, res);
        return true;
    }
    if (pathname === "/api/auth/logout" && method === "POST") {
        authController.handleLogout(req, res);
        return true;
    }
    return false;
}
