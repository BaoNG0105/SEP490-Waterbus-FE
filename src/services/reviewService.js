import {
    getPublicReviews as apiGetPublicReviews,
    getReviewableTrips as apiGetReviewableTrips,
    createBookingReview as apiCreateBookingReview,
    getAdminReviews as apiGetAdminReviews,
    updateReviewStatus as apiUpdateReviewStatus,
} from '../api/reviewApi';

const pick = (source, keys, fallback = '') => {
    for (const key of keys) {
        const value = key.split('.').reduce((obj, part) => obj?.[part], source);
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
};

/** Chuẩn hoá 1 dòng của GET /reviews/my/reviewable-trips. Review giờ tính theo booking (bookingId), không phải theo trip. */
export const normalizeReviewableTrip = (trip) => {
    const myReviewRaw = trip?.myReview ?? trip?.MyReview ?? null;
    return {
        tripId: String(pick(trip, ['tripId', 'id'], '')),
        tripCode: pick(trip, ['tripCode'], ''),
        routeName: pick(trip, ['routeName'], ''),
        departureTime: pick(trip, ['departureTime'], ''),
        arrivalTime: pick(trip, ['arrivalTime'], ''),
        bookingId: String(pick(trip, ['bookingId'], '')),
        bookingCode: pick(trip, ['bookingCode'], ''),
        isRoundTrip: Boolean(trip?.isRoundTrip),
        myReview: myReviewRaw
            ? {
                rating: Number(pick(myReviewRaw, ['rating'], 0)),
                comment: pick(myReviewRaw, ['comment'], ''),
                status: pick(myReviewRaw, ['status'], ''),
            }
            : null,
    };
};

// Service: Danh sách đánh giá công khai (trang chủ / marketing) — kèm averageRating toàn hệ thống
export const fetchPublicReviews = async (params) => {
    try {
        return await apiGetPublicReviews(params);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách đánh giá công khai:', error);
        throw error;
    }
};

// Service: Danh sách chuyến tôi có thể / đã đánh giá (dùng để hiện nút "Đánh giá" trong chi tiết booking)
export const fetchReviewableTrips = async (params) => {
    try {
        return await apiGetReviewableTrips(params);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách chuyến có thể đánh giá:', error);
        throw error;
    }
};

// Service: Gửi đánh giá cho 1 booking đã hoàn thành dịch vụ
export const submitBookingReview = async (bookingId, payload) => {
    try {
        return await apiCreateBookingReview(bookingId, payload);
    } catch (error) {
        console.error(`Lỗi khi gửi đánh giá booking ${bookingId}:`, error);
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
