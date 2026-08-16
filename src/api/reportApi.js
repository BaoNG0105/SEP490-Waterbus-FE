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

// API: Báo cáo doanh thu (Admin/Manager) — tính theo Payments đã Paid trong khoảng fromDate/toDate.
// Bỏ ngày thì mặc định lấy từ đầu tháng hiện tại đến hôm nay theo giờ Việt Nam.
// params: fromDate, toDate, serviceType, paymentMethod, soldByStaffId, fromStationId, toStationId.
// Response: grossRevenue/refundAmount/netRevenue + byPaymentMethod/byServiceType/byStation/daily.
export const getRevenueReport = (params = {}) =>
    api.get('/reports/revenue', { params }).then(response => response.data);
