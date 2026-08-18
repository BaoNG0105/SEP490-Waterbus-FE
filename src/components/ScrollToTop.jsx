import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Số lần thử tìm lại phần tử đích khi hash trỏ tới 1 section — trang mới (đặc biệt là Home,
// vốn khá nặng) có thể chưa kịp mount xong section đó ngay khi effect này chạy.
const HASH_SCROLL_RETRY_MS = 80;
const HASH_SCROLL_MAX_RETRIES = 15;

// Tự động cuộn lên đầu trang mỗi khi chuyển route (đổi pathname), tránh việc trang mới hiển thị
// ở vị trí scroll cũ của trang trước. Riêng khi URL đích có hash (VD: "/#services-section", dùng
// bởi các nút CTA điều hướng sang 1 section cụ thể của trang khác) thì cuộn tới đúng section đó
// thay vì cuộn lên đầu.
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }

    const targetId = hash.replace(/^#/, "");
    let attempts = 0;
    let timer;

    const tryScroll = () => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      attempts += 1;
      if (attempts < HASH_SCROLL_MAX_RETRIES) {
        timer = setTimeout(tryScroll, HASH_SCROLL_RETRY_MS);
      }
    };
    tryScroll();

    return () => clearTimeout(timer);
  }, [pathname, hash]);

  return null;
}
