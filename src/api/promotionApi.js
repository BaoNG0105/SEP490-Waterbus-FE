import api from './axios';

// API: Lấy danh sách khuyến mãi (status: Active | Inactive, bỏ trống để lấy tất cả)
export const getPromotions = (params = {}) =>
    api.get('/promotions', { params }).then(response => response.data);

// API: Tạo khuyến mãi mới
export const createPromotion = (payload) =>
    api.post('/promotions', payload).then(response => response.data);

// API: Cập nhật khuyến mãi
export const updatePromotion = (id, payload) =>
    api.put(`/promotions/${id}`, payload).then(response => response.data);

// API: Vô hiệu hóa khuyến mãi (soft delete, đặt Status = Inactive)
export const deletePromotion = (id) =>
    api.delete(`/promotions/${id}`).then(response => response.data);

// API: Kiểm tra mã khuyến mãi hợp lệ theo giá trị đơn hàng
export const validatePromotion = (code, subtotalAmount) =>
    api.get('/promotions/validate', { params: { code, subtotalAmount } }).then(response => response.data);
