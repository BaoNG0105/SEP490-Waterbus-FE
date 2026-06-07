import axios from "axios";
import Swal from 'sweetalert2';

// 1. Khởi tạo instance của Axios với baseURL
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
});

// 2. REQUEST INTERCEPTOR
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");

        // THÊM ĐIỀU KIỆN NÀY: Chỉ gắn token nếu URL KHÔNG chứa chữ '/auth/'
        if (token && !config.url.toLowerCase().includes('/auth/')) {
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

        // THÊM ĐIỀU KIỆN: Chỉ xử lý văng logout nếu lỗi 401 VÀ KHÔNG PHẢI ĐANG GỌI API '/auth/'
        if (error.response && error.response.status === 401 && !originalRequest.url.toLowerCase().includes('/auth/')) {

            // Tránh vòng lặp vô hạn
            if (!originalRequest._retry) {
                originalRequest._retry = true;
                console.error("Token hết hạn hoặc không hợp lệ. Đang đăng xuất...");
                localStorage.removeItem("accessToken");

                // Hiển thị thông báo (Giữ nguyên code Swal của bạn)
                Swal.fire({
                    title: 'Phiên đăng nhập hết hạn',
                    text: 'Vui lòng đăng nhập lại để tiếp tục.',
                    icon: 'warning',
                    confirmButtonText: 'Đồng ý'
                }).then(() => {
                    window.location.href = '/login';
                });
            }
        }
        return Promise.reject(error);
    }
);

export default api;