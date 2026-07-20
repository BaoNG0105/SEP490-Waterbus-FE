import api from './axios';

// Api lấy số dư và lịch sử điểm của user hiện tại
export const getMyPoints = (params = {}) =>
    api.get('/points/me', { params }).then(r => r.data);
