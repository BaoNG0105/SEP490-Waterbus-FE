/**
 * Replan Service
 * Xử lý logic cho màn Preview Replan của Admin.
 */
import {
  previewReplan as apiPreviewReplan,
  confirmReplan as apiConfirmReplan,
  getReplanHistory as apiGetReplanHistory,
} from '../api/replanApi';

/* ─── Normalizers ─────────────────────────────────────────────────────────── */

/** Chuẩn hoá 1 candidate tàu thay thế */
const normalizeCandidate = (raw) => ({
  candidateId: raw?.candidateId ?? raw?.id ?? '',
  boatId: raw?.boatId ?? '',
  boatCode: raw?.boatCode ?? '',
  boatName: raw?.boatName ?? '',
  routeId: raw?.routeId ?? '',
  routeName: raw?.routeName ?? '',
  capacity: raw?.capacity ?? raw?.seatCount ?? 0,
  availableSeats: raw?.availableSeats ?? null,
  replacementBoatId: raw?.replacementBoatId ?? '',
  replacementBoatName: raw?.replacementBoatName ?? '',
  /** @type {'KeepBoat' | 'ReplaceBoat'} */
  type: raw?.type ?? 'KeepBoat',
  score: raw?.score ?? 0,
  reason: raw?.reason ?? '',
  /** ISO datetime tàu hiện tại sẽ bắt đầu chạy tuyến mới */
  newDepartureAt: raw?.newDepartureAt ?? '',
  /** ISO datetime tàu cũ sẽ rời bến sau khi nhả khách */
  originalBoatFreeAt: raw?.originalBoatFreeAt ?? '',
  raw: raw,
});

/** Chuẩn hoá 1 trip bị ảnh hưởng */
const normalizeAffectedTrip = (raw) => ({
  tripId: raw?.tripId ?? raw?.id ?? '',
  tripCode: raw?.tripCode ?? '',
  routeName: raw?.routeName ?? '',
  /** ISO datetime */
  scheduledDepartureAt: raw?.scheduledDepartureAt ?? raw?.departureTime ?? '',
  /** ISO datetime */
  scheduledArrivalAt: raw?.scheduledArrivalAt ?? raw?.arrivalTime ?? '',
  passengerCount: raw?.passengerCount ?? 0,
  checkedInCount: raw?.checkedInCount ?? 0,
  boatName: raw?.boatName ?? '',
  /** @type {'BoatUnavailable' | 'TimingConflict' | 'CrewUnavailable' | 'Unknown'} */
  impactReason: raw?.impactReason ?? 'Unknown',
  impactLevel: raw?.impactLevel ?? 'Medium', // Low | Medium | High
  raw: raw,
});

/** Chuẩn hoá response preview */
export const normalizeReplanPreview = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const candidates = Array.isArray(raw.candidates)
    ? raw.candidates.map(normalizeCandidate)
    : [];

  const affectedTrips = Array.isArray(raw.affectedTrips)
    ? raw.affectedTrips.map(normalizeAffectedTrip)
    : [];

  return {
    tripId: raw?.tripId ?? '',
    tripCode: raw?.tripCode ?? '',
    action: raw?.replanAction ?? raw?.action ?? '',
    candidates,
    affectedTrips,
    /** Tổng số khách bị ảnh hưởng */
    totalAffectedPassengers: affectedTrips.reduce(
      (sum, t) => sum + (t.passengerCount ?? 0),
      0,
    ),
    raw,
  };
};

/* ─── Service methods ─────────────────────────────────────────────────────── */

/**
 * Gọi preview replan.
 * @param {string} tripId
 * @param {object} options — { action, delayMinutes, replacementBoatId, routeId, fromStopOrder, toStopOrder, note }
 */
export const fetchReplanPreview = async (tripId, options = {}) => {
  const payload = {};
  if (options.action) payload.action = options.action;
  if (options.delayMinutes != null) payload.delayMinutes = Number(options.delayMinutes);
  if (options.replacementBoatId) payload.replacementBoatId = options.replacementBoatId;
  if (options.routeId) payload.routeId = options.routeId;
  if (options.fromStopOrder != null) payload.fromStopOrder = Number(options.fromStopOrder);
  if (options.toStopOrder != null) payload.toStopOrder = Number(options.toStopOrder);
  if (options.note) payload.note = options.note;

  const data = await apiPreviewReplan(tripId, payload);
  return normalizeReplanPreview(data);
};

/**
 * Gọi confirm replan (mock BE chưa xong).
 * @param {string} tripId
 * @param {object} options
 */
export const executeReplanConfirm = async (tripId, options = {}) => {
  const payload = {};
  if (options.action) payload.action = options.action;
  if (options.selectedBoatId) payload.selectedBoatId = options.selectedBoatId;
  if (options.selectedCandidateId) payload.selectedCandidateId = options.selectedCandidateId;
  if (options.delayMinutes != null) payload.delayMinutes = Number(options.delayMinutes);
  if (options.routeId) payload.routeId = options.routeId;
  if (options.fromStopOrder != null) payload.fromStopOrder = Number(options.fromStopOrder);
  if (options.toStopOrder != null) payload.toStopOrder = Number(options.toStopOrder);
  if (options.note) payload.note = options.note;

  return apiConfirmReplan(tripId, payload);
};

/**
 * Lấy lịch sử replan của trip.
 * @param {string} tripId
 */
export const fetchReplanHistory = async (tripId) => {
  const data = await apiGetReplanHistory(tripId);
  return data;
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Màu badge theo impact level */
export const impactLevelColor = (level) => {
  switch (String(level || '').toLowerCase()) {
    case 'high':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300';
    case 'medium':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    case 'low':
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
};

/** Màu badge theo impact reason */
export const impactReasonLabel = (reason, lang = 'VN') => {
  const map = {
    BoatUnavailable: lang === 'VN' ? 'Tàu không khả dụng' : 'Boat unavailable',
    TimingConflict: lang === 'VN' ? 'Xung đột thời gian' : 'Timing conflict',
    CrewUnavailable: lang === 'VN' ? 'Thuyền viên không khả dụng' : 'Crew unavailable',
    Unknown: lang === 'VN' ? 'Không xác định' : 'Unknown',
  };
  return map[String(reason || '').replace(/[_\s]/g, '')] ?? map.Unknown;
};

/** Màu badge theo candidate type */
export const candidateTypeBadge = (type) => {
  switch (String(type || '').toLowerCase()) {
    case 'replaceboat':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'keepboat':
    default:
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  }
};
