import {
    getTrips as apiGetTrips,
    createTrip as apiCreateTrip,
    searchTrips as apiSearchTrips,
    getTripById as apiGetTripById,
    getTripSeats as apiGetTripSeats,
    holdTripSeats as apiHoldTripSeats,
    releaseTripSeats as apiReleaseTripSeats,
} from '../api/tripApi';

export const TRIP_STATUS_OPTIONS = [
  'Scheduled',
  'Boarding',
  'InProgress', // BE mới (legacy DB/API: Departed)
  'Departed', // legacy alias
  'Delayed',
  'Completed', // BE mới (legacy DB/API: Arrived)
  'Arrived', // legacy alias
  'Cancelled',
];
export const TRIP_TYPE_OPTIONS = ['Regular', 'Charter'];
export const ROUTE_TYPE_OPTIONS = ['Regular', 'SightseeingLoop', 'CharterReference'];
export const SEAT_TYPE_OPTIONS = ['STANDARD', 'CABIN', 'SKY', 'RIVER'];

/** Chuẩn hoá status BE mới + legacy về 1 key. */
export const normalizeTripStatusKey = (status) => {
  const raw = String(status || '').trim();
  const key = raw.toLowerCase().replace(/[_\s-]/g, '');
  if (key === 'inprogress' || key === 'departed') return 'InProgress';
  if (key === 'completed' || key === 'arrived') return 'Completed';
  if (key === 'scheduled') return 'Scheduled';
  if (key === 'boarding') return 'Boarding';
  if (key === 'delayed') return 'Delayed';
  if (key === 'cancelled' || key === 'canceled') return 'Cancelled';
  return raw || '';
};

/** Label badge FE theo contract BE. */
export const getTripStatusLabel = (status, lang = 'VN') => {
  const key = normalizeTripStatusKey(status);
  const map = {
    Scheduled: { vn: 'Đã lên lịch', en: 'Scheduled' },
    Boarding: { vn: 'Đang lên tàu', en: 'Boarding' },
    InProgress: { vn: 'Đang chạy', en: 'In progress' },
    Delayed: { vn: 'Trễ', en: 'Delayed' },
    Completed: { vn: 'Đã tới / Hoàn tất', en: 'Completed' },
    Cancelled: { vn: 'Đã hủy', en: 'Cancelled' },
  };
  const row = map[key];
  if (!row) return status || '—';
  return lang === 'VN' ? row.vn : row.en;
};

export const isTripRunningStatus = (status) => {
  const key = normalizeTripStatusKey(status);
  return key === 'Boarding' || key === 'InProgress' || key === 'Delayed';
};

// input[type=date] "YYYY-MM-DD" -> "dd/MM/yyyy" (định dạng operatingDate BE yêu cầu)
export const toDdMmYyyy = (yyyyMmDd) => {
    if (!yyyyMmDd) return null;
    const [y, m, d] = String(yyyyMmDd).split('-');
    if (!y || !m || !d) return null;
    return `${d}/${m}/${y}`;
};

// input[type=datetime-local] "YYYY-MM-DDTHH:mm" -> ISO kèm offset +07:00 (định dạng departureTime BE yêu cầu)
export const toIsoWithOffset = (datetimeLocalValue) => {
    if (!datetimeLocalValue) return null;
    return `${datetimeLocalValue}:00+07:00`;
};

// Service: Tải danh sách chuyến tàu theo bộ lọc (operatingDate/routeCode/status/tripType/routeType — optional)
export const fetchAllTrips = async (params = {}) => {
    try {
        const data = await apiGetTrips(params);
        return data || [];
    } catch (error) {
        console.error('Lỗi khi lấy danh sách chuyến tàu từ Service:', error);
        throw error;
    }
};

// Chuẩn hoá form tạo chuyến tàu thành payload gửi BE
export const buildTripPayload = (form) => ({
    routeCode: String(form.routeCode || '').trim(),
    boatCode: String(form.boatCode || '').trim(),
    operatingDate: toDdMmYyyy(form.operatingDate),
    departureTime: toIsoWithOffset(form.departureTime),
    seatTypePrices: (form.seatTypePrices || [])
        .filter((p) => p.seatTypeCode && p.price !== '' && p.price !== null && p.price !== undefined)
        .map((p) => ({ seatTypeCode: p.seatTypeCode, price: Number(p.price) })),
});

// Service: Tạo chuyến tàu mới
export const addNewTrip = async (payload) => {
    try {
        return await apiCreateTrip(payload);
    } catch (error) {
        console.error('Lỗi khi tạo chuyến tàu mới:', error);
        throw error;
    }
};

// Service: Tìm chuyến tàu bán vé (Waterbus) theo bến đi/bến đến/ngày khởi hành cho khách đặt vé
export const fetchTripSearch = async ({ fromStationId, toStationId, departureDate, routeType = 'Regular' }) => {
    try {
        const data = await apiSearchTrips({
            fromStationId,
            toStationId,
            operatingDate: toDdMmYyyy(departureDate),
            routeType,
        });
        return data || [];
    } catch (error) {
        console.error('Lỗi khi tìm chuyến tàu:', error);
        throw error;
    }
};

// Service: Lấy chi tiết 1 chuyến tàu (kèm các bến dừng trip_stops)
export const fetchTripDetail = async (tripId) => {
    try {
        return await apiGetTripById(tripId);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết chuyến tàu ${tripId}:`, error);
        throw error;
    }
};

// Service: Lấy sơ đồ ghế của 1 chuyến tàu. Truyền fromStationCode/toStationCode để xem đúng trạng thái
// ghế theo chặng khách sẽ đi (trip Regular bán ghế theo chặng); bỏ trống để xem trạng thái cả tuyến.
export const fetchTripSeatMap = async (tripId, { fromStationCode, toStationCode } = {}) => {
    try {
        return await apiGetTripSeats(tripId, { fromStationCode, toStationCode });
    } catch (error) {
        console.error(`Lỗi khi lấy sơ đồ ghế chuyến tàu ${tripId}:`, error);
        throw error;
    }
};

// Service: Tạm giữ ghế đang chọn cho chuyến (TTL 3 phút, tự gia hạn khi gọi lại)
// fromStationCode/toStationCode bắt buộc với trip Regular.
export const holdSeats = async (tripId, seatNumbers, fromStationCode, toStationCode) => {
    try {
        return await apiHoldTripSeats(tripId, seatNumbers, fromStationCode, toStationCode);
    } catch (error) {
        console.error(`Lỗi khi giữ ghế cho chuyến ${tripId}:`, error);
        throw error;
    }
};

// Service: Nhả ghế đang tạm giữ cho chuyến
export const releaseSeats = async (tripId, seatNumbers, fromStationCode, toStationCode) => {
    try {
        return await apiReleaseTripSeats(tripId, seatNumbers, fromStationCode, toStationCode);
    } catch (error) {
        console.error(`Lỗi khi nhả ghế cho chuyến ${tripId}:`, error);
        throw error;
    }
};
