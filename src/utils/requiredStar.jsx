/**
 * Dấu sao đỏ cho trường bắt buộc.
 * Dùng: {required()} sau label.
 */
export const required = () => (
  <span className="text-red-500 font-bold ml-0.5" aria-hidden>*</span>
);

/** Component đứng riêng khi cần. */
export const RequiredStar = () => (
  <span className="text-red-500 font-bold ml-0.5" aria-hidden>*</span>
);