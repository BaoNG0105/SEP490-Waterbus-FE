import axios from "axios";
import { notify } from "../utils/swalToast";

// Backend production đã deploy trên Azure. Vercel vẫn có thể override bằng
// VITE_API_BASE_URL; fallback giúp bản build không bị gọi nhầm API local khi
// biến môi trường của project deploy chưa được cấu hình.
const deployedApiBaseUrl = "https://sgwaterbus-c5gkf4fbfbfbbkh9.eastasia-01.azurewebsites.net/api";

// 1. Khởi tạo instance của Axios với baseURL
const api = axios.create({
    baseURL: import.meta.env.DEV ? "/api" : (import.meta.env.VITE_API_BASE_URL || deployedApiBaseUrl),
});

// Danh sách các endpoint KHÔNG cần token (Public Routes)
const publicRoutes = [
    '/auth/login',
    '/auth/register',
    '/auth/verify-register-otp',
    '/auth/resend-otp',
    '/auth/google/login',
];

const matchesRouteList = (url = "", routes = []) =>
    routes.some((route) => String(url || "").toLowerCase().includes(route));

const shouldSkipAuth = (config = {}) =>
    Boolean(config.skipAuth) || matchesRouteList(config.url, publicRoutes);

// 2. REQUEST INTERCEPTOR
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");

        // Public / skipAuth: không gắn Authorization (tránh 401 token cũ → popup session expired).
        if (shouldSkipAuth(config)) {
            if (config.headers) {
                delete config.headers.Authorization;
                delete config.headers.authorization;
            }
            return config;
        }

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

const isPaymentSyncUrl = (url = "") => {
    const value = String(url || "").toLowerCase();
    return value.includes("/payments/") && value.includes("/sync");
};

const isOnPaymentReturnPage = () => {
    if (typeof window === "undefined") return false;
    return window.location.pathname.startsWith("/payment/");
};

// 3. RESPONSE INTERCEPTOR: Bắt các lỗi từ Backend trả về
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config || {};
        const requestUrl = String(originalRequest.url || "");

        // Tránh bắt lỗi 401 của các API như login (sai mật khẩu) / anonymous schedule
        const isPublicOrSkipAuth =
            matchesRouteList(requestUrl, publicRoutes)
            || Boolean(originalRequest.skipAuth);

        // PayOS return: sync có thể 401 — KHÔNG đá về /login (mất /payment/success?orderCode=...).
        // Trang PaymentResult tự xử lý (giữ URL + nút đăng nhập quay lại sync).
        const skipForcedLogin =
            isPaymentSyncUrl(requestUrl)
            || isOnPaymentReturnPage()
            || isPublicOrSkipAuth;

        // CHỈ VĂNG LOGOUT NẾU LỖI 401 XẢY RA Ở CÁC PRIVATE ROUTE (như '/auth/me')
        if (error.response && error.response.status === 401 && !skipForcedLogin) {

            // Tránh vòng lặp vô hạn
            if (!originalRequest._retry) {
                originalRequest._retry = true;
                console.error("Token hết hạn hoặc không hợp lệ. Đang đăng xuất...");
                localStorage.removeItem("accessToken");

                // Hiển thị thông báo
                notify({
                    dialog: true,
                    title: 'Phiên đăng nhập hết hạn',
                    text: 'Vui lòng đăng nhập lại để tiếp tục.',
                    icon: 'warning',
                    confirmButtonText: 'Đồng ý',
                    allowOutsideClick: false,
                    showCancelButton: false,
                }).then(() => {
                    // Chuyển hướng cứng về trang login
                    window.location.href = '/login'; 
                });
            }
        }
        return Promise.reject(error);
    }
);

export default api;
