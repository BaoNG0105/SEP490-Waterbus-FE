import api from './axios';

// API: Các chuyến tôi có thể / đã đánh giá (mới hoàn thành trước). myReview=null nghĩa là chưa đánh giá.
export const getReviewableTrips = (params = {}) =>
    api.get('/reviews/my/reviewable-trips', { params }).then(response => response.data);

// API: Đánh giá 1 chuyến đã hoàn thành (rating 1-5, comment optional). Mỗi khách chỉ gửi được 1 lần/chuyến.
export const createTripReview = (tripId, data) =>
    api.post(`/reviews/trips/${tripId}`, data).then(response => response.data);
