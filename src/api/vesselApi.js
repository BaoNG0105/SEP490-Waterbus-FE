import api from './axios'; // Import instance Axios đã cấu hình sẵn của bạn

// API Danh sách tàu
export const getVessels = () =>
    api.get('/vessels').then(response => response.data);

// API Chi tiết tàu theo ID
export const getVesselById = (id) => 
    api.get(`/vessels/${id}`).then(r => r.data);

// API Tạo tàu mới
export const createVessel = (data) => 
    api.post('/vessels', data).then(r => r.data);

// API Cập nhật tàu
export const updateVessel = (id, data) => 
    api.put(`/vessels/${id}`, data).then(r => r.data);


// export const deleteVessel = (id) => api.delete(`/vessels/${vesselId}`).then(r => r.data);