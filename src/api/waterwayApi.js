import api from './axios';

// Lấy danh sách các tuyến sông (có hỗ trợ filter theo name, type)
// params có thể truyền vào: { name: 'song sai gon', type: 'river' }
export const getWaterways = (params) =>
    api.get('/waterways', { params }).then(r => r.data);

// Lấy chi tiết tuyến sông (kèm tọa độ vẽ bản đồ)
export const getWaterwayById = (id) =>
    api.get(`/waterways/${id}`).then(r => r.data);