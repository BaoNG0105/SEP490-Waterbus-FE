import api from './axios';

// Danh sách gói bảo hiểm (lọc theo bookingType / activeOnly)
export const getInsurancePackages = (params) =>
    api.get('/insurance-packages', { params }).then((response) => response.data);

// Tạo gói bảo hiểm
export const createInsurancePackage = (data) =>
    api.post('/insurance-packages', data).then((response) => response.data);

// Cập nhật gói bảo hiểm
export const updateInsurancePackage = (id, data) =>
    api.put(`/insurance-packages/${id}`, data).then((response) => response.data);

export const uploadInsurancePackageImage = (id, imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return api.put(`/insurance-packages/${id}/image`, formData).then((response) => response.data);
};

// Bật/tắt gói bảo hiểm
export const updateInsurancePackageStatus = (id, data) =>
    api.patch(`/insurance-packages/${id}/status`, data).then((response) => response.data);

// Kiểm tra đã có gói Waterbus default active chưa (chỉ 1 gói Waterbus mặc định/bookingType)
export const checkWaterbusDefault = (bookingType) =>
    api.get('/insurance-packages/check-waterbus-default', { params: { bookingType } }).then((response) => response.data);

// Xóa gói bảo hiểm (chỉ dùng nội bộ nếu BE còn hỗ trợ; UI admin không dùng)
export const deleteInsurancePackage = (id) =>
    api.delete(`/insurance-packages/${id}`).then((response) => response.data);
