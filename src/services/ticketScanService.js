import {
  scanTicket as apiScanTicket,
  checkInTicket as apiCheckInTicket,
  checkOutTicket as apiCheckOutTicket,
  getBookingManifestByQr as apiGetBookingManifestByQr,
  checkInAllBookingManifestByQr as apiCheckInAllBookingManifestByQr,
  checkOutAllBookingManifestByQr as apiCheckOutAllBookingManifestByQr,
} from '../api/ticketScanApi';
import { updateCharterBookingAttendance as apiUpdateCharterAttendance } from '../api/charterBookingApi';

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

/** QR tổng booking (BK) / charter (CB) — không được gửi vào /tickets/check-in|out. */
export const isGroupQrToken = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  return upper.startsWith('BK') || upper.startsWith('CB');
};

/**
 * Token/mã vé riêng cho POST /tickets/check-in|out.
 * Không nhận BK/CB; ưu tiên ticketCode / qrToken vé.
 */
export const resolveIndividualTicketToken = (row, fallback = '') => {
  const candidates = [
    row?.ticketCode,
    row?.codeOrToken,
    row?.raw?.ticketCode,
    row?.raw?.codeOrToken,
    row?.raw?.qrToken,
    row?.raw?.ticket?.ticketCode,
    row?.raw?.ticket?.qrToken,
    row?.raw?.ticket?.code,
    fallback,
  ];
  for (const candidate of candidates) {
    const trimmed = String(candidate || '').trim();
    if (!trimmed || isGroupQrToken(trimmed)) continue;
    return trimmed;
  }
  return '';
};

export const assertIndividualTicketToken = (codeOrToken) => {
  const trimmed = String(codeOrToken || '').trim();
  if (!trimmed) {
    const err = new Error('EMPTY_CODE');
    err.code = 'EMPTY_CODE';
    throw err;
  }
  if (isGroupQrToken(trimmed)) {
    const err = new Error('GROUP_QR_NOT_ALLOWED');
    err.code = 'GROUP_QR_NOT_ALLOWED';
    throw err;
  }
  return trimmed;
};

/** Loại vé/hành khách staff phải đối chiếu giấy tờ/độ tuổi trước check-in. */
export const ELIGIBILITY_VERIFY_CODES = Object.freeze(['CHILD', 'INFANT', 'SENIOR', 'DISABLED']);

const ELIGIBILITY_VERIFY_SET = new Set(ELIGIBILITY_VERIFY_CODES);

/** Thu thập mã ưu đãi cần xác nhận từ ticket + passengers[]. */
export const collectEligibilityCodes = (ticketLike) => {
  if (!ticketLike) return [];
  const found = new Set();
  const add = (value) => {
    const code = String(value || '').trim().toUpperCase();
    if (ELIGIBILITY_VERIFY_SET.has(code)) found.add(code);
  };
  add(ticketLike.ticketTypeCode);
  add(ticketLike.passengerType);
  add(ticketLike.ticketType);
  const passengers = Array.isArray(ticketLike.passengers) ? ticketLike.passengers : [];
  passengers.forEach((row) => {
    add(row?.ticketTypeCode);
    add(row?.passengerType);
    add(row?.type);
  });
  return ELIGIBILITY_VERIFY_CODES.filter((code) => found.has(code));
};

export const requiresEligibilityVerification = (ticketLike) =>
  collectEligibilityCodes(ticketLike).length > 0;

export const buildEligibilityConfirmNote = (codes) => {
  const list = (Array.isArray(codes) ? codes : collectEligibilityCodes(codes))
    .map((code) => String(code || '').trim().toUpperCase())
    .filter((code) => ELIGIBILITY_VERIFY_SET.has(code));
  if (!list.length) return '';
  return `Staff confirmed eligibility: ${list.join('/')}`;
};

/**
 * Body POST /tickets/check-in | check-out.
 * Không đưa codeOrToken vào URL path.
 */
export const buildTicketScanActionBody = (rawInput, { source = 'Qr', note } = {}) => {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return null;
  const body = {
    codeOrToken: trimmed,
    source: source || 'Qr',
  };
  const trimmedNote = note == null ? '' : String(note).trim();
  if (trimmedNote) body.note = trimmedNote;
  return body;
};

/** @deprecated dùng buildTicketScanActionBody */
export const buildTicketScanQueryParams = ({ source = 'Qr', note = undefined } = {}) => {
  const params = {
    source: source || 'Qr',
  };
  const trimmedNote = note == null ? '' : String(note).trim();
  if (trimmedNote) params.note = trimmedNote;
  return params;
};

/**
 * Body POST /tickets/scan — đúng contract BE:
 * { "codeOrToken": "...", "source": "Qr" }
 * Không gửi clientOperationId/deviceTime (dễ làm BE 500 nếu DTO không nhận).
 */
export const buildTicketScanBody = (rawInput, { source = 'Qr' } = {}) => {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return null;
  return {
    codeOrToken: trimmed,
    source: source || 'Qr',
  };
};

const toBool = (value, fallback = false) => {
  if (value === true || value === false) return value;
  if (value == null || value === '') return fallback;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return fallback;
};

/** passengers[] trên 1 vé: người lớn + INFANT đi kèm (chung QR). CHILD có QR riêng. */
const normalizePassengerList = (source) => {
  const list = Array.isArray(source?.passengers)
    ? source.passengers
    : Array.isArray(source?.ticket?.passengers)
      ? source.ticket.passengers
      : [];
  const sharedTicketCode = String(
    pick(source, ['ticketCode', 'code'], '')
    || pick(source?.ticket, ['ticketCode', 'code'], '')
    || '',
  ).trim();
  const rootSeat = String(
    pick(source, ['seatCode', 'seatNumber', 'seatLabel', 'seat'], '')
    || pick(source?.ticket, ['seatCode', 'seatNumber', 'seat'], '')
    || '',
  ).trim();

  return list.map((row) => {
    if (typeof row === 'string') {
      return {
        fullName: row,
        ticketTypeCode: '',
        seatCode: rootSeat,
        isLapInfant: false,
        usesCompanionTicket: false,
        companionPassengerName: '',
        ticketCode: sharedTicketCode,
      };
    }
    const typeCode = String(pick(row, ['passengerType', 'ticketTypeCode', 'type'], '') || '').toUpperCase();
    const seatCode = String(pick(row, ['seatCode', 'seatNumber', 'seat'], '') || '').trim();
    const usesCompanionTicket = toBool(
      row?.usesCompanionTicket ?? row?.UsesCompanionTicket,
      // BE: chỉ INFANT (không ghế) dùng QR người lớn. CHILD có QR riêng.
      typeCode === 'INFANT' || (typeCode === 'CHILD' && !seatCode),
    );
    const isLapInfantFlag = toBool(row?.isLapInfant ?? row?.IsLapInfant, false);
    const isLapInfant = isLapInfantFlag
      || (typeCode === 'INFANT' && !seatCode)
      || (usesCompanionTicket && typeCode === 'INFANT');

    const birthYearRaw = pick(row, ['birthYear', 'BirthYear', 'yearOfBirth'], '');
    const birthYearNum = Number(birthYearRaw);
    const birthYear = Number.isFinite(birthYearNum) && birthYearNum > 1900
      ? birthYearNum
      : (birthYearRaw ? String(birthYearRaw).trim() : '');

    return {
      fullName: pick(row, ['fullName', 'name', 'passengerName'], '') || '—',
      ticketTypeCode: typeCode,
      passengerType: typeCode,
      birthYear,
      phoneNumber: String(
        pick(row, ['phoneNumber', 'PhoneNumber', 'phone', 'mobile', 'Phone'], '') || '',
      ).trim(),
      email: String(pick(row, ['email', 'Email'], '') || '').trim(),
      seatCode: isLapInfant ? '' : (seatCode || rootSeat),
      isLapInfant,
      usesCompanionTicket: Boolean(usesCompanionTicket || isLapInfant),
      companionPassengerName: pick(row, [
        'companionPassengerName',
        'companionName',
        'accompaniedBy',
        'accompaniedByName',
      ], '') || '',
      ticketCode: String(pick(row, ['ticketCode', 'code'], '') || sharedTicketCode || '').trim(),
      raw: row,
    };
  });
};

export const normalizeScannedTicket = (item) => {
  if (!item) return null;
  const ticket = item.ticket || item.Ticket || item;
  const passenger = ticket.ticketPassenger || ticket.TicketPassenger
    || item.ticketPassenger || item.TicketPassenger
    || null;
  const passengers = normalizePassengerList(item);
  const primaryPassenger = passengers.find((row) => (
    !row.isLapInfant && !row.usesCompanionTicket
  )) || passengers.find((row) => !row.isLapInfant) || passengers[0] || null;
  const lapInfants = passengers.filter((row) => (
    row.isLapInfant
    || row.usesCompanionTicket
    || String(row.ticketTypeCode || '').toUpperCase() === 'INFANT'
  ));

  const ticketTypeCode = String(
    pick(ticket, ['ticketTypeCode', 'ticketType', 'type', 'passengerType'], '')
    || pick(passenger, ['ticketTypeCode', 'passengerType'], '')
    || pick(item, ['ticketTypeCode', 'ticketType', 'passengerType'], '')
    || primaryPassenger?.ticketTypeCode
    || '',
  ).toUpperCase();

  const status = pick(ticket, ['ticketStatus', 'status', 'attendanceStatus'], '')
    || pick(item, ['ticketStatus', 'TicketStatus', 'status'], '');
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

  const passengerName = primaryPassenger?.fullName
    || pick(passenger, ['fullName', 'name'], '')
    || pick(ticket, ['passengerName', 'fullName', 'name', 'contactName'], '')
    || pick(item, ['fullName', 'passengerName', 'contactName', 'name'], '')
    || '—';

  const seatLabel = String(
    pick(item, ['seatCode', 'seatNumber', 'seatLabel', 'seat'], '')
    || pick(ticket, ['seatNumber', 'seatCode', 'seatLabel', 'seat'], '')
    || pick(passenger, ['seatNumber', 'seatCode'], '')
    || primaryPassenger?.seatCode
    || '',
  ).trim();

  // BE: contactPhone + ticketPassenger.phoneNumber/email + passengers[].phoneNumber/email
  const passengerPhone = String(
    pick(passenger, ['phoneNumber', 'PhoneNumber', 'phone', 'mobile'], '')
    || primaryPassenger?.phoneNumber
    || pick(item, ['contactPhone', 'ContactPhone', 'passengerPhone', 'phone', 'Phone'], '')
    || pick(ticket, ['contactPhone', 'ContactPhone', 'passengerPhone', 'phone'], '')
    || '',
  ).trim();
  const passengerEmail = String(
    pick(passenger, ['email', 'Email'], '')
    || primaryPassenger?.email
    || pick(item, ['contactEmail', 'ContactEmail', 'passengerEmail', 'email', 'Email'], '')
    || pick(ticket, ['contactEmail', 'ContactEmail', 'email', 'Email'], '')
    || '',
  ).trim();
  const contactName = pick(item, ['contactName', 'ContactName'], '')
    || pick(ticket, ['contactName', 'ContactName'], '')
    || '';

  return {
    kind: 'ticket',
    ticketId: String(
      pick(item, ['ticketId', 'id'], '')
      || pick(ticket, ['ticketId', 'id'], '')
      || '',
    ).trim(),
    codeOrToken: String(
      pick(item, ['codeOrToken', 'qrToken', 'ticketQrToken'], '')
      || pick(ticket, ['qrToken', 'ticketQrToken', 'ticketCode', 'code'], '')
      || pick(item, ['ticketCode', 'code'], '')
      || '',
    ).trim(),
    ticketCode: pick(ticket, ['ticketCode', 'code'], '')
      || pick(item, ['ticketCode', 'code'], '')
      || primaryPassenger?.ticketCode
      || '',
    bookingCode: pick(item, ['bookingCode', 'booking.bookingCode'], '')
      || pick(ticket, ['bookingCode'], ''),
    bookingType: pick(item, ['bookingType', 'BookingType'], '') || pick(ticket, ['bookingType'], ''),
    bookingStatus: pick(item, ['bookingStatus', 'BookingStatus'], '') || '',
    paymentStatus: pick(item, ['paymentStatus', 'PaymentStatus'], '') || '',
    passengerName,
    passengerPhone,
    passengerEmail,
    contactName,
    passengers,
    primaryPassenger,
    lapInfants,
    ticketTypeCode: ticketTypeCode || '—',
    ticketTypeName: pick(item, ['ticketTypeName'], '')
      || pick(ticket, ['ticketTypeName'], '')
      || pick(passenger, ['ticketTypeName'], '')
      || '',
    eligibilityCodes: collectEligibilityCodes({
      ticketTypeCode,
      passengers,
    }),
    status,
    canCheckIn: toBool(canCheckInRaw, canCheckInFallback),
    canCheckOut: toBool(canCheckOutRaw, canCheckOutFallback),
    tripCode: pick(item, ['tripCode', 'trip.code'], '') || pick(ticket, ['tripCode'], ''),
    legLabel: pick(item, ['leg', 'direction', 'tripDirection', 'legType'], '')
      || pick(ticket, ['leg', 'direction'], ''),
    routeName: pick(item, ['routeName', 'route.name'], '') || pick(ticket, ['routeName'], ''),
    boatName: pick(item, ['boatName', 'vesselName', 'boat.boatName'], '')
      || pick(ticket, ['boatName', 'vesselName'], ''),
    boatId: String(pick(item, ['boatId', 'BoatId'], '') || pick(ticket, ['boatId'], '') || ''),
    fromStation: fromStationName || fromStationCode,
    toStation: toStationName || toStationCode,
    fromStationCode,
    toStationCode,
    fromStationId: String(pick(item, ['fromStationId'], '') || ''),
    toStationId: String(pick(item, ['toStationId'], '') || ''),
    seatLabel,
    departureDate: pick(item, ['departureDate', 'operatingDate'], '') || '',
    startTime: pick(item, ['startTime'], '') || '',
    passengerCount: Number(pick(item, ['passengerCount', 'registeredPassengerCount'], '') || 0) || null,
    issuedAt: pick(item, ['issuedAt', 'IssuedAt'], '') || pick(ticket, ['issuedAt'], '') || '',
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

/** Response scan 1 vé: có seatCode / ticketCode / canCheck* + passengers[] trên cùng vé. */
const looksLikeSingleTicketScan = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (data.kind === 'ticket') return true;
  const hasSeat = Boolean(data.seatCode || data.seatNumber || data.SeatCode || data.SeatNumber);
  const hasTicketCode = Boolean(data.ticketCode || data.TicketCode);
  const hasFlags = data.canCheckIn != null
    || data.canCheckOut != null
    || data.CanCheckIn != null
    || data.CanCheckOut != null
    || data.ticketStatus
    || data.TicketStatus;
  const hasPassengerPeople = Array.isArray(data.passengers)
    && data.passengers.some((row) => row && (row.fullName || row.passengerName || row.passengerType || row.isLapInfant != null));
  return Boolean((hasSeat || hasTicketCode || hasFlags) && (hasPassengerPeople || hasSeat || hasTicketCode || hasFlags));
};

const unwrapTicketList = (data) => {
  if (Array.isArray(data)) return data;
  // passengers[] trên 1 vé (adult + lap infant) — không phải danh sách vé manifest.
  if (Array.isArray(data?.tickets)) return data.tickets;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.manifest?.passengers)) return data.manifest.passengers;
  if (Array.isArray(data?.manifest?.tickets)) return data.manifest.tickets;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.manifest)) return data.manifest;
  // Chỉ dùng passengers như list vé khi không có seatCode / canCheck* (QR tổng).
  if (Array.isArray(data?.passengers) && !looksLikeSingleTicketScan(data)) {
    return data.passengers;
  }
  return [];
};

const detectIsCharter = (data, qrToken = '') => {
  const token = String(qrToken || pick(data, ['bookingQrToken', 'qrToken', 'token'], '') || '').toUpperCase();
  if (token.startsWith('CB')) return true;
  const bookingType = String(data?.bookingType || data?.BookingType || data?.type || '').toLowerCase();
  return bookingType.includes('charter');
};

/** Gỡ envelope { data|result|value|ticket } nếu BE bọc TicketScanDto. */
const unwrapScanPayload = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  if (looksLikeSingleTicketScan(raw) || looksLikeManifest(raw)) return raw;
  const nested = raw.data ?? raw.result ?? raw.value ?? raw.ticket ?? raw.payload;
  if (nested && typeof nested === 'object') {
    if (looksLikeSingleTicketScan(nested) || looksLikeManifest(nested)) return nested;
    const deeper = nested.data ?? nested.result ?? nested.value;
    if (deeper && typeof deeper === 'object'
      && (looksLikeSingleTicketScan(deeper) || looksLikeManifest(deeper))) {
      return deeper;
    }
    return nested;
  }
  return raw;
};

const looksLikeManifest = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (Array.isArray(data)) return true;
  if (data.kind === 'manifest') return true;
  // Vé riêng luôn có ticketId / ticketCode / seatCode / canCheck* — không phải QR tổng.
  if (looksLikeSingleTicketScan(data)) return false;
  if (data.ticketId || data.TicketId || data.ticketCode || data.TicketCode || data.seatCode || data.SeatCode) {
    return false;
  }
  if (unwrapTicketList(data).length > 0) return true;
  const bookingType = String(data.bookingType || data.BookingType || '').toLowerCase();
  // "Booking" trên TicketScanDto không đồng nghĩa QR tổng — chỉ khi có manifest/list vé.
  if (bookingType.includes('charter')) {
    return Boolean(data.bookingQrToken || data.manifest || data.tickets);
  }
  return Boolean(
    data.bookingQrToken
    || data.BookingQrToken
    || data.manifest
    || (Array.isArray(data.tickets) && data.tickets.length > 0),
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
  const root = item?.manifest && typeof item.manifest === 'object' ? item.manifest : item;
  const tickets = unwrapTicketList(item).map(normalizeScannedTicket).filter(Boolean);
  const tripCodes = collectTripCodes(root, tickets);
  const token = String(qrToken || pick(root, ['bookingQrToken', 'qrToken', 'token'], '') || '').trim();
  return {
    kind: 'manifest',
    isCharter: detectIsCharter(root, token),
    bookingQrToken: token,
    bookingCode: pick(root, ['bookingCode', 'code'], '') || pick(item, ['bookingCode', 'code'], '') || '—',
    tripCodes,
    selectedTripCode: tripCodes[0] || '',
    isRoundTrip: tripCodes.length > 1
      || Boolean(pick(root, ['returnTripCode', 'isRoundTrip'], false)),
    tickets,
    updatedCount: Number(item?.updatedCount ?? root?.updatedCount ?? 0) || 0,
    skippedTickets: Array.isArray(item?.skippedTickets)
      ? item.skippedTickets
      : Array.isArray(root?.skippedTickets)
        ? root.skippedTickets
        : [],
    raw: item,
  };
};

/** Tra cứu qua POST /tickets/scan — 1 endpoint, BE tự phân vé thường / QR tổng. */
export const scanTicket = async (codeOrToken, { source = 'Qr' } = {}) => {
  const body = buildTicketScanBody(codeOrToken, { source });
  if (!body) throw new Error('EMPTY_CODE');
  try {
    const raw = await apiScanTicket(body);
    const data = unwrapScanPayload(raw);
    if (looksLikeManifest(data)) {
      return normalizeBookingManifest(data, body.codeOrToken);
    }
    const ticket = normalizeScannedTicket(data);
    if (!ticket?.ticketCode && !ticket?.ticketId && !ticket?.codeOrToken) {
      console.error('Scan response không nhận diện được TicketScanDto:', raw);
      throw new Error('INVALID_SCAN_RESPONSE');
    }
    return ticket;
  } catch (error) {
    console.error('Lỗi scan vé:', error);
    throw error;
  }
};

/** QR tổng booking — GET /bookings/manifest/qr/{token} (fallback booking thường). */
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

/** Lookup staff: ưu tiên POST /tickets/scan; BK fallback GET manifest nếu scan lỗi. */
export const lookupTicketOrManifest = async (codeOrToken, options = {}) => {
  const trimmed = String(codeOrToken || '').trim();
  if (!trimmed) throw new Error('EMPTY_CODE');

  try {
    return await scanTicket(trimmed, options);
  } catch (scanError) {
    const upper = trimmed.toUpperCase();
    if (upper.startsWith('BK')) {
      try {
        return await fetchBookingManifestByQr(trimmed);
      } catch {
        throw scanError;
      }
    }
    throw scanError;
  }
};

export const checkInTicket = async (codeOrToken, { source = 'Qr', note } = {}) => {
  const token = assertIndividualTicketToken(codeOrToken);
  const body = buildTicketScanActionBody(token, { source, note });
  if (!body) throw new Error('EMPTY_CODE');
  try {
    return await apiCheckInTicket(body);
  } catch (error) {
    console.error('Lỗi check-in vé:', error);
    throw error;
  }
};

export const checkOutTicket = async (codeOrToken, { source = 'Qr', note } = {}) => {
  const token = assertIndividualTicketToken(codeOrToken);
  const body = buildTicketScanActionBody(token, { source, note });
  if (!body) throw new Error('EMPTY_CODE');
  try {
    return await apiCheckOutTicket(body);
  } catch (error) {
    console.error('Lỗi check-out vé:', error);
    throw error;
  }
};

export const checkInAllBookingManifest = async (bookingQrToken, tripCode) => {
  const trimmed = String(bookingQrToken || '').trim();
  if (!trimmed) throw new Error('EMPTY_CODE');
  if (String(trimmed).toUpperCase().startsWith('CB')) {
    const err = new Error('CHARTER_USE_ATTENDANCE');
    err.code = 'CHARTER_USE_ATTENDANCE';
    throw err;
  }
  try {
    return await apiCheckInAllBookingManifestByQr(trimmed, {
      tripCode: String(tripCode || '').trim() || undefined,
    });
  } catch (error) {
    console.error('Lỗi check-in-all manifest:', error);
    throw error;
  }
};

/** POST /bookings/manifest/qr/{token}/check-out-all (?tripCode= khứ hồi). */
export const checkOutAllBookingManifest = async (bookingQrToken, tripCode) => {
  const trimmed = String(bookingQrToken || '').trim();
  if (!trimmed) throw new Error('EMPTY_CODE');
  if (String(trimmed).toUpperCase().startsWith('CB')) {
    const err = new Error('CHARTER_USE_ATTENDANCE');
    err.code = 'CHARTER_USE_ATTENDANCE';
    throw err;
  }
  try {
    return await apiCheckOutAllBookingManifestByQr(trimmed, {
      tripCode: String(tripCode || '').trim() || undefined,
    });
  } catch (error) {
    console.error('Lỗi check-out-all manifest:', error);
    throw error;
  }
};

/**
 * Charter QR tổng — POST /charter-bookings/manifest/qr/{qrToken}/attendance
 * action: CheckIn | CheckOut · mode: All | Selected (+ ticketIds)
 */
export const updateCharterManifestAttendance = async (
  qrToken,
  { action = 'CheckIn', mode = 'All', ticketIds = [] } = {},
) => {
  const trimmed = String(qrToken || '').trim();
  if (!trimmed) throw new Error('EMPTY_CODE');
  const modeKey = String(mode || 'All');
  const payload = {
    action,
    mode: modeKey,
    ticketIds: null,
  };
  if (modeKey.toLowerCase() === 'selected') {
    payload.ticketIds = (Array.isArray(ticketIds) ? ticketIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean);
  }
  try {
    const data = await apiUpdateCharterAttendance(trimmed, payload);
    return normalizeBookingManifest(data, trimmed);
  } catch (error) {
    console.error('Lỗi attendance charter:', error);
    throw error;
  }
};
