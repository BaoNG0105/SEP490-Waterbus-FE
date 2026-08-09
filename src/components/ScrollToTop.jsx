import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Tự động cuộn lên đầu trang mỗi khi chuyển route (đổi pathname),
// tránh việc trang mới hiển thị ở vị trí scroll cũ của trang trước.
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
