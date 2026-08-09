import api from './axios';

// API: Danh sách đánh giá công khai (status=Published) kèm averageRating toàn hệ thống. Public, không cần token.
export const getPublicReviews = (params = {}) =>
    api.get('/reviews', { params, skipAuth: true }).then(response => response.data);

// API: Các booking tôi có thể / đã đánh giá (mới hoàn thành trước). myReview=null nghĩa là chưa đánh giá.
// Mỗi item vẫn kèm tripId/tripCode/routeName của 1 chiều, cộng thêm bookingId/bookingCode/isRoundTrip để gộp theo booking.
export const getReviewableTrips = (params = {}) =>
    api.get('/reviews/my/reviewable-trips', { params }).then(response => response.data);

// API: Đánh giá 1 booking đã hoàn thành dịch vụ (rating 1-5, comment optional).
// Một chiều/charter: đánh giá được khi chuyến Completed. Khứ hồi: cần cả 2 chiều Completed. Mỗi khách chỉ gửi được 1 lần/booking.
export const createBookingReview = (bookingId, data) =>
    api.post(`/reviews/bookings/${bookingId}`, data).then(response => response.data);

// API (Admin/Manager): Danh sách toàn bộ đánh giá — kèm khách hàng, bookingCode, tripCode, tuyến để đối soát.
export const getAdminReviews = (params = {}) =>
    api.get('/reviews/admin', { params }).then(response => response.data);

// API (Admin/Manager): Duyệt (Published) / ẩn (Hidden) 1 đánh giá. Idempotent — gửi lại status hiện tại thì giữ nguyên.
export const updateReviewStatus = (id, status) =>
    api.patch(`/reviews/${id}/status`, { status }).then(response => response.data);
