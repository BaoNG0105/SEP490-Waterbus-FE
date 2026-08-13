import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fetchUnreadNotificationCount, NOTIFICATION_READ_EVENT } from "../../services/notificationService";
import "flag-icons/css/flag-icons.min.css";

// Cùng nhịp poll với NoticeBar bên client, tránh spam request lên BE.
const POLL_INTERVAL_MS = 60000;

export const AdminHeader = ({ onMenuClick, title = "Dashboard", isSidebarCollapsed = false, onToggleSidebar }) => {
  // Lấy các state và hàm từ AppContext
  const { isDarkMode, toggleDarkMode, lang, toggleLang } = useApp();
  const langFlagCode = lang === "VN" ? "vn" : "gb";
  const localizedTitle = typeof title === "object"
    ? (lang === "VN" ? title.vn : title.en)
    : title;

  // Số thông báo chưa đọc — hiện badge đỏ trên nút chuông
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    try {
      const data = await fetchUnreadNotificationCount();
      setUnreadCount(Number(data?.unreadCount ?? 0));
    } catch (error) {
      console.error("Lỗi tải số thông báo chưa đọc:", error);
    }
  }, []);

  useEffect(() => {
    // Gọi ngay lúc mount để có badge kịp thời; loadUnreadCount chỉ setState sau khi await xong
    // (không đồng bộ trong thân effect) nên an toàn, không gây render dồn dập.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUnreadCount();
    const poll = setInterval(loadUnreadCount, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) loadUnreadCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadUnreadCount]);

  // Đồng bộ ngay khi trang /admin/notifications đánh dấu đã đọc, không cần đợi tới lượt poll kế tiếp.
  useEffect(() => {
    const onExternalRead = (event) => {
      const { all, id } = event.detail || {};
      if (all) {
        setUnreadCount(0);
        return;
      }
      if (id != null) setUnreadCount((prev) => Math.max(0, prev - 1));
    };
    window.addEventListener(NOTIFICATION_READ_EVENT, onExternalRead);
    return () => window.removeEventListener(NOTIFICATION_READ_EVENT, onExternalRead);
  }, []);

  return (
    <header className="fixed top-0 w-full z-40 flex justify-between items-center px-6 h-16 bg-[#124757] dark:bg-slate-900/80 text-white dark:text-slate-200 backdrop-blur-xl shadow-md border-b border-white/10 dark:border-slate-700 transition-colors duration-300">

      {/* KHỐI TRÁI & GIỮA: Tự động lùi sang phải một khoảng lg:pl-60 trên Desktop để nhường chỗ cho Sidebar cố định (bỏ khoảng lùi khi Sidebar đang thu gọn) */}
      <div className={`flex items-center gap-4 transition-all duration-300 ${isSidebarCollapsed ? "lg:pl-4" : "lg:pl-60"}`}>

        {/* Nút mở Menu Drawer - Chỉ xuất hiện trên giao diện Mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-white/10 dark:hover:bg-slate-800 rounded-xl text-white transition-colors"
          title={lang === "VN" ? "Mở menu" : "Open menu"}
          aria-label={lang === "VN" ? "Mở menu" : "Open menu"}
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">menu</span>
        </button>

        {/* Nút thu gọn/mở rộng Sidebar - Chỉ xuất hiện trên giao diện Desktop */}
        <button
          onClick={onToggleSidebar}
          className="hidden lg:inline-flex p-2 hover:bg-white/10 dark:hover:bg-slate-800 rounded-xl text-white transition-colors"
          title={
            isSidebarCollapsed
              ? (lang === "VN" ? "Mở Sidebar" : "Expand sidebar")
              : (lang === "VN" ? "Thu gọn Sidebar" : "Collapse sidebar")
          }
          aria-label={
            isSidebarCollapsed
              ? (lang === "VN" ? "Mở Sidebar" : "Expand sidebar")
              : (lang === "VN" ? "Thu gọn Sidebar" : "Collapse sidebar")
          }
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
            {isSidebarCollapsed ? "menu" : "menu_open"}
          </span>
        </button>

        {/* Tiêu đề trang: Sẽ đứng ngay cạnh mép phải của Sidebar trên Desktop */}
        <div className="flex items-center">
          <h1 className="font-headline font-black text-sm sm:text-base md:text-lg uppercase tracking-wider text-white dark:text-yellow-400 select-none whitespace-nowrap">
            {localizedTitle}
          </h1>
        </div>
      </div>

      {/* KHỐI PHẢI: Các nút cấu hình hệ thống nhanh (Thông báo, Darkmode, Ngôn ngữ, Đăng xuất) */}
      <div className="flex items-center gap-2">
        {/* Nút Thông báo: badge đỏ hiện số thông báo chưa đọc */}
        <Link
          to="/admin/notifications"
          className="relative w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 dark:text-yellow-400 dark:hover:bg-slate-800 transition-colors"
          title={lang === "VN" ? "Thông báo" : "Notifications"}
          aria-label={lang === "VN" ? "Thông báo" : "Notifications"}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        {/* Nút Toggle Dark Mode */}
        <button
          onClick={toggleDarkMode}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 dark:text-yellow-400 dark:hover:bg-slate-800 transition-colors"
          title={
            isDarkMode
              ? lang === "VN" ? "Chế độ Sáng" : "Light Mode"
              : lang === "VN" ? "Chế độ Tối" : "Dark Mode"
          }
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            {isDarkMode ? "light_mode" : "dark_mode"}
          </span>
        </button>

        {/* Nút Toggle Language: hiện icon cờ quốc gia thay vì chữ */}
        <button
          onClick={toggleLang}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 dark:hover:bg-slate-800 transition-colors"
          title={lang === "VN" ? "Đổi ngôn ngữ" : "Change Language"}
          aria-label={lang === "VN" ? "Đổi ngôn ngữ" : "Change Language"}
        >
          <span
            className={`fi fi-${langFlagCode} block! h-3.5 w-5 shrink-0 rounded-xs shadow-sm`}
            aria-hidden="true"
          />
        </button>

        {/* Vạch chia ngăn cách */}
        <div className="hidden md:block w-1px h-5 bg-white/20 dark:bg-slate-700 mx-1"></div>

        {/* Nút Đăng xuất tài khoản Admin */}
        <Link
          to="/"
          className="p-2 text-white/80 hover:text-red-400 hover:bg-white/10 dark:hover:bg-red-500/20 dark:hover:text-red-400 rounded-full transition-all flex items-center justify-center"
          title={lang === "VN" ? "Đăng xuất" : "Logout"}
          aria-label={lang === "VN" ? "Đăng xuất" : "Logout"}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">power_settings_new</span>
        </Link>
      </div>
    </header>
  );
};
