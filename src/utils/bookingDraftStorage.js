// Lưu tạm tiến trình Step 1-2 (tuyến/chuyến/ghế đã chọn) của wizard đặt vé Waterbus/Sightseeing
// vào sessionStorage, để F5 reload không mất lựa chọn (location.state bị mất khi hard reload).
// Dùng sessionStorage (không phải localStorage) — tự dọn khi đóng tab, tránh giữ draft cũ vô thời hạn.

const isBrowser = typeof window !== "undefined";

export const readBookingDraft = (storageKey) => {
  if (!isBrowser) return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const writeBookingDraft = (storageKey, data) => {
  if (!isBrowser) return;
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // sessionStorage đầy/không khả dụng — bỏ qua, không phải lỗi nghiêm trọng.
  }
};

export const clearBookingDraft = (storageKey) => {
  if (!isBrowser) return;
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
};
