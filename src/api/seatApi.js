import api from './axios';

// 1. GET: Lấy sơ đồ ghế của tàu
export const getSeatLayout = (boatId) => 
    api.get(`/boats/${boatId}/seats`).then(r => r.data);

// 2. POST: Khởi tạo/Sinh ma trận ghế thô
export const generateSeatMatrix = (boatId, matrixPayload) => 
    api.post(`/boats/${boatId}/seats/generate`, matrixPayload).then(r => r.data);

// 3. POST: Cấu hình/Setup sơ đồ ghế chính thức từ lưới ma trận
export const configureSeatLayout = (boatId, layoutPayload) => 
    api.post(`/boats/${boatId}/seats/configure`, layoutPayload).then(r => r.data);

// 4. PATCH: Cập nhật trạng thái của một ghế lẻ
export const updateSeatStatus = (boatId, seatId, statusPayload) => 
    api.patch(`/boats/${boatId}/seats/${seatId}/status`, statusPayload).then(r => r.data);

// 5. DELETE: Xóa toàn bộ ma trận ghế của tàu
export const deleteSeatLayout = (boatId) => 
    api.delete(`/boats/${boatId}/seats`).then(r => r.data);