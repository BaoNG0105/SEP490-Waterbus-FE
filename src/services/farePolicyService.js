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

const unwrapEntity = (raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) return raw.data;
  if (raw.adjustment && typeof raw.adjustment === 'object') return raw.adjustment;
  if (raw.result && typeof raw.result === 'object' && !Array.isArray(raw.result)) return raw.result;
  return raw;
};

const pickFirstText = (...values) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const pickIsActive = (item) => {
  const candidates = [item?.isActive, item?.IsActive, item?.active, item?.Active];
  for (const value of candidates) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const s = value.trim().toLowerCase();
      if (['true', '1', 'active', 'on', 'enabled', 'bật'].includes(s)) return true;
      if (['false', '0', 'inactive', 'off', 'disabled', 'tắt'].includes(s)) return false;
    }
  }
  const status = String(item?.status || item?.Status || '').trim().toLowerCase();
  if (['inactive', 'off', 'disabled', 'tắt'].includes(status)) return false;
  if (['active', 'on', 'enabled', 'bật'].includes(status)) return true;
  // Thiếu field → mặc định bật (khớp payload tạo mới).
  return true;
};

export const normalizeFarePolicy = (raw) => {
  const src = unwrapEntity(raw);
  return {
    farePolicyId: src?.farePolicyId || src?.id || null,
    baseFare: Number(src?.baseFare) || 0,
    pricePerKm: Number(src?.pricePerKm) || 0,
    roundingStep: Number(src?.roundingStep) || 1000,
    currency: src?.currency || 'VND',
    raw: src,
  };
};

export const normalizeFareAdjustment = (item) => {
  const src = unwrapEntity(item) || {};
  const date = String(src?.date || src?.calendarDate || src?.Date || src?.CalendarDate || '').slice(0, 10);
  const scope = String(src?.scope || src?.Scope || src?.type || src?.Type || '').trim() || (date ? 'Holiday' : 'Weekend');
  const pctRaw = Number(src?.surchargePercent ?? src?.SurchargePercent ?? src?.percent ?? src?.Percent);
  const name = pickFirstText(
    src?.name,
    src?.Name,
    src?.holidayName,
    src?.HolidayName,
    src?.title,
    src?.Title,
    src?.label,
    src?.Label,
    src?.displayName,
    src?.DisplayName,
  );
  return {
    id: src?.id || src?.adjustmentId || src?.fareAdjustmentId || `${scope}-${date || 'weekend'}`,
    date,
    scope,
    name,
    // BE tự làm tròn % (vd 20.126 → 20.13); không còn roundingStep trên phụ thu.
    surchargePercent: Number.isFinite(pctRaw) ? pctRaw : 0,
    isActive: pickIsActive(src),
    raw: src,
  };
};

export const fetchFarePolicy = async () => normalizeFarePolicy(await apiGetFarePolicy());

export const saveFarePolicy = async (form) => {
  const step = Number(form.roundingStep);
  const payload = {
    baseFare: Number(form.baseFare) || 0,
    pricePerKm: Number(form.pricePerKm) || 0,
    roundingStep: Number.isFinite(step) && step > 0 ? step : 1000,
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
    isActive: form.isActive === true || form.isActive === 'true' || form.isActive === 1,
  };
  const saved = normalizeFareAdjustment(await apiUpdateWeekendAdjustment(payload));
  return {
    ...saved,
    surchargePercent: Number.isFinite(Number(saved.surchargePercent)) ? saved.surchargePercent : payload.surchargePercent,
    isActive: payload.isActive,
  };
};

export const saveCalendarDayAdjustment = async (form) => {
  const payload = {
    date: String(form.date || '').trim(),
    scope: 'Holiday',
    name: String(form.name || '').trim(),
    surchargePercent: Number(form.surchargePercent) || 0,
    isActive: form.isActive === true || form.isActive === 'true' || form.isActive === 1,
  };
  const saved = normalizeFareAdjustment(await apiUpdateCalendarDayAdjustment(payload));
  // Ưu tiên giá trị vừa gửi nếu GET/PUT response thiếu name / isActive.
  return {
    ...saved,
    date: saved.date || payload.date,
    scope: saved.scope || payload.scope,
    name: saved.name && !/^holiday\s+\d{4}-\d{2}-\d{2}$/i.test(saved.name) ? saved.name : payload.name,
    surchargePercent: Number.isFinite(Number(saved.surchargePercent)) ? saved.surchargePercent : payload.surchargePercent,
    isActive: payload.isActive,
  };
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
