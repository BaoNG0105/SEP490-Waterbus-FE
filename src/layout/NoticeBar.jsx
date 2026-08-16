import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../context/AppContext"; 
import { fetchNotifications, markNotificationRead, NOTIFICATION_READ_EVENT } from "../services/notificationService";
import { normalizeNotification, resolveNotificationLink } from "../utils/notifications";

const POLL_INTERVAL_MS = 60000;

export const NoticeBar = ({ isVisible, setVisible }) => {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);

  const [notifications, setNotifications] = useState([]);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setIsLoaded(true);
      return;
    }
    // Tab ẩn (treo qua đêm) / mất mạng: bỏ lượt poll — tránh spam ETIMEDOUT lên BE Azure.
    if (typeof document !== "undefined" && document.hidden) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    try {
      const list = await fetchNotifications({ page: 1, pageSize: 5, unreadOnly: true });
      const items = Array.isArray(list?.items) ? list.items.map(normalizeNotification) : [];
      setNotifications(items);
    } catch (error) {
      console.error("Lỗi tải thông báo:", error);
    } finally {
      setIsLoaded(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadNotifications();
    const poll = setInterval(loadNotifications, POLL_INTERVAL_MS);
    // Quay lại tab thì refresh ngay cho kịp thông báo mới.
    const onVisible = () => {
      if (!document.hidden) loadNotifications();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadNotifications]);

  // Không có thông báo (khách chưa đăng nhập hoặc user không có tin nào) thì tự ẩn thanh
  useEffect(() => {
    if (isLoaded && isVisible && notifications.length === 0) {
      setVisible(false);
    }
  }, [isLoaded, notifications.length, isVisible, setVisible]);

  useEffect(() => {
    setNoticeIndex(0);
  }, [notifications.length]);

  useEffect(() => {
    if (!isVisible || notifications.length <= 1) return;
    const timer = setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % notifications.length);
    }, 12000);
    return () => clearInterval(timer);
  }, [isVisible, notifications.length]);

  const nextNotice = () => setNotifications((current) => {
    if (current.length > 0) setNoticeIndex((prev) => (prev + 1) % current.length);
    return current;
  });
  const prevNotice = () => setNotifications((current) => {
    if (current.length > 0) setNoticeIndex((prev) => (prev === 0 ? current.length - 1 : prev - 1));
    return current;
  });

  const goToNotifications = () => navigate("/notifications");

  const handleNoticeClick = async () => {
    const current = notifications[noticeIndex];
    if (!current) return;

    try {
      // markNotificationRead phát sự kiện NOTIFICATION_READ_EVENT khi thành công — listener bên dưới
      // sẽ tự bỏ mục này khỏi danh sách, nên không cập nhật state trùng lặp ở đây.
      await markNotificationRead(current.id);
    } catch (error) {
      console.error("Lỗi đánh dấu đã đọc:", error);
    }

    navigate(resolveNotificationLink(current) || "/notifications");
  };

  // Đồng bộ với trang Thông báo (và với chính thanh này): bất cứ khi nào có thông báo được
  // đánh dấu đã đọc (một cái hoặc tất cả), cập nhật ngay mà không cần đợi tới lượt poll kế tiếp.
  useEffect(() => {
    const onExternalRead = (event) => {
      const { id, all } = event.detail || {};
      if (all) {
        setNotifications([]);
        return;
      }
      if (id == null) return;
      setNotifications((prev) => {
        if (!prev.some((n) => n.id === id)) return prev;
        return prev.filter((n) => n.id !== id);
      });
    };
    window.addEventListener(NOTIFICATION_READ_EVENT, onExternalRead);
    return () => window.removeEventListener(NOTIFICATION_READ_EVENT, onExternalRead);
  }, []);

  if (!isVisible) return null;
  if (isLoaded && notifications.length === 0) return null;

  const current = notifications[noticeIndex];

  return (
    <div className="fixed top-0 left-0 w-full h-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/80 z-120 flex items-center justify-between px-4 md:px-8 shadow-sm transition-colors duration-300 select-none">

      {/* Icon trạng thái nhấp nháy */}
      <button
        type="button"
        onClick={goToNotifications}
        title={lang === "VN" ? "Xem tất cả thông báo" : "View all notifications"}
        className="relative flex items-center shrink-0 z-10 bg-white dark:bg-slate-900 py-2 pr-3"
      >
        <span className="material-symbols-outlined text-red-600 dark:text-red-500 text-[18px] animate-pulse">
          notifications_active
        </span>
      </button>

      {/* Hiệu ứng chữ chạy Marquee */}
      <div className="flex-1 relative h-full flex items-center overflow-hidden group">
        <style>{`
          @keyframes text-ticker {
            0% { left: 100%; transform: translateX(0); }
            100% { left: 0; transform: translateX(-100%); }
          }
          .animate-ticker {
            position: absolute;
            white-space: nowrap;
            animation: text-ticker 15s linear infinite;
          }
        `}</style>

        {current && (
          <p
            key={current.id || noticeIndex}
            onClick={handleNoticeClick}
            className="text-xs md:text-sm font-body font-medium text-slate-700 dark:text-slate-300 animate-ticker group-hover:[animation-play-state:paused] cursor-pointer"
          >
            {!current.isRead && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-2 align-middle" />}
            <span className="font-bold">{current.title}</span>
            {current.body ? ` — ${current.body}` : ""}
          </p>
        )}
      </div>

      {/* Các nút bấm điều khiển */}
      <div className="flex items-center gap-1 shrink-0 ml-4 z-10 bg-white dark:bg-slate-900 pl-2">
        <button onClick={prevNotice} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
        <button onClick={nextNotice} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>

        <div className="w-1px h-4 bg-slate-200 dark:bg-slate-700 mx-1 md:mx-2"></div>

        <button
          onClick={() => setVisible(false)}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};
