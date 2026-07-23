import {
    getMyPoints as apiGetMyPoints,
    backfillCompletedBookingPoints as apiBackfillCompletedBookingPoints,
} from '../api/pointApi';

/** 1 điểm = 1 VND; tối đa dùng điểm = 50% giá trị đơn. */
export const POINTS_MAX_ORDER_RATIO = 0.5;

export const getMaxPointsToUse = (pointBalance, orderAmount) => {
    const balance = Math.max(0, Math.floor(Number(pointBalance) || 0));
    const amount = Math.max(0, Number(orderAmount) || 0);
    return Math.min(balance, Math.floor(amount * POINTS_MAX_ORDER_RATIO));
};

/** Ước điểm sẽ cộng sau khi chuyến Completed: floor(netPaid * 1%). */
export const estimateEarnPoints = (netPaidAmount) =>
    Math.max(0, Math.floor(Math.max(0, Number(netPaidAmount) || 0) * 0.01));

export const POINT_TRANSACTION_TYPES = {
    Earn: { vn: 'Tích điểm', en: 'Earned' },
    Redeem: { vn: 'Dùng điểm', en: 'Redeemed' },
    RedeemCancelled: { vn: 'Hủy dùng điểm', en: 'Redeem Cancelled' },
    RedeemReturned: { vn: 'Hoàn điểm', en: 'Redeem Returned' },
    EarnRevoked: { vn: 'Thu hồi điểm', en: 'Earn Revoked' },
};

export const getPointTransactionLabel = (type, lang = 'VN') => {
    const meta = POINT_TRANSACTION_TYPES[type];
    if (!meta) return type || '--';
    return lang === 'VN' ? meta.vn : meta.en;
};

// Service lấy số dư và lịch sử điểm của user hiện tại
export const fetchMyPoints = async (params = {}) => {
    try {
        return await apiGetMyPoints(params);
    } catch (error) {
        console.error('Error fetching my points:', error);
        throw error;
    }
};

/** Chỉ lấy số dư (pageSize nhỏ) — dùng ở checkout. */
export const fetchMyPointBalance = async () => {
    try {
        const data = await apiGetMyPoints({ page: 1, pageSize: 1 });
        return Number(data?.pointBalance ?? 0) || 0;
    } catch (error) {
        console.error('Error fetching point balance:', error);
        return 0;
    }
};

export const backfillCompletedBookingPoints = async () => {
    try {
        return await apiBackfillCompletedBookingPoints();
    } catch (error) {
        console.error('Error backfilling completed booking points:', error);
        throw error;
    }
};
