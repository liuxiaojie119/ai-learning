import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../composables/useAuthStore';
import LoginView from '../views/LoginView.vue';
import ChatView from '../views/ChatView.vue';
const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/login',
            name: 'Login',
            component: LoginView,
            meta: { public: true },
        },
        {
            path: '/',
            name: 'Chat',
            component: ChatView,
            meta: { public: false },
        },
    ],
});
router.beforeEach(async (to) => {
    const authStore = useAuthStore();
    // 首次进入应用时尝试恢复登录状态
    if (authStore.token.value && !authStore.user.value) {
        await authStore.restoreSession();
    }
    const isPublic = to.meta.public === true;
    const isAuthenticated = authStore.isAuthenticated.value;
    if (!isPublic && !isAuthenticated) {
        return '/login';
    }
    if (isPublic && isAuthenticated) {
        return '/';
    }
    return true;
});
export default router;
