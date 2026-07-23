import api from './axios';

/** GET /api/fare-policy — công thức giá theo quãng đường (Regular / STANDARD). */
export const getFarePolicy = () =>
  api.get('/fare-policy').then((response) => response.data);

/** PUT /api/fare-policy — chỉnh baseFare / pricePerKm / roundingStep / minFare. */
export const updateFarePolicy = (payload) =>
  api.put('/fare-policy', payload).then((response) => response.data);

/** GET /api/fare-policy/adjustments — danh sách phụ thu (weekend + ngày đặc biệt). */
export const getFareAdjustments = () =>
  api.get('/fare-policy/adjustments').then((response) => response.data);

/** PUT /api/fare-policy/adjustments/weekend — cấu hình phụ thu cuối tuần. */
export const updateWeekendAdjustment = (payload) =>
  api.put('/fare-policy/adjustments/weekend', payload).then((response) => response.data);

/** PUT /api/fare-policy/adjustments/calendar-day — đánh dấu ngày lễ / đặc biệt. */
export const updateCalendarDayAdjustment = (payload) =>
  api.put('/fare-policy/adjustments/calendar-day', payload).then((response) => response.data);

/** GET /api/fare-policy/adjustments/effective?date=YYYY-MM-DD — phụ thu đang áp dụng. */
export const getEffectiveFareAdjustment = (date) =>
  api.get('/fare-policy/adjustments/effective', { params: { date } }).then((response) => response.data);
