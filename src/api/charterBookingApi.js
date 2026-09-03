import api from './axios';

const charterBookingDetailRequests = new Map();

const freshDetailConfig = () => ({
    params: { _ts: Date.now() },
    headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
    },
});

export const getCharterBookings = () =>
    api.get('/charter-bookings', freshDetailConfig()).then(response => response.data);

export const createCharterBooking = (data) =>
    api.post('/charter-bookings', data).then(response => response.data);

export const updateCharterBooking = (id, data) =>
    api.put(`/charter-bookings/${encodeURIComponent(id)}`, data).then(response => response.data);

export const getCharterBookingById = async (id) => {
    const requestKey = String(id);
    const pendingRequest = charterBookingDetailRequests.get(requestKey);

    if (pendingRequest) return pendingRequest;

    const request = api
        .get(`/charter-bookings/${encodeURIComponent(requestKey)}`, freshDetailConfig())
        .then(response => response.data);

    charterBookingDetailRequests.set(requestKey, request);

    try {
        return await request;
    } finally {
        if (charterBookingDetailRequests.get(requestKey) === request) {
            charterBookingDetailRequests.delete(requestKey);
        }
    }
};

export const cancelCharterBooking = (id, data = {}) =>
    api.post(`/charter-bookings/${id}/cancel`, data).then(response => response.data);

export const updateCharterBookingPassengers = (id, data) =>
    api.put(`/charter-bookings/${id}/passengers`, data).then(response => response.data);

export const importCharterBookingPassengers = (id, file) => {
    const formData = new FormData();
    formData.append('file', file);

    return api
        .post(`/charter-bookings/${encodeURIComponent(id)}/passengers/import`, formData)
        .then(response => response.data);
};

export const getCharterBookingManifestByCode = (bookingCode) =>
    api
        .get(`/charter-bookings/manifest/${encodeURIComponent(bookingCode)}`, freshDetailConfig())
        .then(response => response.data);

export const getCharterBookingManifestByQrToken = (qrToken) =>
    api
        .get(`/charter-bookings/manifest/qr/${encodeURIComponent(qrToken)}`, freshDetailConfig())
        .then(response => response.data);

export const getCharterBookingQrImage = (qrToken) =>
    api.get(`/charter-bookings/qr-image/${encodeURIComponent(qrToken)}`, {
        responseType: 'blob',
    });

export const updateCharterBookingAttendance = (qrToken, data) =>
    api
        .post(`/charter-bookings/manifest/qr/${encodeURIComponent(qrToken)}/attendance`, data)
        .then(response => response.data);

export const exportAllCharterBookingTickets = (id) =>
    api.get(`/charter-bookings/${encodeURIComponent(id)}/tickets/export`, {
        responseType: 'blob',
    });

export const exportSelectedCharterBookingTickets = (id, data) =>
    api.post(`/charter-bookings/${encodeURIComponent(id)}/tickets/export`, data, {
        responseType: 'blob',
    });

export const printCharterBookingTickets = (id, data) =>
    api.post(`/charter-bookings/${encodeURIComponent(id)}/tickets/print`, data, {
        responseType: 'blob',
    });

export const exportCharterBookingTicketsPdf = (id, data) =>
    api.post(`/charter-bookings/${encodeURIComponent(id)}/tickets/pdf`, data, {
        responseType: 'blob',
    });

export const exportCharterBookingTicketsPdfByQrToken = (qrToken) =>
    api.get(`/charter-bookings/tickets/pdf/${encodeURIComponent(qrToken)}`, {
        responseType: 'blob',
    });

export const getAdminCharterBookings = () =>
    api.get('/charter-bookings/admin', freshDetailConfig()).then(response => response.data);

/** GET /api/charter-bookings/admin/rental-price-policies — giá thuê theo số tầng. */
export const getAdminRentalPricePolicies = () =>
    api.get('/charter-bookings/admin/rental-price-policies').then((response) => response.data);

/** PUT /api/charter-bookings/admin/rental-price-policies — upsert 1 policy. */
export const putAdminRentalPricePolicy = (payload) =>
    api.put('/charter-bookings/admin/rental-price-policies', payload).then((response) => response.data);

export const getAdminCharterBookingById = (id) =>
    api
        .get(`/charter-bookings/admin/${encodeURIComponent(id)}`, freshDetailConfig())
        .then(response => response.data);

export const updateAdminCharterBookingStatus = (id, data) =>
    api.patch(`/charter-bookings/admin/${id}/status`, data).then(response => response.data);

/** Admin: doi ngay gio khoi hanh va dong bo booking/trip lien quan. */
export const updateAdminCharterBookingDeparture = (id, data) =>
    api
        .patch(`/charter-bookings/admin/${encodeURIComponent(id)}/departure`, data)
        .then((response) => response.data);

export const getAdminCharterBookingRouteCandidates = (id) =>
    api.get(`/charter-bookings/admin/${encodeURIComponent(id)}/route-candidates`).then((response) => response.data);

export const previewAdminCharterBookingQuote = (id, data) =>
    api.post(`/charter-bookings/admin/${id}/quote-preview`, data).then(response => response.data);

export const quoteAdminCharterBooking = (id, data) =>
    api.put(`/charter-bookings/admin/${id}/quote`, data).then(response => response.data);

/** Admin: tạo trip Charter từ booking đã Confirmed (1 trip / tàu đã chốt). */
export const createAdminCharterBookingTrip = (id) =>
    api.post(`/charter-bookings/admin/${encodeURIComponent(id)}/trip`).then((response) => response.data);

/** Charter FE: gửi yêu cầu GPS vẽ tuyến cho booking chưa có selectedRoute. */
export const requestAdminCharterRouteDraw = (bookingId, data = {}) =>
    api
        .post(
            `/charter-bookings/admin/${encodeURIComponent(bookingId)}/route-draw-request`,
            data,
        )
        .then((response) => response.data);

/** GPS FE: danh sách yêu cầu vẽ tuyến (?status=Pending|InProgress|Done|Cancelled). */
export const getAdminRouteDrawRequests = (params = {}) =>
    api
        .get('/charter-bookings/admin/route-draw-requests', { params })
        .then((response) => response.data);

/** GPS FE: chi tiết 1 yêu cầu vẽ tuyến (stops, candidateRoute, …). */
export const getAdminRouteDrawRequestById = (requestId) =>
    api
        .get(`/charter-bookings/admin/route-draw-requests/${encodeURIComponent(requestId)}`)
        .then((response) => response.data);

/** GPS FE: mở request → chuyển InProgress. */
export const markAdminRouteDrawRequestInProgress = (requestId) =>
    api
        .patch(
            `/charter-bookings/admin/route-draw-requests/${encodeURIComponent(requestId)}/in-progress`,
        )
        .then((response) => response.data);

/** GPS FE: hoàn tất — gắn routeId Active có geometry vào booking. */
export const completeAdminRouteDrawRequest = (requestId, data) =>
    api
        .post(
            `/charter-bookings/admin/route-draw-requests/${encodeURIComponent(requestId)}/complete`,
            data,
        )
        .then((response) => response.data);

export const getAssignedCharterBookings = () =>
    api.get('/charter-bookings/assigned', freshDetailConfig()).then(response => response.data);

export const getAssignedCharterBookingById = (id) =>
    api
        .get(`/charter-bookings/assigned/${encodeURIComponent(id)}`, freshDetailConfig())
        .then(response => response.data);

export const respondToCharterBookingQuote = (id, data) =>
    api.post(`/charter-bookings/${encodeURIComponent(id)}/quote-response`, data).then(response => response.data);

/** Customer: thêm hành khách mới (append — không replace). */
export const addCharterBookingPassengers = (id, data) =>
    api.post(`/charter-bookings/${encodeURIComponent(id)}/passengers`, data).then((response) => response.data);

/** Customer: tạo PayOS riêng cho bảo hiểm phát sinh sau khi yêu cầu thêm khách được duyệt. */
export const createCharterPassengerAddInsurancePayment = (id) =>
    api
        .post(`/charter-bookings/${encodeURIComponent(id)}/passenger-add-insurance-payment`)
        .then((response) => response.data);

/** Admin/Manager: duyệt yêu cầu thêm HK — BE chỉ expose nhánh assigned. */
export const approvePassengerAddRequest = (id, requestBatchId, data = {}) =>
    api
        .post(
            `/charter-bookings/assigned/${encodeURIComponent(id)}/passenger-add-requests/${encodeURIComponent(requestBatchId)}/approve`,
            { note: data.note ?? null },
        )
        .then((response) => response.data);

/** Admin/Manager: từ chối yêu cầu thêm HK (note bắt buộc). */
export const rejectPassengerAddRequest = (id, requestBatchId, data = {}) =>
    api
        .post(
            `/charter-bookings/assigned/${encodeURIComponent(id)}/passenger-add-requests/${encodeURIComponent(requestBatchId)}/reject`,
            { note: data.note ?? null },
        )
        .then((response) => response.data);

/** Customer: resend tickets email */
export const resendCharterBookingTickets = (id) =>
    api
        .post(`/charter-bookings/${encodeURIComponent(id)}/resend-tickets`)
        .then((response) => response.data);
