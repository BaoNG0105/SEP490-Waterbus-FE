import { createBooking as apiCreateBooking, getMyBookings as apiGetMyBookings, getBookingById as apiGetBookingById, cancelBooking as apiCancelBooking } from '../api/bookingApi';

// Service: Tạo booking vé lẻ từ danh sách ghế đã chọn (đơn chiều hoặc khứ hồi)
export const submitBooking = async (payload) => {
    try {
        return await apiCreateBooking(payload);
    } catch (error) {
        console.error('Lỗi khi tạo booking:', error);
        throw error;
    }
};

// Service: Lấy lịch sử đặt vé Waterbus của người dùng hiện tại
export const fetchMyBookings = async () => {
    try {
        const data = await apiGetMyBookings();
        return data || [];
    } catch (error) {
        console.error('Lỗi khi lấy danh sách booking của tôi:', error);
        throw error;
    }
};

// Service: Lấy chi tiết 1 booking (kèm danh sách vé, payments) của tôi
export const fetchMyBookingDetail = async (id) => {
    try {
        return await apiGetBookingById(id);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết booking ${id}:`, error);
        throw error;
    }
};

// Service: Hủy booking của tôi (hủy toàn bộ vé bên trong)
export const cancelMyBooking = async (id) => {
    try {
        return await apiCancelBooking(id);
    } catch (error) {
        console.error(`Lỗi khi hủy booking ${id}:`, error);
        throw error;
    }
};
