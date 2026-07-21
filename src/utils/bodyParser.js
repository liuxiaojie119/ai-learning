/**
 * 解析 JSON 请求体
 */
export function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk.toString();
        });
        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            }
            catch (err) {
                reject(err);
            }
        });
        req.on("error", reject);
    });
}
