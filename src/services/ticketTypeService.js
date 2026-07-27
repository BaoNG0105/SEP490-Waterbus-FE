import {
  getTicketTypes as apiGetTicketTypes,
  getTicketFareRules as apiGetTicketFareRules,
  putTicketFareRule as apiPutTicketFareRule,
  getSightseeingConcession as apiGetSightseeingConcession,
  putSightseeingConcession as apiPutSightseeingConcession,
} from '../api/ticketTypeApi';

export const FARE_RULE_ROUTE_TYPES = {
  REGULAR: 'Regular',
  SIGHTSEEING: 'SightseeingLoop',
};

export const FARE_RULE_TICKET_CODES = ['ADULT', 'CHILD', 'INFANT', 'SENIOR', 'DISABLED'];

/** Gợi ý hiển thị — giá trị vẫn lấy từ BE, không hardcode khi tính tiền. */
export const PRICE_MODIFIER_HINTS = [
  { value: 1, vn: 'Nguyên giá', en: 'Full price' },
  { value: 0.5, vn: 'Giảm 50%', en: '50% off' },
  { value: 0, vn: 'Miễn phí', en: 'Free' },
];

// Fallback khi API lỗi — không dùng làm nguồn sự thật khi BE còn sống.
export const DEFAULT_TICKET_TYPES = [
  { code: 'ADULT', name: 'Người lớn', priceModifier: 1, sightseeingPriceModifier: 1, allowedSeatTypeCodes: null },
  { code: 'CHILD', name: 'Trẻ em', priceModifier: 0.5, sightseeingPriceModifier: 0.5, allowedSeatTypeCodes: null },
  { code: 'INFANT', name: 'Em bé', priceModifier: 0, sightseeingPriceModifier: 0, allowedSeatTypeCodes: null },
  { code: 'SENIOR', name: 'Người cao tuổi', priceModifier: 0, sightseeingPriceModifier: 0, allowedSeatTypeCodes: null },
  { code: 'DISABLED', name: 'Người khuyết tật', priceModifier: 0, sightseeingPriceModifier: 0, allowedSeatTypeCodes: null },
];

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rules)) return data.rules;
  return [];
};

// BE trả field ticketTypeCode/ticketTypeName (swagger cũ ghi code/name) — nhận cả hai.
const normalizeTicketType = (item) => ({
  code: String(item?.ticketTypeCode || item?.code || '').toUpperCase(),
  name: item?.ticketTypeName || item?.name || item?.ticketTypeCode || item?.code || '--',
  description: item?.description || '',
  priceModifier: Number(item?.priceModifier ?? 1),
  sightseeingPriceModifier: Number(
    item?.sightseeingPriceModifier ?? item?.priceModifier ?? 1,
  ),
  // null = ngồi được mọi loại ghế; ["STANDARD"] = chỉ ghế Standard
  allowedSeatTypeCodes: Array.isArray(item?.allowedSeatTypeCodes)
    ? item.allowedSeatTypeCodes.map((c) => String(c).toUpperCase())
    : null,
});

/**
 * Chọn hệ số theo routeType — không hardcode giảm giá.
 * SightseeingLoop → sightseeingPriceModifier; còn lại → priceModifier.
 */
export const resolveTicketPriceModifier = (ticketType, routeType) => {
  if (!ticketType) return String(routeType) === FARE_RULE_ROUTE_TYPES.SIGHTSEEING ? 0 : 1;
  if (String(routeType) === FARE_RULE_ROUTE_TYPES.SIGHTSEEING) {
    const n = Number(ticketType.sightseeingPriceModifier);
    return Number.isFinite(n) ? n : Number(ticketType.priceModifier) || 0;
  }
  const n = Number(ticketType.priceModifier);
  return Number.isFinite(n) ? n : 0;
};

export const fetchTicketTypes = async () => {
  try {
    const data = await apiGetTicketTypes();
    const normalized = unwrapList(data).map(normalizeTicketType).filter((t) => t.code);
    return normalized.length > 0 ? normalized : DEFAULT_TICKET_TYPES;
  } catch (error) {
    console.error('Lỗi khi lấy danh sách loại vé:', error);
    return DEFAULT_TICKET_TYPES;
  }
};

export const normalizeTicketFareRule = (item) => {
  if (!item) return null;
  const ticketTypeCode = String(item.ticketTypeCode || item.code || '').toUpperCase();
  const routeType = String(item.routeType || FARE_RULE_ROUTE_TYPES.REGULAR);
  return {
    ticketFareRuleId: String(item.ticketFareRuleId || item.id || `${ticketTypeCode}-${routeType}`),
    ticketTypeCode,
    ticketTypeName: item.ticketTypeName || item.name || ticketTypeCode || '—',
    routeType,
    priceModifier: Number(item.priceModifier ?? 1),
    isActive: item.isActive !== false && item.IsActive !== false,
    raw: item,
  };
};

export const fetchTicketFareRules = async () => {
  try {
    const data = await apiGetTicketFareRules();
    return unwrapList(data).map(normalizeTicketFareRule).filter(Boolean);
  } catch (error) {
    // Azure BE có lúc lỗi 500 ở fare-rules dù GET /ticket-types vẫn là nguồn
    // hiện hành của priceModifier/sightseeingPriceModifier. Dùng nguồn đó để
    // trang chính sách giá không bị trống; PUT fare-rules vẫn là API lưu.
    console.warn('Không tải được fare-rules, dùng hệ số từ ticket-types:', error);
    const ticketTypes = await fetchTicketTypes();
    return ticketTypes.flatMap((ticketType) => [
      normalizeTicketFareRule({
        ticketFareRuleId: `${ticketType.code}-${FARE_RULE_ROUTE_TYPES.REGULAR}`,
        ticketTypeCode: ticketType.code,
        ticketTypeName: ticketType.name,
        routeType: FARE_RULE_ROUTE_TYPES.REGULAR,
        priceModifier: ticketType.priceModifier,
        isActive: true,
      }),
      normalizeTicketFareRule({
        ticketFareRuleId: `${ticketType.code}-${FARE_RULE_ROUTE_TYPES.SIGHTSEEING}`,
        ticketTypeCode: ticketType.code,
        ticketTypeName: ticketType.name,
        routeType: FARE_RULE_ROUTE_TYPES.SIGHTSEEING,
        priceModifier: ticketType.sightseeingPriceModifier,
        isActive: true,
      }),
    ].filter(Boolean));
  }
};

export const saveTicketFareRule = async (form) => {
  const payload = {
    ticketTypeCode: String(form.ticketTypeCode || '').trim().toUpperCase(),
    routeType: String(form.routeType || FARE_RULE_ROUTE_TYPES.REGULAR).trim(),
    priceModifier: Number(form.priceModifier),
    isActive: form.isActive !== false,
  };
  const data = await apiPutTicketFareRule(payload);
  return normalizeTicketFareRule(data?.data && typeof data.data === 'object' ? data.data : data) || {
    ...payload,
    ticketFareRuleId: form.ticketFareRuleId || `${payload.ticketTypeCode}-${payload.routeType}`,
    ticketTypeName: form.ticketTypeName || payload.ticketTypeCode,
  };
};

/** Nhóm được giảm giá trên tuyến tham quan khi BE chưa trả ticketTypeCodes. */
export const DEFAULT_SIGHTSEEING_CONCESSION_CODES = ['CHILD', 'SENIOR', 'DISABLED'];

const clampDiscountPercent = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

export const normalizeSightseeingConcession = (item) => {
  const source = item?.data && typeof item.data === 'object' ? item.data : item;
  const rawPercent = source?.discountPercent ?? source?.DiscountPercent;
  const rawModifier = source?.priceModifier ?? source?.PriceModifier;
  const discountPercent = rawPercent !== undefined && rawPercent !== null
    ? clampDiscountPercent(rawPercent)
    : clampDiscountPercent((1 - (Number(rawModifier) || 0)) * 100);
  const codes = source?.ticketTypeCodes ?? source?.TicketTypeCodes;

  return {
    discountPercent,
    priceModifier: (100 - discountPercent) / 100,
    ticketTypeCodes: Array.isArray(codes) && codes.length > 0
      ? codes.map((code) => String(code).toUpperCase())
      : DEFAULT_SIGHTSEEING_CONCESSION_CODES,
    routeType: source?.routeType || FARE_RULE_ROUTE_TYPES.SIGHTSEEING,
  };
};

/** Suy % giảm từ /ticket-types khi endpoint concession chưa có trên BE. */
const deriveConcessionFromTicketTypes = async () => {
  const ticketTypes = await fetchTicketTypes();
  const concessionType = ticketTypes.find((item) =>
    DEFAULT_SIGHTSEEING_CONCESSION_CODES.includes(item.code));
  return normalizeSightseeingConcession({
    priceModifier: concessionType ? concessionType.sightseeingPriceModifier : 1,
    ticketTypeCodes: DEFAULT_SIGHTSEEING_CONCESSION_CODES,
  });
};

export const fetchSightseeingConcession = async () => {
  try {
    return normalizeSightseeingConcession(await apiGetSightseeingConcession());
  } catch (error) {
    console.warn('Không tải được sightseeing-concession, suy từ ticket-types:', error);
    return deriveConcessionFromTicketTypes();
  }
};

export const saveSightseeingConcession = async (discountPercent) => {
  const percent = clampDiscountPercent(discountPercent);
  const data = await apiPutSightseeingConcession(percent);
  return normalizeSightseeingConcession(data ?? { discountPercent: percent });
};
