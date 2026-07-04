import {
    getBoats as apiGetBoats,
    createBoat as apiCreateBoat,
    getBoatById as apiGetBoatById,
    updateBoat as apiUpdateBoat,
    updateBoatStatus as apiUpdateBoatStatus
} from '../api/boatApi';

// Hàm Service lấy danh sách tàu
export const fetchAllBoats = async () => {
    try {
        const data = await apiGetBoats();
        return data;
    } catch (error) {
        console.error('Error fetching boats list:', error);
        throw error;
    }
};

// Hàm Service tạo tàu mới
export const addNewBoat = async (boatPayload) => {
    try {
        const response = await apiCreateBoat(boatPayload);
        return response;
    } catch (error) {
        console.error('Error in addNewBoat Service:', error);
        throw error;
    }
};

// Hàm Service lấy chi tiết tàu theo ID
export const fetchBoatDetail = async (boatId) => {
    try {
        return await apiGetBoatById(boatId);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết tàu ${boatId}:`, error);
        throw error;
    }
};

// Hàm Service cập nhật tàu
export const modifyBoat = async (boatId, boatPayload) => {
    try {
        return await apiUpdateBoat(boatId, boatPayload);
    } catch (error) {
        console.error(`Lỗi trong service modifyBoat tại ID ${boatId}:`, error);
        throw error;
    }
};

// Hàm Service cập nhật trạng thái tàu
export const modifyBoatStatus = async (boatId, statusPayload) => {
    try {
        return await apiUpdateBoatStatus(boatId, statusPayload);
    } catch (error) {
        console.error(`Lỗi khi cập nhật trạng thái tàu ${boatId}:`, error);
        throw error;
    }
};

// Hàm service xóa tàu
// export const deleteBoat = 