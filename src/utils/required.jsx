/**
 * Dấu sao đỏ cho trường bắt buộc — dùng: {required()} sau label.
 * giữ đúng quy tắc Fast Refresh "chỉ export component".
 */
export const required = () => (
  <span className="text-red-500 font-bold ml-0.5" aria-hidden>*</span>
);