import api from './axios';

// API: Tạo booking vé lẻ (Waterbus/Sightseeing). Hỗ trợ khứ hồi qua returnTripCode/returnItems.
// Có thể kèm insuranceSelected + insurancePackageId (bookingType SeatBooking).
export const createBooking = (data) =>
    api.post('/bookings', data).then(response => response.data);

// API: Lịch sử đặt vé của tôi (mới nhất trước). itemCount = số vé còn hiệu lực (chưa bị cancel).
export const getMyBookings = () =>
    api.get('/bookings').then(response => response.data);

// API: Chi tiết 1 booking (kèm danh sách vé, payments). 404 nếu không thuộc về user đang đăng nhập.
export const getBookingById = (id) =>
    api.get(`/bookings/${id}`).then(response => response.data);

// API: Hủy booking (hủy toàn bộ booking + tất cả BookingItem bên trong). Không hủy được nếu tàu đã
// khởi hành (departureTime <= now). Hoàn lại lượt dùng mã khuyến mãi nếu có.
export const cancelBooking = (id) =>
    api.post(`/bookings/${id}/cancel`).then(response => response.data);
