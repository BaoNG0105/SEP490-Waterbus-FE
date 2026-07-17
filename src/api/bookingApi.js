import api from './axios';

// API: Tạo booking vé lẻ (Waterbus). Hỗ trợ khứ hồi qua returnTripCode/returnItems trong cùng 1 booking.
export const createBooking = (data) =>
    api.post('/bookings', data).then(response => response.data);

// API: Lịch sử đặt vé của tôi (mới nhất trước). itemCount = số vé còn hiệu lực (chưa bị cancel).
export const getMyBookings = () =>
    api.get('/bookings').then(response => response.data);
