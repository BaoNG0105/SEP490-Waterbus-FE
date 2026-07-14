import api from './axios';

// API: Danh sách admin (có thể filter ?status=Active)
export const getPromotions = (params = {}) =>
    api.get('/promotions', { params }).then(response => response.data);

// API: Danh sách public cho khách (Active + Public)
export const getPublicPromotions = () =>
    api.get('/promotions/public').then(response => response.data);

// API: Tạo khuyến mãi mới
export const createPromotion = (payload) =>
    api.post('/promotions', payload).then(response => response.data);

// API: Cập nhật khuyến mãi
export const updatePromotion = (id, payload) =>
    api.put(`/promotions/${id}`, payload).then(response => response.data);

// API: Upload / cập nhật ảnh (multipart, field "image")
export const uploadPromotionImage = (id, imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return api.put(`/promotions/${id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then(response => response.data);
};

// API: Soft delete → BE set status = Archived
export const deletePromotion = (id) =>
    api.delete(`/promotions/${id}`).then(response => response.data);

// API: Preview validate mã (final check vẫn ở booking/payment)
export const validatePromotion = (code, subtotalAmount) =>
    api.get('/promotions/validate', { params: { code, subtotalAmount } }).then(response => response.data);
