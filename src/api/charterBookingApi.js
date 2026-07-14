import api from './axios';

const charterBookingDetailRequests = new Map();

export const getCharterBookings = () =>
    api.get('/charter-bookings').then(response => response.data);

export const createCharterBooking = (data) =>
    api.post('/charter-bookings', data).then(response => response.data);

export const updateCharterBooking = (id, data) =>
    api.put(`/charter-bookings/${encodeURIComponent(id)}`, data).then(response => response.data);

export const getCharterBookingById = async (id) => {
    const requestKey = String(id);
    const pendingRequest = charterBookingDetailRequests.get(requestKey);

    if (pendingRequest) return pendingRequest;

    const request = api
        .get(`/charter-bookings/${encodeURIComponent(requestKey)}`)
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
        .get(`/charter-bookings/manifest/${encodeURIComponent(bookingCode)}`)
        .then(response => response.data);

export const getCharterBookingManifestByQrToken = (qrToken) =>
    api
        .get(`/charter-bookings/manifest/qr/${encodeURIComponent(qrToken)}`)
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
    api.get('/charter-bookings/admin').then(response => response.data);

export const getAdminCharterBookingById = (id) =>
    api.get(`/charter-bookings/admin/${id}`).then(response => response.data);

export const updateAdminCharterBookingStatus = (id, data) =>
    api.patch(`/charter-bookings/admin/${id}/status`, data).then(response => response.data);

export const getAdminCharterBookingRouteCandidates = (id) =>
    api.get(`/charter-bookings/admin/${encodeURIComponent(id)}/route-candidates`).then((response) => response.data);

export const previewAdminCharterBookingQuote = (id, data) =>
    api.post(`/charter-bookings/admin/${id}/quote-preview`, data).then(response => response.data);

export const quoteAdminCharterBooking = (id, data) =>
    api.put(`/charter-bookings/admin/${id}/quote`, data).then(response => response.data);

export const assignAdminCharterBookingManager = (id, data) =>
    api.put(`/charter-bookings/admin/${id}/manager`, data).then(response => response.data);

export const getAssignedCharterBookings = () =>
    api.get('/charter-bookings/assigned').then(response => response.data);

export const getAssignedCharterBookingById = (id) =>
    api.get(`/charter-bookings/assigned/${encodeURIComponent(id)}`).then(response => response.data);

export const respondToCharterBookingQuote = (id, data) =>
    api.post(`/charter-bookings/${encodeURIComponent(id)}/quote-response`, data).then(response => response.data);

/** Customer: thêm hành khách mới (append — không replace). */
export const addCharterBookingPassengers = (id, data) =>
    api.post(`/charter-bookings/${encodeURIComponent(id)}/passengers`, data).then((response) => response.data);

/** Admin/Manager: duyệt yêu cầu thêm HK (theo requestBatchId). */
export const approvePassengerAddRequest = (id, requestBatchId, { assigned = true } = {}) => {
    const base = assigned ? "assigned" : "admin";
    return api
        .post(
            `/charter-bookings/${base}/${encodeURIComponent(id)}/passenger-add-requests/${encodeURIComponent(requestBatchId)}/approve`,
        )
        .then((response) => response.data);
};

/** Admin/Manager: từ chối yêu cầu thêm HK (note bắt buộc). */
export const rejectPassengerAddRequest = (id, requestBatchId, data = {}, { assigned = true } = {}) => {
    const base = assigned ? "assigned" : "admin";
    return api
        .post(
            `/charter-bookings/${base}/${encodeURIComponent(id)}/passenger-add-requests/${encodeURIComponent(requestBatchId)}/reject`,
            data,
        )
        .then((response) => response.data);
};
