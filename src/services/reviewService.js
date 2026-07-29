import {
    getReviewableTrips as apiGetReviewableTrips,
    createTripReview as apiCreateTripReview,
    getAdminReviews as apiGetAdminReviews,
    updateReviewStatus as apiUpdateReviewStatus,
} from '../api/reviewApi';

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

// Service (Admin/Manager): Danh sách toàn bộ đánh giá để duyệt/ẩn
export const fetchAdminReviews = async (params) => {
    try {
        return await apiGetAdminReviews(params);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách đánh giá (admin):', error);
        throw error;
    }
};

// Service (Admin/Manager): Duyệt (Published) / ẩn (Hidden) 1 đánh giá
export const changeReviewStatus = async (id, status) => {
    try {
        return await apiUpdateReviewStatus(id, status);
    } catch (error) {
        console.error(`Lỗi khi đổi trạng thái đánh giá ${id}:`, error);
        throw error;
    }
};
