import {
  getSeatTypes as apiGetSeatTypes,
  updateSeatType as apiUpdateSeatType,
} from '../api/seatTypeApi';

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.seatTypes)) return data.seatTypes;
  return [];
};

/** STANDARD / DistanceFareForRegular — giá theo km, không sửa tại /api/seat-types. */
export const isDistanceFareSeatType = (row) => {
  const mode = String(row?.pricingMode || row?.raw?.pricingMode || '').trim();
  if (/DistanceFare/i.test(mode)) return true;
  const code = String(row?.code || '').trim().toUpperCase();
  return code === 'STANDARD';
};

export const normalizeSeatType = (item) => {
  const code = String(item?.code || item?.seatTypeCode || item?.SeatTypeCode || '').trim().toUpperCase();
  const name = String(
    item?.name
    || item?.seatTypeName
    || item?.displayName
    || item?.Name
    || code
    || '—',
  ).trim();
  const priceRaw = item?.basePrice ?? item?.BasePrice ?? item?.price ?? item?.Price;
  const basePrice = Number(priceRaw);
  const pricingMode = String(
    item?.pricingMode || item?.PricingMode || item?.farePricingMode || '',
  ).trim() || (code === 'STANDARD' ? 'DistanceFareForRegular' : '');
  return {
    code,
    name,
    basePrice: Number.isFinite(basePrice) ? basePrice : 0,
    pricingMode,
    priceEditable: !isDistanceFareSeatType({ code, pricingMode }),
    raw: item,
  };
};

export const saveSeatTypeBasePrice = async (code, basePrice) => {
  const price = Number(basePrice);
  if (!code) throw new Error('Missing seat type code');
  if (!Number.isFinite(price) || price < 0) throw new Error('Invalid base price');
  if (isDistanceFareSeatType({ code })) {
    throw new Error('STANDARD uses distance fare — edit /api/fare-policy instead');
  }
  const data = await apiUpdateSeatType(String(code).trim().toUpperCase(), { basePrice: price });
  return normalizeSeatType(data?.data && typeof data.data === 'object' ? data.data : data);
};

export const fetchSeatTypes = async () => {
  const data = await apiGetSeatTypes();
  return unwrapList(data)
    .map(normalizeSeatType)
    .filter((row) => row.code)
    .sort((a, b) => a.code.localeCompare(b.code));
};
