/**
 * Dấu sao đỏ cho trường bắt buộc — dùng: <RequiredStar />.
 * để file này chỉ export component — giữ đúng quy tắc Fast Refresh.
 */
export const RequiredStar = () => (
  <span className="text-red-500 font-bold ml-0.5" aria-hidden>*</span>
);