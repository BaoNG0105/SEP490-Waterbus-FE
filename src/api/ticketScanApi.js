import api from './axios';

/**
 * Staff check-vé — contract BE hiện tại:
 * 1) POST /tickets/scan — body một trong:
 *    { codeOrToken } | { ticketCode } | { bookingQrToken }
 *    TK…/QR vé → TicketScanDto; BK… → manifest booking; CB… → manifest charter
 * 2) POST /tickets/check-in/{codeOrToken}?source=&clientOperationId=&deviceTime=&note=
 * 3) POST /tickets/check-out/{codeOrToken}?source=&clientOperationId=&deviceTime=&note=
 */

export const scanTicket = (payload) =>
  api.post('/tickets/scan', payload).then((response) => response.data);

export const checkInTicket = (codeOrToken, params = {}) =>
  api
    .post(
      `/tickets/check-in/${encodeURIComponent(String(codeOrToken || '').trim())}`,
      null,
      { params },
    )
    .then((response) => response.data);

export const checkOutTicket = (codeOrToken, params = {}) =>
  api
    .post(
      `/tickets/check-out/${encodeURIComponent(String(codeOrToken || '').trim())}`,
      null,
      { params },
    )
    .then((response) => response.data);

/** GET /bookings/manifest/qr/{bookingQrToken} — fallback nếu scan không trả manifest. */
export const getBookingManifestByQr = (bookingQrToken) =>
  api
    .get(`/bookings/manifest/qr/${encodeURIComponent(String(bookingQrToken || '').trim())}`)
    .then((response) => response.data);

/**
 * POST /bookings/manifest/qr/{bookingQrToken}/check-in-all?tripCode=
 * Khứ hồi: bắt buộc tripCode chiều đang boarding.
 */
export const checkInAllBookingManifestByQr = (bookingQrToken, { tripCode } = {}) =>
  api
    .post(
      `/bookings/manifest/qr/${encodeURIComponent(String(bookingQrToken || '').trim())}/check-in-all`,
      null,
      { params: tripCode ? { tripCode } : undefined },
    )
    .then((response) => response.data);
