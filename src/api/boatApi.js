import api from './axios';

// API Danh sách tàu
export const getBoats = () =>
    api.get('/boats').then(response => response.data);

// API Chi tiết tàu theo ID
export const getBoatById = (id) => 
    api.get(`/boats/${id}`).then(r => r.data);

// API Tạo tàu mới
export const createBoat = (data) => 
    api.post('/boats', data).then(r => r.data);

// API Cập nhật tàu
export const updateBoat = (id, data) => 
    api.put(`/boats/${id}`, data).then(r => r.data);

// API Cập nhật trạng thái tàu
export const updateBoatStatus = (id, data) => 
    api.patch(`/boats/status/${id}`, data).then(r => r.data);

// API Xóa tàu
export const deleteBoat = (id) => api.delete(`/boats/${id}`).then(r => r.data);