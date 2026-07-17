import { createBooking as apiCreateBooking, getMyBookings as apiGetMyBookings } from '../api/bookingApi';

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
