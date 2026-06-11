import { 
    getSeatLayout as apiGetSeatLayout,
    generateSeatMatrix as apiGenerateSeatMatrix,
    configureSeatLayout as apiConfigureSeatLayout,
    updateSeatStatus as apiUpdateSeatStatus,
    deleteSeatLayout as apiDeleteSeatLayout
} from '../api/seatApi';

// ==========================================
// TẢI DỮ LIỆU SƠ ĐỒ GHẾ CỦA TÀU
// ==========================================
export const fetchSeatLayout = async (vesselId) => {
    try {
        return await apiGetSeatLayout(vesselId);
    } catch (error) {
        console.error(`Lỗi khi tải sơ đồ ghế của tàu ${vesselId}:`, error);
        throw error;
    }
};

// ==========================================
// SINH MA TRẬN GHẾ THÔ (Dựa theo số hàng/cột)
// Payload ví dụ: { decks: [{ deckNumber: 1, rowCount: 10, columnCount: 6 }] }
// ==========================================
export const generateMatrix = async (vesselId, matrixPayload) => {
    try {
        return await apiGenerateSeatMatrix(vesselId, matrixPayload);
    } catch (error) {
        console.error(`Lỗi khi khởi tạo ma trận cho tàu ${vesselId}:`, error);
        throw error;
    }
};

// ==========================================
// SETUP/CHỐT SỔ SƠ ĐỒ GHẾ CHÍNH THỨC
// Payload cực kỳ phức tạp gồm: decks, seatBlocks, facilities, cells...
// ==========================================
export const configureSeats = async (vesselId, layoutPayload) => {
    try {
        return await apiConfigureSeatLayout(vesselId, layoutPayload);
    } catch (error) {
        console.error(`Lỗi khi cấu hình/lưu thiết kế ghế tàu ${vesselId}:`, error);
        throw error;
    }
};

// ==========================================
// CẬP NHẬT TRẠNG THÁI GHẾ LẺ (BẢO TRÌ/HỎNG)
// ==========================================
export const changeSeatStatus = async (vesselId, seatId, statusValue) => {
    try {
        return await apiUpdateSeatStatus(vesselId, seatId, { status: statusValue });
    } catch (error) {
        console.error(`Lỗi khi cập nhật trạng thái ghế ID ${seatId}:`, error);
        throw error;
    }
};

// ==========================================
// XÓA TOÀN BỘ MA TRẬN GHẾ ĐỂ LÀM LẠI TỪ ĐẦU
// ==========================================
export const deleteSeats = async (vesselId) => {
    try {
        return await apiDeleteSeatLayout(vesselId);
    } catch (error) {
        console.error(`Lỗi khi xóa ma trận ghế tàu ${vesselId}:`, error);
        throw error;
    }
};