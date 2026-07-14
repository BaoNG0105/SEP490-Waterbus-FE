import {
    cancelCharterBooking as apiCancelCharterBooking,
    createCharterBooking as apiCreateCharterBooking,
    updateCharterBooking as apiUpdateCharterBooking,
    getCharterBookingById as apiGetCharterBookingById,
    getCharterBookings as apiGetCharterBookings,
    getAdminCharterBookings as apiGetAdminCharterBookings,
    getAdminCharterBookingById as apiGetAdminCharterBookingById,
    updateAdminCharterBookingStatus as apiUpdateAdminCharterBookingStatus,
    updateCharterBookingPassengers as apiUpdateCharterBookingPassengers,
    addCharterBookingPassengers as apiAddCharterBookingPassengers,
    approvePassengerAddRequest as apiApprovePassengerAddRequest,
    rejectPassengerAddRequest as apiRejectPassengerAddRequest,
    getAdminCharterBookingRouteCandidates as apiGetAdminCharterBookingRouteCandidates,
    previewAdminCharterBookingQuote as apiPreviewAdminCharterBookingQuote,
    quoteAdminCharterBooking as apiQuoteAdminCharterBooking,
    assignAdminCharterBookingManager as apiAssignAdminCharterBookingManager,
    getAssignedCharterBookings as apiGetAssignedCharterBookings,
    getAssignedCharterBookingById as apiGetAssignedCharterBookingById,
    respondToCharterBookingQuote as apiRespondToCharterBookingQuote,
    importCharterBookingPassengers as apiImportCharterBookingPassengers,
    getCharterBookingManifestByCode as apiGetCharterBookingManifestByCode,
    getCharterBookingManifestByQrToken as apiGetCharterBookingManifestByQrToken,
    getCharterBookingQrImage as apiGetCharterBookingQrImage,
    updateCharterBookingAttendance as apiUpdateCharterBookingAttendance,
    exportAllCharterBookingTickets as apiExportAllCharterBookingTickets,
    exportSelectedCharterBookingTickets as apiExportSelectedCharterBookingTickets,
    printCharterBookingTickets as apiPrintCharterBookingTickets,
    exportCharterBookingTicketsPdf as apiExportCharterBookingTicketsPdf,
    exportCharterBookingTicketsPdfByQrToken as apiExportCharterBookingTicketsPdfByQrToken,
} from '../api/charterBookingApi';

export const fetchMyCharterBookings = async () => {
    try {
        return await apiGetCharterBookings();
    } catch (error) {
        console.error('Lỗi khi lấy danh sách charter booking của tôi:', error);
        throw error;
    }
};

export const createMyCharterBooking = async (charterPayload) => {
    try {
        return await apiCreateCharterBooking(charterPayload);
    } catch (error) {
        console.error('Lỗi khi tạo yêu cầu charter booking:', error);
        throw error;
    }
};

export const updateMyCharterBooking = (id, charterPayload) =>
    apiUpdateCharterBooking(id, charterPayload);

export const fetchMyCharterBookingDetail = async (id) => {
    return apiGetCharterBookingById(id);
};

export const cancelMyCharterBooking = async (id, cancelPayload) => {
    try {
        return await apiCancelCharterBooking(id, cancelPayload);
    } catch (error) {
        console.error(`Lỗi khi hủy charter booking ${id}:`, error);
        throw error;
    }
};

export const updateMyCharterBookingPassengers = async (id, passengersPayload) => {
    try {
        return await apiUpdateCharterBookingPassengers(id, passengersPayload);
    } catch (error) {
        console.error(`Lỗi khi cập nhật hành khách charter booking ${id}:`, error);
        throw error;
    }
};

export const importMyCharterBookingPassengers = (id, file) =>
    apiImportCharterBookingPassengers(id, file);

export const fetchCharterBookingManifestByCode = (bookingCode) =>
    apiGetCharterBookingManifestByCode(bookingCode);

export const fetchCharterBookingManifestByQrToken = (qrToken) =>
    apiGetCharterBookingManifestByQrToken(qrToken);

export const fetchCharterBookingQrImage = (qrToken) =>
    apiGetCharterBookingQrImage(qrToken);

export const updateCharterAttendance = (qrToken, attendancePayload) =>
    apiUpdateCharterBookingAttendance(qrToken, attendancePayload);

export const downloadAllCharterBookingTickets = (id) =>
    apiExportAllCharterBookingTickets(id);

export const downloadSelectedCharterBookingTickets = (id, ticketIds) =>
    apiExportSelectedCharterBookingTickets(id, { ticketIds });

export const printSelectedCharterBookingTickets = (id, ticketIds) =>
    apiPrintCharterBookingTickets(id, { ticketIds });

export const downloadCharterBookingTicketsPdf = (id, ticketIds) =>
    apiExportCharterBookingTicketsPdf(id, { ticketIds });

export const downloadCharterBookingTicketsPdfByQrToken = (qrToken) =>
    apiExportCharterBookingTicketsPdfByQrToken(qrToken);

export const fetchAdminCharterBookings = async () => {
    try {
        return await apiGetAdminCharterBookings();
    } catch (error) {
        console.error('Lỗi khi lấy danh sách charter booking:', error);
        throw error;
    }
};

export const fetchAdminCharterBookingDetail = async (id) => {
    try {
        return await apiGetAdminCharterBookingById(id);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết charter booking ${id}:`, error);
        throw error;
    }
};

export const modifyAdminCharterBookingStatus = async (id, bookingStatusOrPayload) => {
    const body = typeof bookingStatusOrPayload === "string"
        ? { bookingStatus: bookingStatusOrPayload }
        : {
            bookingStatus: bookingStatusOrPayload?.bookingStatus,
            ...(bookingStatusOrPayload?.note != null && String(bookingStatusOrPayload.note).trim()
                ? { note: String(bookingStatusOrPayload.note).trim() }
                : {}),
        };
    try {
        return await apiUpdateAdminCharterBookingStatus(id, body);
    } catch (error) {
        console.error(`Lỗi khi cập nhật trạng thái charter booking ${id}:`, error);
        throw error;
    }
};

export const submitAdminCharterBookingQuote = async (id, quotePayload) => {
    try {
        return await apiQuoteAdminCharterBooking(id, quotePayload);
    } catch (error) {
        console.error(`Lỗi khi chốt giá charter booking ${id}:`, error);
        throw error;
    }
};

export const fetchAdminCharterBookingRouteCandidates = async (id) => {
    try {
        return await apiGetAdminCharterBookingRouteCandidates(id);
    } catch (error) {
        console.error(`Lỗi khi lấy route candidates charter booking ${id}:`, error);
        throw error;
    }
};

export const previewAdminCharterBookingQuote = async (id, quotePayload) => {
    try {
        return await apiPreviewAdminCharterBookingQuote(id, quotePayload);
    } catch (error) {
        console.error(`Lỗi khi preview giá charter booking ${id}:`, error);
        throw error;
    }
};

export const assignAdminCharterBookingManager = async (id, managerPayload) => {
    const managerUserId = managerPayload?.managerUserId ?? managerPayload?.managerId ?? null;
    try {
        return await apiAssignAdminCharterBookingManager(id, { managerUserId });
    } catch (error) {
        console.error(`Lỗi khi gán manager charter booking ${id}:`, error);
        throw error;
    }
};

export const fetchAssignedCharterBookings = async () => {
    try {
        return await apiGetAssignedCharterBookings();
    } catch (error) {
        console.error('Lỗi khi lấy danh sách charter booking được gán:', error);
        throw error;
    }
};

export const fetchAssignedCharterBookingDetail = async (id) => {
    try {
        return await apiGetAssignedCharterBookingById(id);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết charter booking được gán ${id}:`, error);
        throw error;
    }
};

export const respondToCharterBookingQuote = async (id, payload) => {
    try {
        const body = {
            action: payload.action,
        };
        if (payload.note) body.note = payload.note;
        return await apiRespondToCharterBookingQuote(id, body);
    } catch (error) {
        console.error(`Lỗi khi phản hồi báo giá charter booking ${id}:`, error);
        throw error;
    }
};

/** Customer: POST append danh sách hành khách mới. */
export const addMyCharterBookingPassengers = async (id, passengersPayload) => {
    try {
        return await apiAddCharterBookingPassengers(id, passengersPayload);
    } catch (error) {
        console.error(`Lỗi khi thêm hành khách charter booking ${id}:`, error);
        throw error;
    }
};

export const approveCharterPassengerAddRequest = async (id, requestBatchId, { note = null } = {}) => {
    try {
        return await apiApprovePassengerAddRequest(id, requestBatchId, { note });
    } catch (error) {
        console.error(`Lỗi duyệt thêm HK ${requestBatchId}:`, error);
        throw error;
    }
};

export const rejectCharterPassengerAddRequest = async (id, requestBatchId, note, _options = {}) => {
    try {
        return await apiRejectPassengerAddRequest(id, requestBatchId, { note });
    } catch (error) {
        console.error(`Lỗi từ chối thêm HK ${requestBatchId}:`, error);
        throw error;
    }
};
