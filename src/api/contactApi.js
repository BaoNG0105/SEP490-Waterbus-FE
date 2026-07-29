import api from './axios';

/**
 * Gửi form liên hệ.
 * Ưu tiên BE (nếu có): POST /contact
 * Fallback: FormSubmit → email cấu hình (mặc định COMPANY_EMAIL).
 */
export const postContactMessage = (payload) =>
  api.post('/contact', payload, { skipAuth: true }).then((response) => response.data);
