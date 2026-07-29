import { getReviewableTrips as apiGetReviewableTrips, createTripReview as apiCreateTripReview } from '../api/reviewApi';

// Service: Danh sách chuyến tôi có thể / đã đánh giá (dùng để hiện nút "Đánh giá" trong chi tiết booking)
export const fetchReviewableTrips = async (params) => {
    try {
        return await apiGetReviewableTrips(params);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách chuyến có thể đánh giá:', error);
        throw error;
    }
};

// Service: Gửi đánh giá cho 1 chuyến đã hoàn thành
export const submitTripReview = async (tripId, payload) => {
    try {
        return await apiCreateTripReview(tripId, payload);
    } catch (error) {
        console.error(`Lỗi khi gửi đánh giá chuyến ${tripId}:`, error);
        throw error;
    }
};
