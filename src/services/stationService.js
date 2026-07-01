import { 
    getStations as apiGetStations,
    getStationById as apiGetStationById,
    updateStation as apiUpdateStation    
} from '../api/stationApi';

// Service: Tải danh sách nhà ga và xử lý bẫy lỗi hệ thống
export const fetchAllStations = async () => {
    try {
        const data = await apiGetStations();
        return data;
    } catch (error) {
        console.error('Lỗi khi lấy danh sách nhà ga từ Service:', error);
        throw error;
    }
};

// Service lấy thông tin chi tiết nhà ga bến tàu
export const fetchStationDetail = async (stationId) => {
    try {
        return await apiGetStationById(stationId);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết nhà ga ${stationId}:`, error);
        throw error;
    }
};

// Service cập nhật dữ liệu nhà ga bến tàu
export const modifyStation = async (stationId, stationPayload) => {
    try {
        return await apiUpdateStation(stationId, stationPayload);
    } catch (error) {
        console.error(`Lỗi khi thực hiện modifyStation cho ID ${stationId}:`, error);
        throw error;
    }
};