import api from './axios';

// API: Báo cáo tổng hợp / quản lý booking (Admin/Manager/Staff).
// Staff chỉ thấy booking bán tại quầy của chính mình; Admin/Manager thấy toàn bộ.
// params: keyword, bookingStatus, paymentStatus, serviceType, paymentMethod, soldByStaffId,
// createdFrom, createdTo, departureFrom, departureTo, page (required), pageSize (required).
export const getBookingsReport = (params = {}) =>
    api.get('/reports/bookings', { params }).then(response => response.data);

// API: Danh sách booking rút gọn cho FE autocomplete/select/dropdown.
// params: keyword, bookingStatus, paymentStatus, serviceType, limit (required).
export const getBookingsSelect = (params = {}) =>
    api.get('/reports/bookings/select', { params }).then(response => response.data);
