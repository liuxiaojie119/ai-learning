import { ref, computed } from 'vue';
const token = ref(localStorage.getItem('ai-learning-token'));
const user = ref(null);
const isLoading = ref(false);
const error = ref(null);
const isAuthenticated = computed(() => !!token.value && !!user.value);
function setAuth(newToken, newUser) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('ai-learning-token', newToken);
}
function clearAuth() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('ai-learning-token');
}
async function api(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
    };
    if (token.value) {
        headers.Authorization = `Bearer ${token.value}`;
    }
    const res = await fetch(url, {
        ...options,
        headers,
    });
    if (res.status === 401) {
        clearAuth();
        throw new Error('您暂无操作权限，请联系管理员开通');
    }
    if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `请求失败：${res.status}`);
    }
    if (res.status === 204) {
        return undefined;
    }
    return res.json();
}
async function stream(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
    };
    if (token.value) {
        headers.Authorization = `Bearer ${token.value}`;
    }
    const res = await fetch(url, {
        ...options,
        headers,
    });
    if (res.status === 401) {
        clearAuth();
        throw new Error('您暂无操作权限，请联系管理员开通');
    }
    return res;
}
async function login(username, password) {
    isLoading.value = true;
    error.value = null;
    try {
        const data = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        setAuth(data.token, data.user);
    }
    catch (err) {
        error.value = err.message;
        throw err;
    }
    finally {
        isLoading.value = false;
    }
}
async function register(username, password) {
    isLoading.value = true;
    error.value = null;
    try {
        const data = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        setAuth(data.token, data.user);
    }
    catch (err) {
        error.value = err.message;
        throw err;
    }
    finally {
        isLoading.value = false;
    }
}
async function logout() {
    try {
        await api('/api/auth/logout', { method: 'POST' });
    }
    catch {
        // 即使后端请求失败也清除本地状态
    }
    finally {
        clearAuth();
    }
}
async function restoreSession() {
    const savedToken = token.value;
    if (!savedToken)
        return;
    isLoading.value = true;
    try {
        const data = await api('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
        });
        user.value = data.user;
    }
    catch {
        clearAuth();
    }
    finally {
        isLoading.value = false;
    }
}
export function useAuthStore() {
    return {
        token,
        user,
        isLoading,
        error,
        isAuthenticated,
        login,
        register,
        logout,
        restoreSession,
        fetchWithAuth: api,
        fetchStream: stream,
    };
}
