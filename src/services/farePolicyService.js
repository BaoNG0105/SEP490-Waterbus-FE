import {
  getFarePolicy as apiGetFarePolicy,
  updateFarePolicy as apiUpdateFarePolicy,
  getFareAdjustments as apiGetFareAdjustments,
  updateWeekendAdjustment as apiUpdateWeekendAdjustment,
  updateCalendarDayAdjustment as apiUpdateCalendarDayAdjustment,
  getEffectiveFareAdjustment as apiGetEffectiveFareAdjustment,
} from '../api/farePolicyApi';

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.adjustments)) return data.adjustments;
  return [];
};

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const normalizeFarePolicy = (raw) => {
  const src = raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw;
  return {
    farePolicyId: src?.farePolicyId || src?.id || null,
    baseFare: Number(src?.baseFare) || 0,
    pricePerKm: Number(src?.pricePerKm) || 0,
    roundingStep: Number(src?.roundingStep) || 1000,
    minFare: toNumberOrNull(src?.minFare),
    currency: src?.currency || 'VND',
    raw: src,
  };
};

export const normalizeFareAdjustment = (item) => {
  const date = String(item?.date || item?.calendarDate || item?.Date || '').slice(0, 10);
  const scope = String(item?.scope || item?.Scope || item?.type || '').trim() || (date ? 'Holiday' : 'Weekend');
  const pctRaw = Number(item?.surchargePercent ?? item?.SurchargePercent);
  return {
    id: item?.id || item?.adjustmentId || `${scope}-${date || 'weekend'}`,
    date,
    scope,
    name: String(item?.name || item?.Name || '').trim(),
    // BE tự làm tròn % (vd 20.126 → 20.13); không còn roundingStep trên phụ thu.
    surchargePercent: Number.isFinite(pctRaw) ? pctRaw : 0,
    isActive: item?.isActive !== false && item?.IsActive !== false,
    raw: item,
  };
};

export const fetchFarePolicy = async () => normalizeFarePolicy(await apiGetFarePolicy());

export const saveFarePolicy = async (form) => {
  const payload = {
    baseFare: Number(form.baseFare) || 0,
    pricePerKm: Number(form.pricePerKm) || 0,
    roundingStep: Number(form.roundingStep) || 1000,
    minFare: toNumberOrNull(form.minFare),
  };
  return normalizeFarePolicy(await apiUpdateFarePolicy(payload));
};

export const fetchFareAdjustments = async () => {
  try {
    const data = await apiGetFareAdjustments();
    return unwrapList(data).map(normalizeFareAdjustment);
  } catch (error) {
    if (error?.response?.status === 404) return [];
    throw error;
  }
};

export const saveWeekendAdjustment = async (form) => {
  const payload = {
    surchargePercent: Number(form.surchargePercent) || 0,
    isActive: form.isActive !== false,
  };
  return normalizeFareAdjustment(await apiUpdateWeekendAdjustment(payload));
};

export const saveCalendarDayAdjustment = async (form) => {
  const payload = {
    date: String(form.date || '').trim(),
    scope: String(form.scope || 'Holiday').trim() || 'Holiday',
    name: String(form.name || '').trim(),
    surchargePercent: Number(form.surchargePercent) || 0,
    isActive: form.isActive !== false,
  };
  return normalizeFareAdjustment(await apiUpdateCalendarDayAdjustment(payload));
};

export const fetchEffectiveFareAdjustment = async (date) => {
  try {
    const data = await apiGetEffectiveFareAdjustment(date);
    if (!data) return null;
    if (data?.data && typeof data.data === 'object') return normalizeFareAdjustment(data.data);
    return normalizeFareAdjustment(data);
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};
