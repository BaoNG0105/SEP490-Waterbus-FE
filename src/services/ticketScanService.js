import {
  scanTicket as apiScanTicket,
  checkInTicket as apiCheckInTicket,
  checkOutTicket as apiCheckOutTicket,
  getBookingManifestByQr as apiGetBookingManifestByQr,
  checkInAllBookingManifestByQr as apiCheckInAllBookingManifestByQr,
} from '../api/ticketScanApi';

const pick = (source, keys, fallback = '') => {
  for (const key of keys) {
    const value = key.split('.').reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
};

const pad = (n) => String(n).padStart(2, '0');

/** ISO local kèm offset (vd 2026-07-28T10:00:00+07:00). */
export const getDeviceTimeIso = (date = new Date()) => {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

export const createClientOperationId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

/** Query metadata cho check-in / check-out. */
export const buildTicketScanQueryParams = ({
  source = 'Manual',
  note = undefined,
} = {}) => {
  const params = {
    source: source || 'Manual',
    clientOperationId: createClientOperationId(),
    deviceTime: getDeviceTimeIso(),
  };
  const trimmedNote = note == null ? '' : String(note).trim();
  if (trimmedNote) params.note = trimmedNote;
  return params;
};

/**
 * Body POST /tickets/scan.
 * BE validator bắt buộc CodeOrToken — luôn gửi codeOrToken.
 * Thêm ticketCode / bookingQrToken theo prefix để BE nhận đúng loại.
 */
export const buildTicketScanBody = (rawInput) => {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const body = { codeOrToken: trimmed };
  if (upper.startsWith('TK')) body.ticketCode = trimmed;
  if (upper.startsWith('BK') || upper.startsWith('CB')) body.bookingQrToken = trimmed;
  return body;
};

const toBool = (value, fallback = false) => {
  if (value === true || value === false) return value;
  if (value == null || value === '') return fallback;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return fallback;
};

export const normalizeScannedTicket = (item) => {
  if (!item) return null;
  const ticket = item.ticket || item;
  const passenger = ticket.ticketPassenger || item.ticketPassenger || null;
  const ticketTypeCode = String(
    pick(ticket, ['ticketTypeCode', 'ticketType', 'type', 'passengerType'], '')
    || pick(passenger, ['ticketTypeCode', 'passengerType'], '')
    || pick(item, ['ticketTypeCode', 'ticketType', 'passengerType'], ''),
  ).toUpperCase();

  const status = pick(ticket, ['ticketStatus', 'status', 'attendanceStatus'], '')
    || pick(item, ['ticketStatus', 'status'], '');
  const statusKey = String(status || '').toLowerCase();
  // Fallback khi BE chưa gửi canCheck*: Active → check-in; CheckedIn → check-out.
  const canCheckInFallback = statusKey === 'active' || statusKey === '';
  const canCheckOutFallback = statusKey === 'checkedin' || statusKey.includes('checked_in');

  const fromStationName = pick(item, [
    'fromStationName', 'fromStation', 'boardingStationName',
  ], '') || pick(ticket, ['fromStationName'], '');
  const toStationName = pick(item, [
    'toStationName', 'toStation', 'alightingStationName',
  ], '') || pick(ticket, ['toStationName'], '');
  const fromStationCode = pick(item, ['fromStationCode'], '') || pick(ticket, ['fromStationCode'], '');
  const toStationCode = pick(item, ['toStationCode'], '') || pick(ticket, ['toStationCode'], '');

  const canCheckInRaw = item?.canCheckIn ?? item?.CanCheckIn
    ?? ticket?.canCheckIn ?? ticket?.CanCheckIn;
  const canCheckOutRaw = item?.canCheckOut ?? item?.CanCheckOut
    ?? ticket?.canCheckOut ?? ticket?.CanCheckOut;

  return {
    kind: 'ticket',
    codeOrToken: String(
      pick(item, ['codeOrToken', 'qrToken', 'token'], '')
      || pick(ticket, ['qrToken', 'code', 'ticketCode'], ''),
    ),
    ticketCode: pick(ticket, ['ticketCode', 'code'], '') || pick(item, ['ticketCode', 'code'], ''),
    bookingCode: pick(item, ['bookingCode', 'booking.bookingCode'], '')
      || pick(ticket, ['bookingCode'], ''),
    passengerName: pick(passenger, ['fullName', 'name'], '')
      || pick(ticket, ['passengerName', 'fullName', 'name', 'contactName'], '')
      || pick(item, ['fullName', 'passengerName', 'contactName', 'name'], '—'),
    ticketTypeCode: ticketTypeCode || '—',
    ticketTypeName: pick(item, ['ticketTypeName'], '')
      || pick(ticket, ['ticketTypeName'], '')
      || pick(passenger, ['ticketTypeName'], '')
      || '',
    status,
    canCheckIn: toBool(canCheckInRaw, canCheckInFallback),
    canCheckOut: toBool(canCheckOutRaw, canCheckOutFallback),
    tripCode: pick(item, ['tripCode', 'trip.code'], '') || pick(ticket, ['tripCode'], ''),
    legLabel: pick(item, ['leg', 'direction', 'tripDirection', 'legType'], '')
      || pick(ticket, ['leg', 'direction'], ''),
    routeName: pick(item, ['routeName', 'route.name'], '') || pick(ticket, ['routeName'], ''),
    boatName: pick(item, ['boatName', 'vesselName', 'boat.boatName'], '')
      || pick(ticket, ['boatName', 'vesselName'], ''),
    fromStation: fromStationName || fromStationCode,
    toStation: toStationName || toStationCode,
    fromStationCode,
    toStationCode,
    seatLabel: pick(ticket, ['seatNumber', 'seatCode', 'seatLabel', 'seat'], '')
      || pick(passenger, ['seatNumber', 'seatCode'], '')
      || pick(item, ['seatNumber', 'seatCode', 'seatLabel', 'seat'], ''),
    price: (() => {
      const raw = item?.unitPrice ?? item?.price ?? item?.fareAmount
        ?? ticket?.unitPrice ?? ticket?.price ?? ticket?.fareAmount ?? ticket?.ticketPrice
        ?? passenger?.unitPrice ?? null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    })(),
    scheduledBoardingAt: pick(item, ['scheduledBoardingAt', 'scheduledDeparture'], '')
      || pick(ticket, ['scheduledBoardingAt', 'scheduledDeparture'], '')
      || '',
    scheduledAlightingAt: pick(item, ['scheduledAlightingAt', 'scheduledArrival'], '')
      || pick(ticket, ['scheduledAlightingAt', 'scheduledArrival'], '')
      || '',
    checkedInAt: pick(ticket, ['checkedInAt', 'checkInAt'], '')
      || pick(item, ['checkedInAt'], ''),
    checkedInByName: pick(item, ['checkedInByName'], '')
      || pick(ticket, ['checkedInByName'], '')
      || '',
    checkedOutAt: pick(ticket, ['checkedOutAt', 'checkOutAt'], '')
      || pick(item, ['checkedOutAt'], ''),
    checkedOutByName: pick(item, ['checkedOutByName'], '')
      || pick(ticket, ['checkedOutByName'], '')
      || '',
    raw: item,
  };
};

const unwrapTicketList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.tickets)) return data.tickets;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.passengers)) return data.passengers;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.manifest)) return data.manifest;
  return [];
};

const looksLikeManifest = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (Array.isArray(data)) return true;
  if (data.kind === 'manifest') return true;
  if (unwrapTicketList(data).length > 0 && !data.ticketId && !data.TicketId) return true;
  const bookingType = String(data.bookingType || data.BookingType || '').toLowerCase();
  if (bookingType.includes('charter') || bookingType.includes('booking')) {
    return Boolean(data.bookingCode || data.BookingCode || data.bookingQrToken);
  }
  return Boolean(
    data.bookingQrToken
    || data.BookingQrToken
    || (data.tickets && !data.ticketCode && !data.TicketCode),
  );
};

const collectTripCodes = (source, tickets) => {
  const set = new Set();
  const push = (value) => {
    const code = String(value || '').trim();
    if (code) set.add(code);
  };
  push(pick(source, ['tripCode', 'departureTripCode'], ''));
  push(pick(source, ['returnTripCode'], ''));
  (Array.isArray(source?.trips) ? source.trips : []).forEach((trip) => {
    push(trip?.tripCode || trip?.code);
  });
  tickets.forEach((ticket) => push(ticket.tripCode));
  return [...set];
};

export const normalizeBookingManifest = (item, qrToken = '') => {
  if (!item) return null;
  const tickets = unwrapTicketList(item).map(normalizeScannedTicket).filter(Boolean);
  const tripCodes = collectTripCodes(item, tickets);
  return {
    kind: 'manifest',
    bookingQrToken: String(qrToken || pick(item, ['bookingQrToken', 'qrToken', 'token'], '') || '').trim(),
    bookingCode: pick(item, ['bookingCode', 'code'], '') || '—',
    tripCodes,
    selectedTripCode: tripCodes[0] || '',
    isRoundTrip: tripCodes.length > 1
      || Boolean(pick(item, ['returnTripCode', 'isRoundTrip'], false)),
    tickets,
    raw: item,
  };
};

/** Tra cứu qua POST /tickets/scan — 1 endpoint, BE tự phân TK/BK/CB. */
export const scanTicket = async (codeOrToken) => {
  const body = buildTicketScanBody(codeOrToken);
  if (!body) throw new Error('EMPTY_CODE');
  try {
    const data = await apiScanTicket(body);
    if (looksLikeManifest(data)) {
      const token = body.bookingQrToken || body.codeOrToken || body.ticketCode || '';
      return normalizeBookingManifest(data, token);
    }
    return normalizeScannedTicket(data);
  } catch (error) {
    console.error('Lỗi scan vé:', error);
    throw error;
  }
};

/** QR tổng booking — GET /bookings/manifest/qr/{token} (fallback). */
export const fetchBookingManifestByQr = async (bookingQrToken) => {
  const trimmed = String(bookingQrToken || '').trim();
  if (!trimmed) throw new Error('EMPTY_CODE');
  try {
    const data = await apiGetBookingManifestByQr(trimmed);
    return normalizeBookingManifest(data, trimmed);
  } catch (error) {
    console.error('Lỗi tải manifest booking:', error);
    throw error;
  }
};

/** Lookup staff: ưu tiên POST /tickets/scan; BK/CB fallback GET manifest nếu scan lỗi cũ. */
export const lookupTicketOrManifest = async (codeOrToken) => {
  const trimmed = String(codeOrToken || '').trim();
  if (!trimmed) throw new Error('EMPTY_CODE');

  try {
    return await scanTicket(trimmed);
  } catch (scanError) {
    const upper = trimmed.toUpperCase();
    if (upper.startsWith('BK') || upper.startsWith('CB')) {
      try {
        return await fetchBookingManifestByQr(trimmed);
      } catch {
        throw scanError;
      }
    }
    throw scanError;
  }
};

export const checkInTicket = async (codeOrToken, { source = 'Manual' } = {}) => {
  const trimmed = String(codeOrToken || '').trim();
  if (!trimmed) throw new Error('EMPTY_CODE');
  try {
    return await apiCheckInTicket(trimmed, buildTicketScanQueryParams({ source }));
  } catch (error) {
    console.error('Lỗi check-in vé:', error);
    throw error;
  }
};

export const checkOutTicket = async (codeOrToken, { source = 'Manual' } = {}) => {
  const trimmed = String(codeOrToken || '').trim();
  if (!trimmed) throw new Error('EMPTY_CODE');
  try {
    return await apiCheckOutTicket(trimmed, buildTicketScanQueryParams({ source }));
  } catch (error) {
    console.error('Lỗi check-out vé:', error);
    throw error;
  }
};

export const checkInAllBookingManifest = async (bookingQrToken, tripCode) => {
  const trimmed = String(bookingQrToken || '').trim();
  if (!trimmed) throw new Error('EMPTY_CODE');
  try {
    return await apiCheckInAllBookingManifestByQr(trimmed, {
      tripCode: String(tripCode || '').trim() || undefined,
    });
  } catch (error) {
    console.error('Lỗi check-in-all manifest:', error);
    throw error;
  }
};
