import api from './axios';

/** GET /api/seat-types — danh sách loại ghế + giá gốc. */
export const getSeatTypes = () =>
  api.get('/seat-types').then((response) => response.data);

/** PUT /api/seat-types/{code} — cập nhật giá gốc loại ghế. */
export const updateSeatType = (code, payload) =>
  api.put(`/seat-types/${encodeURIComponent(code)}`, payload).then((response) => response.data);
