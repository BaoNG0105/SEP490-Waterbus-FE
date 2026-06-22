import { 
    getWaterways as apiGetWaterways, 
    getWaterwayById as apiGetWaterwayById 
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