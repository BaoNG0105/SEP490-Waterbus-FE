import api from './axios';

// API: Danh sách chuyến tàu (query params: operatingDate dd/MM/yyyy, routeCode, status, tripType, routeType — tất cả optional)
export const getTrips = (params) =>
    api.get('/trips', { params }).then(response => response.data);

// API: Tạo chuyến tàu mới (routeCode, boatCode, operatingDate, departureTime bắt buộc).
// Legacy — giữ tương thích; form Admin dùng POST /trips/schedule.
export const createTrip = (data) =>
    api.post('/trips', data).then(response => response.data);

/** Legacy — giữ tương thích; form Admin dùng POST /trips/schedule. */
export const generateTrips = (data) =>
    api.post('/trips/generate', data).then(response => response.data);

/** POST /api/trips/schedule — tạo 1 hoặc nhiều chuyến (cùng payload). Không gửi giá. */
export const scheduleTrips = (data) =>
    api.post('/trips/schedule', data).then(response => response.data);

/**
 * POST /api/trips/schedule/round-trip-preview — gợi ý lịch khứ hồi 1 tàu (không tạo DB).
 * Body: boatCode, outboundRouteCode, inboundRouteCode, fromDate, toDate, startTime, endTime,
 * daysOfWeek, outboundStops, inboundStops. Không nhận autoSpacing.
 */
export const previewRoundTripSchedule = (data) =>
    api.post('/trips/schedule/round-trip-preview', data).then(response => response.data);

/** PATCH /api/trips/{tripId}/boat — đổi tàu (Admin/Manager). Body: { boatId }. */
export const updateTripBoat = (tripId, boatId) =>
    api.patch(`/trips/${tripId}/boat`, { boatId }).then(response => response.data);

// API: Tìm chuyến tàu bán vé lẻ theo bến đi/bến đến/ngày (params: fromStationId, toStationId, operatingDate dd/MM/yyyy, routeType optional)
export const searchTrips = (params) =>
    api.get('/trips/search', { params }).then(response => response.data);

// API: Tìm chuyến tham quan ngắm cảnh (Water Sightseeing) theo ngày (params: operatingDate dd/MM/yyyy —
// không cần fromStationId/toStationId vì tuyến ngắm cảnh là vòng lặp, bến bắt đầu = bến kết thúc).
export const searchSightseeingTrips = (params) =>
    api.get('/trips/search/sightseeing', { params }).then(response => response.data);

// API: Chi tiết 1 chuyến tàu kèm danh sách bến dừng (trip_stops)
export const getTripById = (id) =>
    api.get(`/trips/${id}`).then(response => response.data);

/** GET /api/trips/{tripId}/passengers — manifest khách mua vé của đúng chuyến (Admin/Manager/Staff). */
export const getTripPassengers = (tripId) =>
    api.get(`/trips/${encodeURIComponent(String(tripId || "").trim())}/passengers`)
        .then((response) => response.data);

// API: Sơ đồ ghế của 1 chuyến tàu (kèm trạng thái theo chuyến). fromStationCode/toStationCode optional —
// truyền vào để xem trạng thái ghế đúng theo chặng khách sẽ đi, bỏ trống để xem trạng thái cả tuyến.
export const getTripSeats = (id, params = {}) =>
    api.get(`/trips/${id}/seats`, { params }).then(response => response.data);

// API: Tạm giữ ghế khi khách đang chọn (TTL 3 phút, tự gia hạn khi gọi lại; tối đa 10 ghế)
// fromStationCode/toStationCode bắt buộc với trip Regular (ghế bán theo chặng).
export const holdTripSeats = (id, seatNumbers, fromStationCode, toStationCode) =>
    api.post(`/trips/${id}/seats/hold`, { seatNumbers, fromStationCode, toStationCode }).then(response => response.data);

// API: Nhả ghế đang tạm giữ (chỉ nhả được ghế do chính user đang giữ)
export const releaseTripSeats = (id, seatNumbers, fromStationCode, toStationCode) =>
    api.post(`/trips/${id}/seats/release`, { seatNumbers, fromStationCode, toStationCode }).then(response => response.data);

// API: Bắt đầu delay chuyến (staff trên tàu) — body: { reason, startStopOrder }
export const startTripDelay = (id, payload) =>
    api.post(`/trips/${id}/delay/start`, payload).then(response => response.data);

// API: Tiếp tục sau delay — body: { note }. BE tính lan delay theo lịch tàu thật (không còn rule cứng 15 phút).
export const resumeTripDelay = (id, payload) =>
    api.post(`/trips/${id}/delay/resume`, payload).then(response => response.data);

/** POST /api/trips/{tripId}/cancel-no-show — Admin hủy chuyến Sightseeing không khách / no-show. */
export const cancelTripNoShow = (tripId, payload = {}) =>
    api.post(`/trips/${encodeURIComponent(String(tripId || "").trim())}/cancel-no-show`, payload)
        .then((response) => response.data);
