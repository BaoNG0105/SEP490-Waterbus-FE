import {
    getTrips as apiGetTrips,
    createTrip as apiCreateTrip,
    searchTrips as apiSearchTrips,
    searchSightseeingTrips as apiSearchSightseeingTrips,
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
    Completed: { vn: 'Hoàn thành', en: 'Completed' },
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

/** Chuyến còn gắn được khi báo sự cố (chưa Completed/Cancelled). */
export const isTripAttachableStatus = (status) => {
  const key = normalizeTripStatusKey(status);
  return key === 'Scheduled'
    || key === 'Boarding'
    || key === 'InProgress'
    || key === 'Delayed';
};

const tripStatusRank = (status) => {
  const key = normalizeTripStatusKey(status);
  if (key === 'InProgress') return 0;
  if (key === 'Boarding') return 1;
  if (key === 'Delayed') return 2;
  if (key === 'Scheduled') return 3;
  return 9;
};

/** Ưu tiên list ops: đang lên tàu → đang chạy → trễ → sắp chạy → còn lại. */
const tripListStatusRank = (status) => {
  const key = normalizeTripStatusKey(status);
  if (key === 'Boarding') return 0;
  if (key === 'InProgress') return 1;
  if (key === 'Delayed') return 2;
  if (key === 'Scheduled') return 3;
  if (key === 'Completed') return 8;
  if (key === 'Cancelled') return 9;
  return 7;
};

const tripDepartureMs = (trip) => {
  const raw = trip?.departureTime
    || trip?.scheduledDepartureAt
    || trip?.DepartureTime
    || trip?.operatingDate;
  const ms = Date.parse(String(raw || ''));
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
};

/** Sắp xếp list quản lý chuyến: chuẩn bị/đang chạy lên đầu, Scheduled gần giờ trước. */
export const sortTripsForOpsList = (trips = []) => {
  const list = unwrapTripList(trips);
  const now = Date.now();
  return [...list].sort((a, b) => {
    const ra = tripListStatusRank(a?.tripStatus ?? a?.status);
    const rb = tripListStatusRank(b?.tripStatus ?? b?.status);
    if (ra !== rb) return ra - rb;

    const da = tripDepartureMs(a);
    const db = tripDepartureMs(b);
    // Scheduled: gần giờ chạy nhất lên trước (sắp tới trước, quá giờ sau cùng trong nhóm).
    if (ra === 3) {
      const aUpcoming = da >= now ? 0 : 1;
      const bUpcoming = db >= now ? 0 : 1;
      if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
      if (aUpcoming === 0) return da - db;
      return db - da;
    }
    return da - db;
  });
};

const unwrapTripList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.trips)) return data.trips;
  return [];
};

/** Lọc chuyến đang gắn được với 1 tàu (theo boatId / boatCode). */
export const filterAttachableTripsForBoat = (trips, boatLike = {}) => {
  const boatId = String(boatLike?.boatId || boatLike?.id || '').trim();
  const boatCode = String(boatLike?.boatCode || boatLike?.code || '').trim().toLowerCase();
  if (!boatId && !boatCode) return [];

  return unwrapTripList(trips).filter((trip) => {
    const status = trip?.tripStatus ?? trip?.status ?? trip?.TripStatus;
    if (!isTripAttachableStatus(status)) return false;

    const tripBoatId = String(trip?.boatId || trip?.boat?.boatId || trip?.BoatId || '').trim();
    const tripBoatCode = String(
      trip?.boatCode || trip?.boat?.boatCode || trip?.BoatCode || '',
    ).trim().toLowerCase();

    if (boatId && tripBoatId && tripBoatId === boatId) return true;
    if (boatCode && tripBoatCode && tripBoatCode === boatCode) return true;
    return false;
  });
};

/**
 * Chọn 1 chuyến tốt nhất để gắn sự cố:
 * InProgress → Boarding → Delayed → Scheduled (gần giờ chạy nhất).
 */
export const pickActiveTripForBoat = (trips, boatLike = {}) => {
  const list = filterAttachableTripsForBoat(trips, boatLike);
  if (!list.length) return null;

  const sorted = [...list].sort((a, b) => {
    const ra = tripStatusRank(a?.tripStatus ?? a?.status);
    const rb = tripStatusRank(b?.tripStatus ?? b?.status);
    if (ra !== rb) return ra - rb;
    return tripDepartureMs(a) - tripDepartureMs(b);
  });

  const best = sorted[0];
  const tripId = best?.tripId || best?.id || best?.TripId || null;
  if (!tripId) return null;
  return {
    tripId: String(tripId),
    tripCode: String(best?.tripCode || best?.TripCode || tripId),
    tripStatus: best?.tripStatus ?? best?.status ?? null,
    raw: best,
  };
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
    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(datetimeLocalValue)) return datetimeLocalValue;
    const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(datetimeLocalValue)
        ? `${datetimeLocalValue}:00`
        : datetimeLocalValue;
    return `${withSeconds}+07:00`;
};

/** Ghép ngày vận hành (YYYY-MM-DD) + giờ (HH:mm) → ISO +07:00 — khớp payload BE. */
export const combineOperatingDateAndTime = (operatingDate, timeHHmm) => {
    const date = String(operatingDate || '').trim();
    const timeRaw = String(timeHHmm || '').trim();
    if (!date || !timeRaw) return null;
    // Hỗ trợ cả time "HH:mm" lẫn nhầm datetime-local "YYYY-MM-DDTHH:mm"
    if (timeRaw.includes('T')) return toIsoWithOffset(timeRaw);
    const time = /^\d{2}:\d{2}$/.test(timeRaw) ? `${timeRaw}:00` : timeRaw;
    return `${date}T${time}+07:00`;
};

// Service: Tải danh sách chuyến tàu theo bộ lọc (operatingDate/routeCode/status/tripType/routeType — optional)
export const fetchAllTrips = async (params = {}) => {
    try {
        const data = await apiGetTrips(params);
        return unwrapTripList(data);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách chuyến tàu từ Service:', error);
        throw error;
    }
};

// Chuẩn hoá form tạo chuyến tàu thành payload gửi BE
export const buildTripPayload = (form) => {
    const stops = (Array.isArray(form.stops) ? form.stops : [])
        .map((stop) => ({
            stopOrder: Number(stop.stopOrder),
            stayDurationMinutes: Math.max(0, Number(stop.stayDurationMinutes) || 0),
        }))
        .filter((stop) => Number.isFinite(stop.stopOrder) && stop.stopOrder > 0);

    return {
        routeCode: String(form.routeCode || '').trim(),
        boatCode: String(form.boatCode || '').trim(),
        operatingDate: toDdMmYyyy(form.operatingDate),
        departureTime: combineOperatingDateAndTime(form.operatingDate, form.departureTime),
        ...(stops.length > 0 ? { stops } : {}),
    };
};

/** BE CreateTrip: departureTime phải cách hiện tại ≥ 20 phút (swagger), theo giờ VN +07. */
export const MIN_TRIP_CREATE_LEAD_MINUTES = 20;

export const getTripCreateLeadTimeError = (operatingDate, departureTimeHHmm, lang = 'VN') => {
    if (!operatingDate || !departureTimeHHmm) {
        return lang === 'VN' ? 'Vui lòng chọn ngày và giờ khởi hành.' : 'Please choose operating date and departure time.';
    }
    const iso = combineOperatingDateAndTime(operatingDate, departureTimeHHmm);
    const ms = iso ? Date.parse(iso) : NaN;
    if (Number.isNaN(ms)) {
        return lang === 'VN' ? 'Giờ khởi hành không hợp lệ.' : 'Invalid departure time.';
    }
    const leadMs = MIN_TRIP_CREATE_LEAD_MINUTES * 60 * 1000;
    if (ms < Date.now() + leadMs) {
        return lang === 'VN'
            ? `Chuyến phải được tạo trước giờ khởi hành ít nhất ${MIN_TRIP_CREATE_LEAD_MINUTES} phút.`
            : `Trips must be created at least ${MIN_TRIP_CREATE_LEAD_MINUTES} minutes before departure.`;
    }
    return null;
};
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

// Service: Tìm chuyến tham quan ngắm cảnh (Water Sightseeing) theo ngày — tuyến vòng lặp (bến bắt đầu =
// bến kết thúc) nên chỉ cần operatingDate, không cần chọn bến đi/bến đến.
export const fetchSightseeingTripSearch = async ({ departureDate }) => {
    try {
        const data = await apiSearchSightseeingTrips({
            operatingDate: toDdMmYyyy(departureDate),
        });
        return data || [];
    } catch (error) {
        console.error('Lỗi khi tìm chuyến tham quan:', error);
        throw error;
    }
};

// Service: Lấy chi tiết 1 chuyến tàu (kèm các bến dừng trip_stops)
export const fetchTripDetail = async (tripId) => {
    try {
        const data = await apiGetTripById(tripId);
        // Một số response BE bọc { data: {...} }
        if (data?.data && typeof data.data === "object" && !Array.isArray(data.data) && (data.data.tripId || data.data.tripCode || data.data.stops)) {
            return data.data;
        }
        return data;
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
