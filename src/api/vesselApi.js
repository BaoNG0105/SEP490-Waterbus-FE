import api from './axios'; // Import instance Axios đã cấu hình sẵn của bạn

// Gọi API lấy danh sách toàn bộ tàu
// Lưu ý: Nếu file axios.js của bạn đã cấu hình baseURL có sẵn '/api' (ví dụ: http://localhost:8080/api) 
// thì bạn chỉ cần truyền '/vessels'. Ở đây tôi để nguyên '/api/vessels' theo yêu cầu của bạn.

//Danh sách tàu
export const getVessels = () =>
    api.get('/vessels').then(response => response.data);

// Tạo tàu mới
export const createVessel = (data) => 
    api.post('/vessels', data).then(r => r.data);


// Gợi ý chuẩn bị sẵn các hàm CRUD khác cho các bước sau:
// export const getVesselById = (id) => api.get(`/vessels/${vesselId}`).then(r => r.data);
// export const updateVessel = (id, data) => api.put(`/vessels/${vesselId}`, data).then(r => r.data);
// export const deleteVessel = (id) => api.delete(`/vessels/${vesselId}`).then(r => r.data);