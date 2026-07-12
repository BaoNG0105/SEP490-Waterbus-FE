import {
    getWaterways as apiGetWaterways,
    getWaterwayById as apiGetWaterwayById,
    deleteWaterway as apiDeleteWaterway,
    deleteAllWaterways as apiDeleteAllWaterways
} from '../api/waterwayApi';

// Hàm lấy danh sách tuyến sông (kèm bộ lọc)
export const fetchWaterways = async (filters = {}) => {
    try {
        const data = await apiGetWaterways(filters);
        return data;
    } catch (error) {
        console.error('Lỗi khi lấy danh sách waterways:', error);
        throw error;
    }
};

// Hàm lấy chi tiết một tuyến sông và tọa độ để vẽ bản đồ
export const fetchWaterwayDetail = async (id) => {
    try {
        const data = await apiGetWaterwayById(id);
        return data;
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết waterway ID ${id}:`, error);
        throw error; // Quăng lỗi để Component UI hiển thị (ví dụ 404 Not Found)
    }
};

// Hàm xóa một tuyến sông (xóa toàn bộ segment cùng OsmId + tên + loại)
// Route đã tạo trước đó KHÔNG bị ảnh hưởng, chỉ ảnh hưởng route tạo mới
export const removeWaterway = async (id) => {
    try {
        const data = await apiDeleteWaterway(id);
        return data;
    } catch (error) {
        console.error(`Lỗi khi xóa waterway ID ${id}:`, error);
        throw error;
    }
};

// Hàm xóa TOÀN BỘ mạng đường sông (xóa sạch bảng waterway_segments)
// Dùng trước khi re-import GeoJSON. Route đã tạo trước đó KHÔNG bị ảnh hưởng.
export const removeAllWaterways = async () => {
    try {
        const data = await apiDeleteAllWaterways();
        return data;
    } catch (error) {
        console.error('Lỗi khi xóa toàn bộ waterways:', error);
        throw error;
    }
};