import {
    getVessels as apiGetVessels,
    createVessel as apiCreateVessel,
    getVesselById as apiGetVesselById,
    updateVessel as apiUpdateVessel,
    updateVesselStatus as apiUpdateVesselStatus
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
export const fetchVesselDetail = async (vesselId) => {
    try {
        return await apiGetVesselById(vesselId);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết tàu ${vesselId}:`, error);
        throw error;
    }
};

// Hàm Service cập nhật tàu
export const modifyVessel = async (vesselId, vesselPayload) => {
    try {
        return await apiUpdateVessel(vesselId, vesselPayload);
    } catch (error) {
        console.error(`Lỗi trong service modifyVessel tại ID ${vesselId}:`, error);
        throw error;
    }
};

// Hàm Service cập nhật trạng thái tàu
export const modifyVesselStatus = async (vesselId, statusPayload) => {
    try {
        return await apiUpdateVesselStatus(vesselId, statusPayload);
    } catch (error) {
        console.error(`Lỗi khi cập nhật trạng thái tàu ${vesselId}:`, error);
        throw error;
    }
};