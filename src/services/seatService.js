import { 
    getSeatLayout as apiGetSeatLayout,
    generateSeatMatrix as apiGenerateSeatMatrix,
    configureSeatLayout as apiConfigureSeatLayout,
    updateSeatStatus as apiUpdateSeatStatus,
    deleteSeatLayout as apiDeleteSeatLayout
} from '../api/seatApi';

// TẢI DỮ LIỆU SƠ ĐỒ GHẾ CỦA TÀU
export const fetchSeatLayout = async (boatId) => {
    try {
        return await apiGetSeatLayout(boatId);
    } catch (error) {
        console.error(`Lỗi khi tải sơ đồ ghế của tàu ${boatId}:`, error);
        throw error;
    }
};

// SINH MA TRẬN GHẾ THÔ (Dựa theo số hàng/cột)
export const generateMatrix = async (boatId, matrixPayload) => {
    try {
        return await apiGenerateSeatMatrix(boatId, matrixPayload);
    } catch (error) {
        console.error(`Lỗi khi khởi tạo ma trận cho tàu ${boatId}:`, error);
        throw error;
    }
};

// SETUP/CHỐT SỔ SƠ ĐỒ GHẾ CHÍNH THỨC
export const configureSeats = async (boatId, layoutPayload) => {
    try {
        return await apiConfigureSeatLayout(boatId, layoutPayload);
    } catch (error) {
        console.error(`Lỗi khi cấu hình/lưu thiết kế ghế tàu ${boatId}:`, error);
        throw error;
    }
};

// CẬP NHẬT TRẠNG THÁI GHẾ LẺ (BẬT/TẮT GHẾ)
export const changeSeatStatus = async (boatId, seatId, isActive) => {
    try {
        return await apiUpdateSeatStatus(boatId, seatId, { isActive });
    } catch (error) {
        console.error(`Lỗi khi cập nhật trạng thái ghế ID ${seatId}:`, error);
        throw error;
    }
};

// XÓA TOÀN BỘ MA TRẬN GHẾ ĐỂ LÀM LẠI TỪ ĐẦU
export const deleteSeats = async (boatId) => {
    try {
        return await apiDeleteSeatLayout(boatId);
    } catch (error) {
        console.error(`Lỗi khi xóa ma trận ghế tàu ${boatId}:`, error);
        throw error;
    }
};