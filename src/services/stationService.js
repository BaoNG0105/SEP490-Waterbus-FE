import { getStations as apiGetStations } from '../api/stationApi';

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