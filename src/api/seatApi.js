import api from './axios';

// 1. GET: Lấy sơ đồ ghế của tàu (đã setup hoặc đang có)
export const getSeatLayout = (vesselId) => 
    api.get(`/vessels/${vesselId}/seats`).then(r => r.data);

// 2. POST: Khởi tạo/Sinh ma trận ghế thô (Truyền lên số tầng, số cột, số hàng)
export const generateSeatMatrix = (vesselId, matrixPayload) => 
    api.post(`/vessels/${vesselId}/seats/generate`, matrixPayload).then(r => r.data);

// 3. POST: Cấu hình/Setup sơ đồ ghế chính thức từ lưới ma trận
export const configureSeatLayout = (vesselId, layoutPayload) => 
    api.post(`/vessels/${vesselId}/seats/configure`, layoutPayload).then(r => r.data);

// 4. PATCH: Cập nhật trạng thái của một ghế lẻ (Ví dụ: báo hỏng/bảo trì - nếu bạn vẫn giữ API này)
export const updateSeatStatus = (vesselId, seatId, statusPayload) => 
    api.patch(`/vessels/${vesselId}/seats/${seatId}/status`, statusPayload).then(r => r.data);

// 5. DELETE: Xóa toàn bộ ma trận ghế của tàu
export const deleteSeatLayout = (vesselId) => 
    api.delete(`/vessels/${vesselId}/seats`).then(r => r.data);