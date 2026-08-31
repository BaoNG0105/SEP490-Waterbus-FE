import api from './axios';

/**
 * Staff check-vé — contract BE:
 * 1) Luôn POST /tickets/scan trước { codeOrToken, source: "Qr", ... }
 *    BE tự nhận: TK/vé riêng → TicketScanDto | BK → BookingManifestDto | CB → CharterBookingManifestDto
 * 2) Vé riêng: POST /tickets/check-in | /tickets/check-out body { codeOrToken: "TK..." }
 *    — không gửi QR tổng BK/CB vào 2 API này
 * 3) QR tổng booking thường:
 *    POST /bookings/manifest/qr/{qrToken}/check-in-all (?tripCode= nếu khứ hồi)
 *    POST /bookings/manifest/qr/{qrToken}/check-out-all (?tripCode= nếu khứ hồi — chiều đang trả khách)
 * 4) QR tổng charter: POST /charter-bookings/manifest/qr/{qrToken}/attendance
 *    body { action: CheckIn|CheckOut, mode: All|Selected, ticketIds, ...scanMetadata }
 */

export const scanTicket = (payload) =>
  api.post('/tickets/scan', payload, { timeout: 20000 }).then((response) => response.data);

export const checkInTicket = (payload) =>
  api.post('/tickets/check-in', payload).then((response) => response.data);

export const checkOutTicket = (payload) =>
  api.post('/tickets/check-out', payload).then((response) => response.data);

/**
 * POST /tickets/concession/reject
 * Staff xác nhận sai đối tượng ưu đãi (SENIOR / DISABLED).
 */
export const rejectTicketConcession = (payload) =>
  api.post('/tickets/concession/reject', payload).then((response) => response.data);

/** GET /bookings/manifest/qr/{bookingQrToken} — fallback nếu scan không trả manifest. */
export const getBookingManifestByQr = (bookingQrToken) =>
  api
    .get(`/bookings/manifest/qr/${encodeURIComponent(String(bookingQrToken || '').trim())}`)
    .then((response) => response.data);

/** GET /bookings/manifest/{bookingCode} — staff lấy giá / ghế theo mã BK. */
export const getBookingManifestByCode = (bookingCode) =>
  api
    .get(`/bookings/manifest/${encodeURIComponent(String(bookingCode || '').trim())}`)
    .then((response) => response.data);

/**
 * POST /bookings/manifest/qr/{bookingQrToken}/check-in-all?tripCode=
 * (booking thường / khứ hồi — không dùng cho charter QR tổng)
 */
export const checkInAllBookingManifestByQr = (bookingQrToken, {
  tripCode,
  source,
  tripStopId,
  clientOperationId,
  deviceTime,
  note,
} = {}) =>
  api
    .post(
      `/bookings/manifest/qr/${encodeURIComponent(String(bookingQrToken || '').trim())}/check-in-all`,
      null,
      {
        params: {
          tripCode: tripCode || undefined,
          source: source || undefined,
          tripStopId: tripStopId || undefined,
          clientOperationId: clientOperationId || undefined,
          deviceTime: deviceTime || undefined,
          note: note || undefined,
        },
      },
    )
    .then((response) => response.data);

/**
 * POST /bookings/manifest/qr/{bookingQrToken}/check-out-all?tripCode=
 * Chỉ checkout vé đang CheckedIn; khứ hồi truyền tripCode chiều đang trả khách.
 */
export const checkOutAllBookingManifestByQr = (bookingQrToken, {
  tripCode,
  source,
  tripStopId,
  clientOperationId,
  deviceTime,
  note,
} = {}) =>
  api
    .post(
      `/bookings/manifest/qr/${encodeURIComponent(String(bookingQrToken || '').trim())}/check-out-all`,
      null,
      {
        params: {
          tripCode: tripCode || undefined,
          source: source || undefined,
          tripStopId: tripStopId || undefined,
          clientOperationId: clientOperationId || undefined,
          deviceTime: deviceTime || undefined,
          note: note || undefined,
        },
      },
    )
    .then((response) => response.data);
