import {
    getTrips as apiGetTrips,
    createTrip as apiCreateTrip,
    generateTrips as apiGenerateTrips,
    scheduleTrips as apiScheduleTrips,
    previewRoundTripSchedule as apiPreviewRoundTripSchedule,
    updateTripBoat as apiUpdateTripBoat,
    searchTrips as apiSearchTrips,
    searchSightseeingTrips as apiSearchSightseeingTrips,
    getTripById as apiGetTripById,
    getTripPassengers as apiGetTripPassengers,
    getTripSeats as apiGetTripSeats,
    holdTripSeats as apiHoldTripSeats,
    releaseTripSeats as apiReleaseTripSeats,
    startTripDelay as apiStartTripDelay,
    resumeTripDelay as apiResumeTripDelay,
} from '../api/tripApi';
import { normalizeTripStops } from '../utils/tripStopTimes';

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
  let list = [];
  if (Array.isArray(data)) list = data;
  else if (Array.isArray(data?.items)) list = data.items;
  else if (Array.isArray(data?.data)) list = data.data;
  else if (Array.isArray(data?.trips)) list = data.trips;
  return list.map(normalizeTripPayload).filter(Boolean);
};

/** Chuẩn hoá trip + stops[] (*At aliases, fromLocation/toLocation, serviceType). */
export const normalizeTripPayload = (trip) => {
  if (!trip || typeof trip !== "object") return trip;
  const stops = normalizeTripStops(trip.stops || trip.Stops || []);
  return {
    ...trip,
    stops,
    fromLocation: trip.fromLocation ?? trip.FromLocation ?? trip.fromStation ?? trip.fromStationName ?? null,
    toLocation: trip.toLocation ?? trip.ToLocation ?? trip.toStation ?? trip.toStationName ?? null,
    startAt: trip.startAt ?? trip.StartAt ?? trip.departureTime ?? trip.scheduledDepartureAt ?? null,
    endAt: trip.endAt ?? trip.EndAt ?? trip.arrivalTime ?? trip.scheduledArrivalAt ?? null,
    serviceType: trip.serviceType ?? trip.ServiceType ?? null,
    sellsBySegment: trip.sellsBySegment ?? trip.SellsBySegment ?? null,
    capacitySnapshot: trip.capacitySnapshot ?? trip.CapacitySnapshot ?? null,
    totalPassengerCount: trip.totalPassengerCount ?? trip.TotalPassengerCount ?? null,
  };
};

/** Lọc chuyến đang gắn được với 1 tàu (theo boatId / boatCode). */
export const filterAttachableTripsForBoat = (trips, boatLike = {}) => {
  const boatId = String(boatLike?.boatId || boatLike?.id || '').trim();
  const boatCode = String(boatLike?.boatCode || boatLike?.code || '').trim().toLowerCase();
  if (!boatId && !boatCode) return [];

  return unwrapTripList(trips).filter((trip) => {
    const status = trip?.tripStatus ?? trip?.status ?? trip?.TripStatus;
    if (!isTripAttachableStatus(status)) return false;

    const tripBoatId = String(
      trip?.boatId
      || trip?.boat?.vesselId
      || trip?.boat?.boatId
      || trip?.BoatId
      || '',
    ).trim();
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

/** Query GET: ưu tiên dd-MM-yyyy (Swagger chấp nhận; tránh `/` trong URL bị proxy/parse lệch). */
export const toOperatingDateQuery = (yyyyMmDd) => {
    const slash = toDdMmYyyy(yyyyMmDd);
    return slash ? slash.replaceAll('/', '-') : null;
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
        routeId: null,
        boatCode: String(form.boatCode || '').trim(),
        operatingDate: toDdMmYyyy(form.operatingDate),
        departureTime: combineOperatingDateAndTime(form.operatingDate, form.departureTime),
        ...(stops.length > 0 ? { stops } : {}),
    };
};

/** HH:mm hoặc HH:mm:ss → HH:mm:ss */
export const toHms = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
    if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
    return raw;
};

/**
 * fromDate === toDate và đúng 1 giờ cố định → BE tạo 1 chuyến qua /trips/schedule.
 * Còn lại → nhiều chuyến. Cùng payload + stops.
 */
export const isSingleTripCreateCase = (form) => {
    const from = String(form?.fromDate || form?.operatingDate || '').trim();
    const to = String(form?.toDate || form?.operatingDate || '').trim();
    if (!from || !to || from !== to) return false;
    if (form?.mode !== 'fixed') return false;
    const times = (Array.isArray(form?.departureTimes) ? form.departureTimes : [])
        .map((t) => String(t || '').trim())
        .filter(Boolean);
    if (times.length !== 1) return false;

    const days = Array.isArray(form?.daysOfWeek)
        ? form.daysOfWeek.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [];
    if (days.length === 0) return true;
    // YYYY-MM-DD → weekday JS (0=CN … 6=T7), khớp daysOfWeek BE
    const parts = from.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return days.length <= 1;
    const weekday = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    return days.length === 1 && days[0] === weekday;
};

/**
 * Payload POST /trips/schedule (1 hoặc nhiều chuyến).
 * mode=fixed → departureTimes[], start/end/interval=null
 * mode=interval → start/end/intervalMinutes, departureTimes=null
 * Không chọn daysOfWeek → null (BE tạo mọi ngày trong khoảng).
 * stops: chỉ bến giữa tuyến; stayDurationMinutes cho phép 0.
 */
export const buildScheduleTripsPayload = (form) => {
    const days = Array.isArray(form.daysOfWeek)
        ? form.daysOfWeek.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [];
    const stops = (Array.isArray(form.stops) ? form.stops : [])
        .map((stop) => ({
            stopOrder: Number(stop.stopOrder),
            stayDurationMinutes: Math.max(0, Number(stop.stayDurationMinutes) || 0),
        }))
        .filter((stop) => Number.isFinite(stop.stopOrder) && stop.stopOrder > 0);

    const base = {
        routeCode: String(form.routeCode || '').trim(),
        boatCode: String(form.boatCode || '').trim(),
        fromDate: String(form.fromDate || '').trim() || null,
        toDate: String(form.toDate || '').trim() || null,
        daysOfWeek: days.length > 0 ? days : null,
        stops,
    };
    if (form.mode === 'fixed') {
        const times = (Array.isArray(form.departureTimes) ? form.departureTimes : [])
            .map(toHms)
            .filter(Boolean);
        return {
            ...base,
            departureTimes: times,
            startTime: null,
            endTime: null,
            intervalMinutes: null,
        };
    }
    return {
        ...base,
        departureTimes: null,
        startTime: toHms(form.startTime),
        endTime: toHms(form.endTime),
        intervalMinutes: Math.max(1, Number(form.intervalMinutes) || 30),
    };
};

/** @deprecated Dùng buildScheduleTripsPayload */
export const buildGenerateTripsPayload = buildScheduleTripsPayload;

/** ISO / HH:mm(:ss) → HH:mm:ss theo giờ VN (+07). Không làm tròn xuống / đoán giờ. */
const isoToHms = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return toHms(raw);
    // Chỉ tin wall-clock trong chuỗi khi BE đã gắn +07:00.
    const matched = raw.match(/T(\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2}|Z)?/);
    if (matched && matched[2] === '+07:00') return matched[1];
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return matched ? matched[1] : null;
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
    if (!parts.hour || !parts.minute) return matched ? matched[1] : null;
    let hour = parts.hour;
    if (hour === '24') hour = '00';
    return `${hour}:${parts.minute}:${parts.second || '00'}`;
};

const toYmd = (value) => {
    if (value == null || value === '') return '';
    // Date object from JSON rarely; handle just in case
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        return fmt.format(value);
    }

    const raw = String(value).trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
            const fmt = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Ho_Chi_Minh',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
            return fmt.format(d);
        }
        return raw.slice(0, 10);
    }
    // BE hay dùng dd/MM/yyyy hoặc dd-MM-yyyy
    const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (dmy) {
        const day = dmy[1].padStart(2, '0');
        const month = dmy[2].padStart(2, '0');
        const year = dmy[3];
        return `${year}-${month}-${day}`;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return fmt.format(d);
};

/** Lấy ngày vận hành từ item preview (fallback departureTime nếu BE không gửi operatingDate). */
const pickPreviewOperatingDate = (item) => {
    const candidates = [
        item?.operatingDate,
        item?.OperatingDate,
        item?.date,
        item?.Date,
        item?.departureTime,
        item?.DepartureTime,
        item?.requestedDepartureTime,
    ];
    for (const candidate of candidates) {
        const ymd = toYmd(candidate);
        if (ymd) return ymd;
    }
    return '';
};

/** HH:mm từ ISO / HH:mm:ss — dùng hiển thị skippedItems. */
export const formatTripClock = (value) => {
    const hms = isoToHms(value);
    return hms ? hms.slice(0, 5) : '';
};

export const normalizeSkippedScheduleItems = (rawItems) => {
    if (!Array.isArray(rawItems)) return [];
    return rawItems.map((item, index) => {
        const requestedDepartureTime = item?.requestedDepartureTime || null;
        const earliestAllowedDepartureTime = item?.earliestAllowedDepartureTime || null;
        const operatingDate = toYmd(item?.operatingDate) || String(item?.operatingDate || '').slice(0, 10);
        const routeCode = String(item?.routeCode || '').trim();
        return {
            key: [operatingDate, routeCode, requestedDepartureTime || index].join('|'),
            operatingDate,
            routeCode,
            requestedDepartureTime,
            requestedArrivalTime: item?.requestedArrivalTime || null,
            requestedDepartureLabel: formatTripClock(requestedDepartureTime),
            earliestAllowedDepartureTime,
            earliestAllowedDepartureLabel: formatTripClock(earliestAllowedDepartureTime),
            reason: item?.reason ? String(item.reason) : null,
            conflictTripCode: item?.conflictTripCode ? String(item.conflictTripCode) : null,
            conflictDepartureTime: item?.conflictDepartureTime || null,
            conflictArrivalTime: item?.conflictArrivalTime || null,
            conflictDepartureLabel: formatTripClock(item?.conflictDepartureTime),
            conflictArrivalLabel: formatTripClock(item?.conflictArrivalTime),
        };
    });
};

export const normalizeScheduleTripsResult = (raw) => {
    const src = raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw;
    const codes = src?.createdTripCodes || src?.CreatedTripCodes || src?.tripCodes || [];
    const skippedItems = normalizeSkippedScheduleItems(
        src?.skippedItems ?? src?.SkippedItems ?? [],
    );
    const skippedBoatBusy = Number(src?.skippedBoatBusy ?? src?.SkippedBoatBusy) || 0;
    const skippedStationBusy = Number(src?.skippedStationBusy ?? src?.SkippedStationBusy) || 0;
    const skippedPast = Number(src?.skippedPast ?? src?.SkippedPast) || 0;
    const skippedMissingOnBoardStaff = Number(
        src?.skippedMissingOnBoardStaff ?? src?.SkippedMissingOnBoardStaff,
    ) || 0;
    const skippedBreakdown = skippedBoatBusy + skippedStationBusy + skippedPast + skippedMissingOnBoardStaff;
    const skippedRaw = Number(src?.skipped ?? src?.Skipped);
    // BE đôi khi trả skipped=0 dù chi tiết bỏ qua > 0 — lấy max với tổng breakdown / skippedItems.
    const skipped = Math.max(
        Number.isFinite(skippedRaw) ? skippedRaw : 0,
        skippedBreakdown,
        skippedItems.length,
    );
    return {
        created: Number(src?.created ?? src?.Created) || 0,
        skipped,
        skippedBoatBusy,
        skippedStationBusy,
        skippedPast,
        skippedMissingOnBoardStaff,
        skippedItems,
        createdTripCodes: Array.isArray(codes) ? codes.map(String) : [],
        raw: src,
    };
};

/** @deprecated Dùng normalizeScheduleTripsResult */
export const normalizeGenerateTripsResult = normalizeScheduleTripsResult;

export const scheduleTripsBatch = async (payload) => {
    try {
        return normalizeScheduleTripsResult(await apiScheduleTrips(payload));
    } catch (error) {
        console.error('Lỗi khi schedule trips:', error);
        throw error;
    }
};

const mapScheduleStops = (stops) => (Array.isArray(stops) ? stops : [])
    .map((stop) => ({
        stopOrder: Number(stop.stopOrder),
        stayDurationMinutes: Math.max(0, Number(stop.stayDurationMinutes) || 0),
    }))
    .filter((stop) => Number.isFinite(stop.stopOrder) && stop.stopOrder > 0);

/** Payload POST /trips/schedule/round-trip-preview */
export const buildRoundTripPreviewPayload = (form) => {
    const days = Array.isArray(form.daysOfWeek)
        ? form.daysOfWeek.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [];
    return {
        boatCode: String(form.boatCode || '').trim(),
        outboundRouteCode: String(form.outboundRouteCode || '').trim(),
        inboundRouteCode: String(form.inboundRouteCode || '').trim(),
        fromDate: String(form.fromDate || '').trim() || null,
        toDate: String(form.toDate || '').trim() || null,
        startTime: toHms(form.startTime),
        endTime: toHms(form.endTime),
        daysOfWeek: days.length > 0 ? days : null,
        outboundStops: mapScheduleStops(form.outboundStops),
        inboundStops: mapScheduleStops(form.inboundStops),
    };
};

export const normalizeRoundTripPreviewResult = (raw) => {
    const src = raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw;
    const items = Array.isArray(src?.items) ? src.items : [];
    const nowMs = Date.now();
    const leadMs = MIN_TRIP_CREATE_LEAD_MINUTES * 60 * 1000;

    const mapped = items.map((item, index) => {
        const operatingDate = pickPreviewOperatingDate(item);
        const departureTime = item?.departureTime || item?.DepartureTime || null;
        const departureHms = isoToHms(departureTime);
        const routeCode = String(item?.routeCode || '').trim();
        const direction = String(item?.direction || '').trim();
        const canCreate = item?.canCreate !== false;
        const key = [
            operatingDate,
            routeCode,
            direction,
            departureTime || departureHms || index,
        ].join('|');

        let departureMs = Date.parse(String(departureTime || ''));
        if (Number.isNaN(departureMs) && operatingDate && departureHms) {
            const iso = combineOperatingDateAndTime(operatingDate, departureHms.slice(0, 5));
            departureMs = iso ? Date.parse(iso) : NaN;
        }

        return {
            key,
            operatingDate,
            direction,
            routeId: item?.routeId || null,
            routeCode,
            routeName: item?.routeName || routeCode || '—',
            departureTime,
            arrivalTime: item?.arrivalTime || null,
            departureHms,
            arrivalHms: isoToHms(item?.arrivalTime),
            departureMs: Number.isNaN(departureMs) ? null : departureMs,
            fromStationId: item?.fromStationId || null,
            toStationId: item?.toStationId || null,
            fromStationName: item?.fromStationName || '—',
            toStationName: item?.toStationName || '—',
            canCreate,
            reason: item?.reason || null,
            suggestedNextDepartureTime: item?.suggestedNextDepartureTime || null,
            suggestedNextDepartureLabel: formatTripClock(item?.suggestedNextDepartureTime),
            raw: item,
        };
    }).filter((item) => {
        // Không đưa khung đã quá giờ / sát giờ tạo (< lead time) vào danh sách gợi ý.
        if (item.departureMs == null) return true;
        return item.departureMs >= nowMs + leadMs;
    });

    return {
        suggested: mapped.length,
        skippedBoatBusy: Number(src?.skippedBoatBusy) || 0,
        skippedDuplicateRouteTime: Number(src?.skippedDuplicateRouteTime) || 0,
        skippedMissingOnBoardStaff: Number(src?.skippedMissingOnBoardStaff) || 0,
        items: mapped,
        raw: src,
    };
};

/** So sánh HH:mm / HH:mm:ss → phút trong ngày. */
const timeToMinutes = (value) => {
    const hms = isoToHms(value) || String(value || '').trim();
    const match = String(hms).match(/^(\d{2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
};

/**
 * Chỉ giữ khung nằm trong [startTime, endTime] admin setup.
 * Item không tạo được mà "sớm nhất" vượt endTime cũng bị loại.
 */
export const filterRoundTripPreviewByTimeWindow = (preview, startTime, endTime) => {
    if (!preview || typeof preview !== 'object') return preview;
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (startMin == null || endMin == null || startMin > endMin) {
        return preview;
    }

    const items = (Array.isArray(preview.items) ? preview.items : []).filter((item) => {
        const depMin = timeToMinutes(item?.departureHms || item?.departureTime);
        if (depMin == null) return true;
        if (depMin < startMin || depMin > endMin) return false;

        if (item?.canCreate === false) {
            const nextMin = timeToMinutes(
                item?.suggestedNextDepartureLabel
                || item?.suggestedNextDepartureTime,
            );
            // Gợi ý sớm nhất đã vượt khung setup → không hiện dòng này.
            if (nextMin != null && nextMin > endMin) return false;
        }
        return true;
    });

    return {
        ...preview,
        suggested: items.length,
        items,
    };
};

export const previewRoundTripScheduleBatch = async (payload) => {
    try {
        return normalizeRoundTripPreviewResult(await apiPreviewRoundTripSchedule(payload));
    } catch (error) {
        console.error('Lỗi khi preview round-trip schedule:', error);
        throw error;
    }
};

/**
 * Mỗi khung preview → 1 payload schedule (1 ngày + 1 giờ).
 * Gọi theo thứ tự thời gian để xen đi/về đúng lịch tàu (tránh tạo hết outbound trước).
 */
export const buildSchedulePayloadsFromRoundTripSelection = ({
    boatCode,
    outboundRouteCode,
    inboundRouteCode,
    outboundStops,
    inboundStops,
    selectedItems = [],
}) => {
    const boat = String(boatCode || '').trim();
    const outCode = String(outboundRouteCode || '').trim();
    const inCode = String(inboundRouteCode || '').trim();

    const rows = selectedItems
        .filter((item) => item && item.canCreate !== false)
        .map((item, index) => {
            const routeCode = String(item.routeCode || '').trim();
            const operatingDate = toYmd(item.operatingDate) || pickPreviewOperatingDate(item);
            const time = item.departureHms || isoToHms(item.departureTime);
            let sortMs = Number(item.departureMs);
            if (!Number.isFinite(sortMs)) {
                sortMs = Date.parse(String(item.departureTime || ''));
            }
            if (!Number.isFinite(sortMs) && operatingDate && time) {
                const iso = combineOperatingDateAndTime(operatingDate, String(time).slice(0, 5));
                sortMs = iso ? Date.parse(iso) : Number.POSITIVE_INFINITY;
            }
            return {
                routeCode,
                operatingDate,
                time,
                sortMs: Number.isFinite(sortMs) ? sortMs : Number.POSITIVE_INFINITY,
                index,
            };
        })
        .filter((row) => row.routeCode && row.operatingDate && row.time)
        .sort((a, b) => (a.sortMs - b.sortMs) || (a.index - b.index));

    return rows.map((row) => {
        const isOutbound = row.routeCode === outCode;
        const isInbound = row.routeCode === inCode;
        const stops = isOutbound
            ? mapScheduleStops(outboundStops)
            : (isInbound ? mapScheduleStops(inboundStops) : []);
        return {
            routeCode: row.routeCode,
            boatCode: boat,
            fromDate: row.operatingDate,
            toDate: row.operatingDate,
            daysOfWeek: null,
            departureTimes: [row.time],
            startTime: null,
            endTime: null,
            intervalMinutes: null,
            stops,
        };
    });
};

/** Gọi schedule lần lượt theo thứ tự giờ (đi/về xen kẽ). Không đoán/retry giờ khi skip. */
export const scheduleRoundTripSelection = async (args) => {
    const payloads = buildSchedulePayloadsFromRoundTripSelection(args);
    const totals = {
        created: 0,
        skipped: 0,
        skippedBoatBusy: 0,
        skippedStationBusy: 0,
        skippedPast: 0,
        skippedMissingOnBoardStaff: 0,
        skippedItems: [],
        createdTripCodes: [],
        requested: payloads.length,
        calls: payloads.length,
    };

    for (const payload of payloads) {
        const result = await scheduleTripsBatch(payload);
        totals.created += result.created;
        totals.skipped += result.skipped;
        totals.skippedBoatBusy += result.skippedBoatBusy;
        totals.skippedStationBusy += result.skippedStationBusy;
        totals.skippedPast += result.skippedPast;
        totals.skippedMissingOnBoardStaff += result.skippedMissingOnBoardStaff;
        totals.skippedItems.push(...(result.skippedItems || []));
        totals.createdTripCodes.push(...(result.createdTripCodes || []));
    }
    return totals;
};

/** Text tóm tắt skippedItems cho toast admin. */
export const formatSkippedScheduleItemsText = (skippedItems = [], lang = 'VN') => {
    const list = Array.isArray(skippedItems) ? skippedItems.filter(Boolean) : [];
    if (!list.length) return '';
    return list.slice(0, 3).map((item) => {
        const bits = [];
        if (item.requestedDepartureLabel) bits.push(item.requestedDepartureLabel);
        if (item.routeCode) bits.push(item.routeCode);
        if (item.reason) bits.push(item.reason);
        if (item.earliestAllowedDepartureLabel) {
            bits.push(
                lang === 'VN'
                    ? `sớm nhất ${item.earliestAllowedDepartureLabel}`
                    : `earliest ${item.earliestAllowedDepartureLabel}`,
            );
        }
        if (item.conflictTripCode) {
            bits.push(
                lang === 'VN'
                    ? `đụng ${item.conflictTripCode}`
                    : `conflict ${item.conflictTripCode}`,
            );
        }
        return bits.join(' · ');
    }).join('\n');
};

/** @deprecated Dùng scheduleTripsBatch */
export const generateTripsBatch = async (payload) => {
    try {
        return normalizeScheduleTripsResult(await apiGenerateTrips(payload));
    } catch (error) {
        console.error('Lỗi khi generate trips:', error);
        throw error;
    }
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

/** Đổi tàu cho trip — PATCH /trips/{id}/boat */
export const changeTripBoat = async (tripId, boatId) => {
    try {
        return await apiUpdateTripBoat(tripId, boatId);
    } catch (error) {
        console.error(`Lỗi đổi tàu cho trip ${tripId}:`, error);
        throw error;
    }
};

// Service: Tìm chuyến tàu bán vé (Waterbus) theo bến đi/bến đến/ngày khởi hành cho khách đặt vé
export const fetchTripSearch = async ({ fromStationId, toStationId, departureDate, routeType = 'Regular' }) => {
    try {
        const data = await apiSearchTrips({
            fromStationId,
            toStationId,
            // dd-MM-yyyy: tránh `/` trong query bị proxy/parse lệch
            operatingDate: toOperatingDateQuery(departureDate),
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
            operatingDate: toOperatingDateQuery(departureDate),
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
        let trip = data;
        if (data?.data && typeof data.data === "object" && !Array.isArray(data.data) && (data.data.tripId || data.data.tripCode || data.data.stops)) {
            trip = data.data;
        }
        return normalizeTripPayload(trip);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết chuyến tàu ${tripId}:`, error);
        throw error;
    }
};

const pickPassengerField = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const coerceStationLabel = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text === "[object Object]" ? "" : text;
  }
  if (typeof value === "object") {
    return String(
      value.stationName
      || value.name
      || value.stationCode
      || value.code
      || "",
    ).trim();
  }
  return "";
};

const unwrapPassengerList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.passengers)) return data.passengers;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.tickets)) return data.tickets;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

export const normalizeTripPassenger = (item) => {
  if (!item || typeof item !== "object") return null;
  const fromStopOrderRaw = pickPassengerField(item, ["fromStopOrder", "boardingStopOrder"], "");
  const toStopOrderRaw = pickPassengerField(item, ["toStopOrder", "alightingStopOrder"], "");
  const fromStopOrder = Number(fromStopOrderRaw);
  const toStopOrder = Number(toStopOrderRaw);
  const ticketTypeCode = String(
    pickPassengerField(item, ["ticketTypeCode", "ticketType", "passengerType", "type"], "") || "",
  ).toUpperCase();
  const seatRaw = String(
    pickPassengerField(item, ["seatNumber", "seatLabel", "seatCode", "seat"], "") || "",
  ).trim();
  const ticketCode = pickPassengerField(item, ["ticketCode", "code"], "") || "";
  const priceRaw = pickPassengerField(item, ["price", "unitPrice", "fareAmount", "ticketPrice"], null);
  const priceNum = priceRaw === null || priceRaw === "" ? null : Number(priceRaw);
  const noSeat = !seatRaw;
  const isLapInfantFlag = Boolean(item?.isLapInfant ?? item?.IsLapInfant);
  // Không ghế riêng: INFANT / CHILD / giá 0 → vẫn là hành khách, dùng chung ghế người lớn.
  const isLapInfant = isLapInfantFlag
    || ticketTypeCode === "INFANT"
    || (ticketTypeCode === "CHILD" && noSeat)
    || (noSeat && Number.isFinite(priceNum) && priceNum === 0);

  return {
    bookingCode: pickPassengerField(item, ["bookingCode", "booking.bookingCode"], "") || "—",
    passengerName: pickPassengerField(item, ["passengerName", "fullName", "name"], "") || "—",
    ticketTypeCode: ticketTypeCode
      || (isLapInfant ? (priceNum === 0 ? "INFANT" : "CHILD") : "—"),
    ticketTypeName: pickPassengerField(item, ["ticketTypeName"], "") || "",
    seatNumber: isLapInfant ? "" : (seatRaw || "—"),
    isLapInfant,
    companionPassengerName: pickPassengerField(item, [
      "companionPassengerName",
      "companionName",
      "accompaniedBy",
      "accompaniedByName",
    ], "") || "",
    fromStationId: pickPassengerField(item, ["fromStationId", "boardingStationId", "fromStation.id"], "") || "",
    toStationId: pickPassengerField(item, ["toStationId", "alightingStationId", "toStation.id"], "") || "",
    fromStationCode: pickPassengerField(item, ["fromStationCode", "boardingStationCode", "fromStation.code"], "") || "",
    toStationCode: pickPassengerField(item, ["toStationCode", "alightingStationCode", "toStation.code"], "") || "",
    fromStationName: coerceStationLabel(
      pickPassengerField(item, ["fromStationName", "boardingStationName", "fromStation"], ""),
    ) || "—",
    toStationName: coerceStationLabel(
      pickPassengerField(item, ["toStationName", "alightingStationName", "toStation"], ""),
    ) || "—",
    fromStopOrder: Number.isFinite(fromStopOrder) && fromStopOrder > 0 ? fromStopOrder : null,
    toStopOrder: Number.isFinite(toStopOrder) && toStopOrder > 0 ? toStopOrder : null,
    scheduledDeparture: pickPassengerField(item, [
      "scheduledDeparture",
      "scheduledBoardingAt",
      "fromStopScheduledDeparture",
      "boardingScheduledAt",
      "departureTime",
    ], "") || "",
    scheduledArrival: pickPassengerField(item, [
      "scheduledArrival",
      "scheduledAlightingAt",
      "toStopScheduledArrival",
      "alightingScheduledAt",
      "arrivalTime",
    ], "") || "",
    price: priceRaw,
    dateOfBirth: pickPassengerField(item, [
      "dateOfBirth",
      "DateOfBirth",
      "dob",
      "birthDate",
      "BirthDate",
      "passengerDateOfBirth",
    ], "") || "",
    birthYear: (() => {
      const raw = pickPassengerField(item, [
        "birthYear",
        "BirthYear",
        "passengerBirthYear",
        "yearOfBirth",
      ], "");
      const n = Number(raw);
      return Number.isFinite(n) && n > 1900 ? n : null;
    })(),
    ticketCode,
    ticketQrToken: pickPassengerField(item, ["ticketQrToken", "qrToken", "qrCode"], "") || "",
    ticketStatus: pickPassengerField(item, ["ticketStatus", "TicketStatus", "status", "attendanceStatus"], "") || "",
    checkedInAt: pickPassengerField(item, ["checkedInAt", "CheckedInAt", "checkInAt"], "") || "",
    checkedInByName: pickPassengerField(item, ["checkedInByName", "CheckedInByName", "checkInByName"], "") || "",
    checkedOutAt: pickPassengerField(item, ["checkedOutAt", "CheckedOutAt", "checkOutAt"], "") || "",
    checkedOutByName: pickPassengerField(item, ["checkedOutByName", "CheckedOutByName", "checkOutByName"], "") || "",
    raw: item,
  };
};

/**
 * Gộp trẻ em/em bé đi kèm (isLapInfant — không ghế riêng) vào card người lớn cùng booking / companion.
 * Trả về holders[]; mỗi holder có lapInfants[].
 */
export const groupTripPassengersForDisplay = (passengers = []) => {
  const list = Array.isArray(passengers) ? passengers.filter(Boolean) : [];
  const holders = list.filter((row) => !row.isLapInfant);
  const infants = list.filter((row) => row.isLapInfant);
  const used = new Set();

  const matchesHolder = (infant, holder) => {
    const companion = String(infant.companionPassengerName || "").trim().toLowerCase();
    const holderName = String(holder.passengerName || "").trim().toLowerCase();
    if (companion && holderName && companion === holderName) return true;

    const infantBooking = String(infant.bookingCode || "").trim().toUpperCase();
    const holderBooking = String(holder.bookingCode || "").trim().toUpperCase();
    if (infantBooking && holderBooking && infantBooking !== "—" && infantBooking === holderBooking) {
      return true;
    }

    const infantTicket = String(infant.ticketCode || "").trim().toUpperCase();
    const holderTicket = String(holder.ticketCode || "").trim().toUpperCase();
    if (infantTicket && holderTicket && infantTicket === holderTicket) return true;

    return false;
  };

  const groups = holders.map((holder) => {
    const lapInfants = infants.filter((infant, index) => {
      const key = `${infant.passengerName}|${infant.bookingCode}|${index}`;
      if (used.has(key)) return false;
      if (!matchesHolder(infant, holder)) return false;
      used.add(key);
      return true;
    });
    return { ...holder, lapInfants };
  });

  // Em bé chưa gắn được (hiếm) — vẫn hiện riêng nhưng đánh dấu lap infant
  infants.forEach((infant, index) => {
    const key = `${infant.passengerName}|${infant.bookingCode}|${index}`;
    if (used.has(key)) return;
    groups.push({ ...infant, lapInfants: [] });
  });

  return groups;
};

/** GET /trips/{tripId}/passengers — danh sách khách mua vé đúng chuyến (không trộn chiều khứ hồi). */
export const fetchTripPassengers = async (tripId) => {
  const id = String(tripId || "").trim();
  if (!id) throw new Error("tripId is required");
  try {
    const data = await apiGetTripPassengers(id);
    return unwrapPassengerList(data).map(normalizeTripPassenger).filter(Boolean);
  } catch (error) {
    console.error(`Lỗi khi lấy danh sách khách chuyến ${id}:`, error);
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

const unwrapDelayResponse = (data) => {
    if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
        return data.data;
    }
    return data;
};

/** POST /trips/{id}/delay/start — FE không tự tính lan delay. */
export const startTripDelay = async (tripId, { reason, startStopOrder } = {}) => {
    try {
        const data = await apiStartTripDelay(tripId, {
            reason: String(reason || '').trim(),
            startStopOrder: Number(startStopOrder) || 1,
        });
        return unwrapDelayResponse(data);
    } catch (error) {
        console.error(`Lỗi khi start delay chuyến ${tripId}:`, error);
        throw error;
    }
};

/** POST /trips/{id}/delay/resume — BE trả affectedTrips nếu lan delay. */
export const resumeTripDelay = async (tripId, { note } = {}) => {
    try {
        const data = await apiResumeTripDelay(tripId, {
            note: String(note || '').trim() || 'Tàu tiếp tục hành trình',
        });
        return unwrapDelayResponse(data);
    } catch (error) {
        console.error(`Lỗi khi resume delay chuyến ${tripId}:`, error);
        throw error;
    }
};
