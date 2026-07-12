import api from './axios';

// Lấy danh sách các tuyến sông (có hỗ trợ filter theo name, type)
// params có thể truyền vào: { name: 'song sai gon', type: 'river' }
export const getWaterways = (params) =>
    api.get('/waterways', { params }).then(r => r.data);

// Lấy chi tiết tuyến sông (kèm tọa độ vẽ bản đồ)
export const getWaterwayById = (id) =>
    api.get(`/waterways/${id}`).then(r => r.data);

// Xóa một tuyến sông/kênh (xóa TẤT CẢ segment cùng OsmId + tên + loại)
// Trả về { osmId, waterwayName, waterwayType, deletedSegments }. Route đã tạo không bị ảnh hưởng.
export const deleteWaterway = (id) =>
    api.delete(`/waterways/${id}`).then(r => r.data);

// Xóa TOÀN BỘ mạng đường sông (xóa sạch bảng waterway_segments)
// Dùng trước khi re-import GeoJSON để tránh dữ liệu cũ trộn với map mới.
// Bắt buộc confirm=true để tránh xóa nhầm. Trả về { deletedSegments }. Route đã tạo không bị ảnh hưởng.
export const deleteAllWaterways = () =>
    api.delete('/waterways', { params: { confirm: true } }).then(r => r.data);