import api from './axios';

// API: Báo cáo tổng hợp / quản lý booking (Admin/Manager/Staff).
// Staff chỉ thấy booking bán tại quầy của chính mình; Admin/Manager thấy toàn bộ.
// params: keyword, bookingStatus, paymentStatus, serviceType, paymentMethod, soldByStaffId,
// createdFrom, createdTo, departureFrom, departureTo, page (required), pageSize (required).
export const getBookingsReport = (params = {}) =>
    api.get('/reports/bookings', { params }).then(response => response.data);

// Xuất toàn bộ booking khớp bộ lọc hiện tại (không phân trang) dưới dạng Excel.
export const exportBookingsReport = (params = {}) =>
    api.get('/reports/bookings/export', { params, responseType: 'blob' });

// API: Danh sách booking rút gọn cho FE autocomplete/select/dropdown.
// params: keyword, bookingStatus, paymentStatus, serviceType, limit (required).
export const getBookingsSelect = (params = {}) =>
    api.get('/reports/bookings/select', { params }).then(response => response.data);

// API: Báo cáo doanh thu (Admin/Manager) — tính theo Payments đã Paid trong khoảng fromDate/toDate.
// Bỏ ngày thì mặc định lấy từ đầu tháng hiện tại đến hôm nay theo giờ Việt Nam.
// params: fromDate, toDate, serviceType, paymentMethod, soldByStaffId, fromStationId, toStationId.
// Response: grossRevenue/refundAmount/netRevenue + byPaymentMethod/byServiceType/byStation/daily.
// Booking miễn phí không có payment có tiền; dùng /reports/bookings?paymentMethod=Free để đếm.
export const getRevenueReport = (params = {}) =>
    api.get('/reports/revenue', { params }).then(response => response.data);

// API: Doanh thu Waterbus theo bến — dùng riêng cho trang RevenueReport (cột "doanh thu theo bến").
// params: fromDate, toDate (yyyy-MM-dd).
// Response: { from, to, totalGross, totalRefund, totalNet, bookingCount, paymentCount, totalTicketCount, stations[] }
// Mỗi station: { stationId, stationName, stationCode, departureCount, arrivalCount,
//   departureTicketCount, arrivalTicketCount, departureGross, arrivalGross,
//   departureRefund, arrivalRefund, departureNet, arrivalNet, totalGross, totalRefund, totalNet }
export const getWaterbusStationRevenue = (params = {}) =>
    api.get('/reports/revenue/waterbus/stations', { params }).then(response => response.data);

// API: Doanh thu hôm nay + series 7 ngày gần nhất (Admin/Manager).
// Response: {
//   date (yyyy-MM-dd của "hôm nay" theo VN), todayNetRevenue, todayBookingCount, todayTicketCount,
//   yesterdayNetRevenue,
//   last7Days: [{ date, netRevenue, bookingCount, ticketCount }, ...7],
//   series: { netRevenue: [...7], bookingCount: [...7], ticketCount: [...7] }
// }
export const getRevenueToday = () =>
    api.get('/reports/revenue/today').then(response => response.data);

// API: Doanh thu/booking theo từng giờ hôm nay (Admin/Manager).
// Response: { date: "yyyy-MM-dd", hours: [{ hour: 0..23, bookingCount, netRevenue }] }.
// FE giữ fallback từ danh sách booking cho tới khi BE triển khai endpoint này.
export const getRevenueTodayHourly = () =>
    api.get('/reports/revenue/today/hourly').then(response => response.data);

// API: Phân bổ booking theo trạng thái (Admin/Manager).
// params: fromDate, toDate (yyyy-MM-dd, optional).
// Response: { from, to, total, statuses: [{ status, bookingCount, ticketCount, netRevenue }, ...] }
export const getBookingsByStatus = (params = {}) =>
    api.get('/reports/bookings/by-status', { params }).then(response => response.data);

// API: Top tuyến đường phổ biến (Admin/Manager) — theo số booking/ticket.
// params: fromDate, toDate (optional), limit (optional, default BE).
// Response: { from, to, total, items: [{ routeId, routeName, fromStationName, toStationName,
//   bookingCount, ticketCount, netRevenue, grossRevenue }, ...] }
export const getTopRoutes = (params = {}) =>
    api.get('/reports/routes/top', { params }).then(response => response.data);

// API: Top khách hàng (Admin/Manager) — theo số booking/ticket trong kỳ.
// params: fromDate, toDate (optional), limit (optional, default BE).
// Response: { from, to, total, items: [{ customerKey, name, phone, email,
//   bookingCount, ticketCount, netRevenue, grossRevenue }, ...] }
export const getTopCustomersReport = (params = {}) =>
    api.get('/reports/revenue/top-customers', { params }).then(response => response.data);
