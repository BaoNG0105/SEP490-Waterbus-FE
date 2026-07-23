import api from './axios';

// Api lấy số dư và lịch sử điểm của user hiện tại
export const getMyPoints = (params = {}) =>
    api.get('/points/me', { params }).then(r => r.data);

// Admin: bù điểm một lần cho các booking đã Completed trước khi hệ thống điểm go-live
export const backfillCompletedBookingPoints = () =>
    api.post('/points/admin/backfill-completed-bookings').then(r => r.data);
