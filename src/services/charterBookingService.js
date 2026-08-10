import {
    cancelCharterBooking as apiCancelCharterBooking,
    createCharterBooking as apiCreateCharterBooking,
    updateCharterBooking as apiUpdateCharterBooking,
    getCharterBookingById as apiGetCharterBookingById,
    getCharterBookings as apiGetCharterBookings,
    getAdminCharterBookings as apiGetAdminCharterBookings,
    getAdminCharterBookingById as apiGetAdminCharterBookingById,
    getAdminRentalPricePolicies as apiGetAdminRentalPricePolicies,
    putAdminRentalPricePolicy as apiPutAdminRentalPricePolicy,
    updateAdminCharterBookingStatus as apiUpdateAdminCharterBookingStatus,
    updateCharterBookingPassengers as apiUpdateCharterBookingPassengers,
    addCharterBookingPassengers as apiAddCharterBookingPassengers,
    approvePassengerAddRequest as apiApprovePassengerAddRequest,
    rejectPassengerAddRequest as apiRejectPassengerAddRequest,
    getAdminCharterBookingRouteCandidates as apiGetAdminCharterBookingRouteCandidates,
    previewAdminCharterBookingQuote as apiPreviewAdminCharterBookingQuote,
    quoteAdminCharterBooking as apiQuoteAdminCharterBooking,
    createAdminCharterBookingTrip as apiCreateAdminCharterBookingTrip,
    requestAdminCharterRouteDraw as apiRequestAdminCharterRouteDraw,
    getAdminRouteDrawRequests as apiGetAdminRouteDrawRequests,
    getAdminRouteDrawRequestById as apiGetAdminRouteDrawRequestById,
    markAdminRouteDrawRequestInProgress as apiMarkAdminRouteDrawRequestInProgress,
    completeAdminRouteDrawRequest as apiCompleteAdminRouteDrawRequest,
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
    exportCharterBookingTicketsPdf as apiExportCharterBookingTicketsPdf,
    exportCharterBookingTicketsPdfByQrToken as apiExportCharterBookingTicketsPdfByQrToken,
} from '../api/charterBookingApi';
import {
    CHARTER_BOAT_HOLDING_STATUSES,
    collectOccupiedBoatIdsForSchedule,
    extractCharterBookingList,
    getAssignedBoatIdsFromBooking,
    normalizeBooking,
    normalizeCharterScheduleDate,
} from '../utils/charterBookingAdmin';

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
        const response = await apiQuoteAdminCharterBooking(id, quotePayload);
        invalidateOccupiedBoatsCache();
        return response;
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

export const createAdminCharterBookingTrip = async (id) => {
    try {
        return await apiCreateAdminCharterBookingTrip(id);
    } catch (error) {
        console.error(`Lỗi khi tạo trip charter booking ${id}:`, error);
        throw error;
    }
};

export const requestCharterRouteDraw = async (bookingId, payload = {}) => {
    try {
        return await apiRequestAdminCharterRouteDraw(bookingId, {
            notes: payload.notes ?? "Cần GPS vẽ tuyến cho booking này",
        });
    } catch (error) {
        console.error(`Lỗi khi gửi yêu cầu GPS vẽ tuyến booking ${bookingId}:`, error);
        throw error;
    }
};

export const fetchRouteDrawRequests = async (params = {}) => {
    try {
        return await apiGetAdminRouteDrawRequests(params);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách yêu cầu vẽ tuyến:', error);
        throw error;
    }
};

export const fetchRouteDrawRequestDetail = async (requestId) => {
    try {
        return await apiGetAdminRouteDrawRequestById(requestId);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết yêu cầu vẽ tuyến ${requestId}:`, error);
        throw error;
    }
};

export const markRouteDrawRequestInProgress = async (requestId) => {
    try {
        return await apiMarkAdminRouteDrawRequestInProgress(requestId);
    } catch (error) {
        console.error(`Lỗi khi chuyển yêu cầu vẽ tuyến ${requestId} sang InProgress:`, error);
        throw error;
    }
};

export const completeRouteDrawRequest = async (requestId, routeId) => {
    try {
        return await apiCompleteAdminRouteDrawRequest(requestId, { routeId });
    } catch (error) {
        console.error(`Lỗi khi hoàn tất yêu cầu vẽ tuyến ${requestId}:`, error);
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

/**
 * Soft-filter cho dropdown chốt giá: lấy boatId đang bị giữ cùng ngày.
 * Cache 2 phút + chỉ hydrate detail các booking cùng ngày thiếu selectedBoats
 * (không dùng cho gate tạo trip — trùng giờ do BE validate).
 */
const OCCUPIED_BOATS_TTL_MS = 2 * 60 * 1000;
const occupiedBoatsCache = new Map(); // cacheKey -> { at, ids }
const occupiedBoatsInflight = new Map();

export const invalidateOccupiedBoatsCache = () => {
    occupiedBoatsCache.clear();
    occupiedBoatsInflight.clear();
};

export const fetchOccupiedBoatIdsForCharterDate = async ({
    currentBookingId,
    departureDate,
    useAssignedApi = false,
    force = false,
} = {}) => {
    const dateKey = normalizeCharterScheduleDate(departureDate);
    if (!dateKey) return [];

    const scope = useAssignedApi ? "assigned" : "admin";
    const cacheKey = `${scope}|${dateKey}|${String(currentBookingId || "")}`;
    const cached = occupiedBoatsCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.at < OCCUPIED_BOATS_TTL_MS) {
        return cached.ids;
    }
    if (!force && occupiedBoatsInflight.has(cacheKey)) {
        return occupiedBoatsInflight.get(cacheKey);
    }

    const promise = (async () => {
        const listPayload = useAssignedApi
            ? await fetchAssignedCharterBookings()
            : await fetchAdminCharterBookings();
        const otherBookings = extractCharterBookingList(listPayload).map(normalizeBooking);

        const sameDayHoldings = otherBookings.filter((other) => (
            String(other.id) !== String(currentBookingId || "")
            && CHARTER_BOAT_HOLDING_STATUSES.has(String(other.status || ""))
            && normalizeCharterScheduleDate(other.departureDate) === dateKey
        ));

        const needsDetail = sameDayHoldings.filter(
            (other) => getAssignedBoatIdsFromBooking(other).length === 0,
        );
        const hydratedById = new Map();
        if (needsDetail.length > 0) {
            const fetchDetail = useAssignedApi
                ? fetchAssignedCharterBookingDetail
                : fetchAdminCharterBookingDetail;
            const details = await Promise.all(
                needsDetail.map(async (other) => {
                    try {
                        return normalizeBooking(await fetchDetail(other.id));
                    } catch (error) {
                        console.error(`Không tải detail để ẩn tàu trùng lịch ${other.id}:`, error);
                        return null;
                    }
                }),
            );
            details.filter(Boolean).forEach((detail) => {
                hydratedById.set(String(detail.id), detail);
            });
        }

        const bookingsForConflict = otherBookings.map((other) => (
            hydratedById.get(String(other.id)) || other
        ));

        const ids = collectOccupiedBoatIdsForSchedule({
            currentBookingId,
            departureDate,
            otherBookings: bookingsForConflict,
            matchMode: "day",
        });
        occupiedBoatsCache.set(cacheKey, { at: Date.now(), ids });
        return ids;
    })();

    occupiedBoatsInflight.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        occupiedBoatsInflight.delete(cacheKey);
    }
};

export const RENTAL_PRICE_UNITS = {
    HOUR: 'Hour',
    DAY: 'Day',
};

/** Bộ policy mặc định khi BE chưa seed / GET lỗi — admin vẫn PUT upsert được. */
export const DEFAULT_RENTAL_PRICE_POLICIES = [
    { numberOfDecks: 1, rentalUnit: RENTAL_PRICE_UNITS.HOUR, unitPrice: 0 },
    { numberOfDecks: 1, rentalUnit: RENTAL_PRICE_UNITS.DAY, unitPrice: 0 },
    { numberOfDecks: 2, rentalUnit: RENTAL_PRICE_UNITS.HOUR, unitPrice: 0 },
    { numberOfDecks: 2, rentalUnit: RENTAL_PRICE_UNITS.DAY, unitPrice: 0 },
].map((row) => ({
    ...row,
    charterBoatRentalPricePolicyId: `${row.numberOfDecks}-${row.rentalUnit}`,
    currency: 'VND',
    isActive: true,
}));

const unwrapPolicyList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.policies)) return data.policies;
    if (Array.isArray(data?.result)) return data.result;
    if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
        return unwrapPolicyList(data.data);
    }
    return [];
};

export const normalizeRentalPricePolicy = (item) => {
    if (!item) return null;
    const numberOfDecks = Number(item.numberOfDecks ?? item.NumberOfDecks) || 0;
    const rentalUnit = String(item.rentalUnit || item.RentalUnit || RENTAL_PRICE_UNITS.HOUR);
    return {
        charterBoatRentalPricePolicyId: String(
            item.charterBoatRentalPricePolicyId
            || item.CharterBoatRentalPricePolicyId
            || item.id
            || `${numberOfDecks}-${rentalUnit}`,
        ),
        numberOfDecks,
        rentalUnit,
        unitPrice: Number(item.unitPrice ?? item.UnitPrice) || 0,
        currency: item.currency || item.Currency || 'VND',
        isActive: item.isActive !== false && item.IsActive !== false,
        raw: item,
    };
};

const mergeWithDefaultPolicies = (list) => {
    const byKey = new Map();
    DEFAULT_RENTAL_PRICE_POLICIES.forEach((row) => {
        byKey.set(`${row.numberOfDecks}-${row.rentalUnit}`, { ...row });
    });
    list.forEach((row) => {
        if (!row) return;
        byKey.set(`${row.numberOfDecks}-${row.rentalUnit}`, row);
    });
    return Array.from(byKey.values()).sort((a, b) => (
        a.numberOfDecks - b.numberOfDecks
        || String(a.rentalUnit).localeCompare(String(b.rentalUnit))
    ));
};

export const fetchAdminRentalPricePolicies = async () => {
    try {
        const data = await apiGetAdminRentalPricePolicies();
        const list = unwrapPolicyList(data).map(normalizeRentalPricePolicy).filter(Boolean);
        return { policies: mergeWithDefaultPolicies(list), fromFallback: false };
    } catch (error) {
        // Azure đôi khi 500 trên GET dù PUT upsert vẫn chạy — seed form mặc định.
        console.warn('Không tải được rental-price-policies, dùng bộ mặc định:', error);
        return {
            policies: DEFAULT_RENTAL_PRICE_POLICIES.map((row) => ({ ...row })),
            fromFallback: true,
            error,
        };
    }
};

export const saveAdminRentalPricePolicy = async (form) => {
    const payload = {
        numberOfDecks: Number(form.numberOfDecks) || 0,
        rentalUnit: String(form.rentalUnit || RENTAL_PRICE_UNITS.HOUR),
        unitPrice: Number(form.unitPrice) || 0,
        currency: form.currency || 'VND',
    };
    const data = await apiPutAdminRentalPricePolicy(payload);
    const src = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
    return normalizeRentalPricePolicy(src) || {
        ...payload,
        charterBoatRentalPricePolicyId:
            form.charterBoatRentalPricePolicyId || `${payload.numberOfDecks}-${payload.rentalUnit}`,
    };
};
