import api from './axios';

/**
 * POST /api/trips/{tripId}/replan/preview
 * Xem trước các phương án thay thế cho 1 trip bị sự cố.
 * Body (tất cả optional):
 * {
 *   "action": "ReplaceBoat" | "Delay" | "HoldDelayed" | "Cancel",
 *   "delayMinutes": number,
 *   "replacementBoatId": string,
 *   "routeId": string,
 *   "fromStopOrder": number,
 *   "toStopOrder": number,
 *   "note": string
 * }
 *
 * Response: {
 *   "candidates": [...],
 *   "affectedTrips": [...],
 *   "replanAction": "..."
 * }
 */
export const previewReplan = (tripId, payload = {}) =>
  api
    .post(
      `/trips/${encodeURIComponent(String(tripId || '').trim())}/replan/preview`,
      payload,
    )
    .then((response) => response.data);

/**
 * POST /api/trips/{tripId}/replan/confirm
 * Xác nhận thực hiện replan.
 * Body (tất cả optional):
 * {
 *   "action": "ReplaceBoat" | "Delay" | "HoldDelayed" | "Cancel",
 *   "selectedBoatId": string,
 *   "selectedCandidateId": string,
 *   "delayMinutes": number,
 *   "routeId": string,
 *   "fromStopOrder": number,
 *   "toStopOrder": number,
 *   "note": string
 * }
 *
 * Response: {
 *   "success": boolean,
 *   "message": string,
 *   "updatedTrip": {...}
 * }
 */
export const confirmReplan = (tripId, payload = {}) =>
  api
    .post(
      `/trips/${encodeURIComponent(String(tripId || '').trim())}/replan/confirm`,
      payload,
    )
    .then((response) => response.data);

/**
 * GET /api/trips/{tripId}/replan
 * Lấy lịch sử replan của 1 trip.
 */
export const getReplanHistory = (tripId) =>
  api
    .get(`/trips/${encodeURIComponent(String(tripId || '').trim())}/replan`)
    .then((response) => response.data);
