import { 
    getVessels as apiGetVessels,
    createVessel as apiCreateVessel
} from '../api/vesselApi';

// Hàm Service lấy danh sách tàu
export const fetchAllVessels = async () => {
    try {
        const data = await apiGetVessels();
        return data;
    } catch (error) {
        console.error('Error fetching vessels list:', error);
        throw error;
    }
};

// Hàm Service tạo tàu mới
export const addNewVessel = async (vesselPayload) => {
    try {
        const response = await apiCreateVessel(vesselPayload);
        return response;
    } catch (error) {
        console.error('Error in addNewVessel Service:', error);
        throw error;
    }
};

// Hàm Service lấy chi tiết tàu theo ID