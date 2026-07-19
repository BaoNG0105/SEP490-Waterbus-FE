import { getMyPoints as apiGetMyPoints } from '../api/pointApi';

// Service lấy số dư và lịch sử điểm của user hiện tại
export const fetchMyPoints = async (params = {}) => {
    try {
        return await apiGetMyPoints(params);
    } catch (error) {
        console.error('Error fetching my points:', error);
        throw error;
    }
};
