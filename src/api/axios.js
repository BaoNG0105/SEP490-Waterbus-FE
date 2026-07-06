import axios from "axios";
import Swal from 'sweetalert2';

// 1. Khởi tạo instance của Axios với baseURL
const api = axios.create({
    baseURL: import.meta.env.DEV ? "/api" : import.meta.env.VITE_API_BASE_URL,
});

// Danh sách các endpoint KHÔNG cần token (Public Routes)
const publicRoutes = [
    '/auth/login',
    '/auth/register',
    '/auth/verify-register-otp',
    '/auth/resend-otp',
    '/auth/google/login'
];

// 2. REQUEST INTERCEPTOR
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");

        // Kiểm tra xem URL hiện tại có thuộc danh sách Public không
        const isPublicRoute = publicRoutes.some(route => config.url.toLowerCase().includes(route));

        // CHỈ GẮN TOKEN KHI CÓ TOKEN VÀ KHÔNG PHẢI LÀ PUBLIC ROUTE
        if (token && !isPublicRoute) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 3. RESPONSE INTERCEPTOR: Bắt các lỗi từ Backend trả về
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // Tránh bắt lỗi 401 của các API như login (sai mật khẩu)
        const isPublicRoute = publicRoutes.some(route => originalRequest.url.toLowerCase().includes(route));

        // CHỈ VĂNG LOGOUT NẾU LỖI 401 XẢY RA Ở CÁC PRIVATE ROUTE (như '/auth/me')
        if (error.response && error.response.status === 401 && !isPublicRoute) {

            // Tránh vòng lặp vô hạn
            if (!originalRequest._retry) {
                originalRequest._retry = true;
                console.error("Token hết hạn hoặc không hợp lệ. Đang đăng xuất...");
                localStorage.removeItem("accessToken");

                // Hiển thị thông báo
                Swal.fire({
                    title: 'Phiên đăng nhập hết hạn',
                    text: 'Vui lòng đăng nhập lại để tiếp tục.',
                    icon: 'warning',
                    confirmButtonText: 'Đồng ý',
                    confirmButtonColor: '#124757',
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
