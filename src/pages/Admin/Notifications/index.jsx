import { useCallback, useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { notify } from "../../../utils/swalToast";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../../services/notificationService";
import {
  normalizeNotification,
  getNotificationTypeMeta,
  NOTIFICATION_COLOR_CLASSES,
  formatNotificationTime,
} from "../../../utils/notifications";

const PAGE_SIZE = 10;

const ListSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((item) => (
      <div key={item} className="animate-pulse rounded-3xl border border-slate-100 bg-white p-5 dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex gap-4">
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-40 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-2/3 rounded-lg bg-slate-100 dark:bg-slate-700/70" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export function AdminNotifications() {
  const { lang } = useApp();

  const [notifications, setNotifications] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const data = await fetchNotifications({ page, pageSize: PAGE_SIZE, unreadOnly });
      const items = Array.isArray(data?.items) ? data.items.map(normalizeNotification) : [];
      setNotifications(items);
      setTotalCount(Number(data?.totalCount ?? items.length));
      setUnreadCount(Number(data?.unreadCount ?? 0));
    } catch (error) {
      console.error("Lỗi tải danh sách thông báo:", error);
      setErrorMsg(error.response?.data?.message || (lang === "VN" ? "Không thể tải danh sách thông báo." : "Unable to load notifications."));
    } finally {
      setIsLoading(false);
    }
  }, [page, unreadOnly, lang]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleFilterChange = (nextUnreadOnly) => {
    if (nextUnreadOnly === unreadOnly) return;
    setUnreadOnly(nextUnreadOnly);
    setPage(1);
  };

  const handleNotificationClick = async (item) => {
    if (item.isRead) return;
    try {
      await markNotificationRead(item.id);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Lỗi đánh dấu đã đọc:", error);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    try {
      setIsMarkingAll(true);
      const result = await markAllNotificationsRead();
      notify({
        toast: true,
        icon: "success",
        title: lang === "VN"
          ? `Đã đánh dấu ${result?.markedCount ?? unreadCount} thông báo là đã đọc`
          : `Marked ${result?.markedCount ?? unreadCount} notifications as read`,
      });
      await loadNotifications();
    } catch (error) {
      console.error("Lỗi đánh dấu tất cả đã đọc:", error);
      notify({
        toast: true,
        icon: "error",
        title: lang === "VN" ? "Không thể đánh dấu tất cả đã đọc" : "Unable to mark all as read",
      });
    } finally {
      setIsMarkingAll(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const emptyMessage = unreadOnly
    ? (lang === "VN" ? "Không có thông báo chưa đọc nào." : "No unread notifications.")
    : (lang === "VN" ? "Chưa có thông báo nào." : "No notifications yet.");

  const tabClass = (active) => `px-4 py-2.5 rounded-xl text-xs font-headline font-black uppercase tracking-widest transition-colors ${
    active
      ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
      : "bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
  }`;

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Thông báo" : "Notifications"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? `Bạn có ${unreadCount} thông báo chưa đọc.`
              : `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || isMarkingAll}
          className="rounded-xl bg-[#FFD100] px-5 py-3 font-headline text-xs font-black uppercase tracking-widest text-slate-900 shadow-sm transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {isMarkingAll
            ? (lang === "VN" ? "Đang xử lý..." : "Processing...")
            : (lang === "VN" ? "Đánh dấu tất cả đã đọc" : "Mark all as read")}
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => handleFilterChange(false)} className={tabClass(!unreadOnly)}>
          {lang === "VN" ? "Tất cả" : "All"}
        </button>
        <button type="button" onClick={() => handleFilterChange(true)} className={tabClass(unreadOnly)}>
          {lang === "VN" ? `Chưa đọc (${unreadCount})` : `Unread (${unreadCount})`}
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <ListSkeleton />
        ) : notifications.length === 0 ? (
          <div className="rounded-4xl border border-dashed border-slate-200 bg-white p-16 text-center dark:border-slate-700 dark:bg-slate-800">
            <p className="font-headline text-lg font-black text-slate-500 dark:text-slate-300">{emptyMessage}</p>
          </div>
        ) : (
          notifications.map((item) => {
            const meta = getNotificationTypeMeta(item.type);
            return (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") handleNotificationClick(item);
                }}
                className={`group flex items-start gap-4 rounded-3xl border p-5 shadow-sm transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
                  item.isRead
                    ? "border-slate-100 bg-white dark:border-slate-700/50 dark:bg-slate-800"
                    : "border-[#124757]/30 bg-[#124757]/5 dark:border-yellow-400/30 dark:bg-yellow-400/5"
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${NOTIFICATION_COLOR_CLASSES[meta.color]}`}>
                  <span className="material-symbols-outlined text-xl">{meta.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-headline text-sm font-black text-[#124757] dark:text-white">{item.title}</h3>
                    {!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.body}</p>
                  <p className="mt-2 text-[11px] font-bold text-slate-400">{formatNotificationTime(item.createdAt, lang)}</p>
                </div>
              </article>
            );
          })
        )}
      </div>

      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
            {lang === "VN" ? "Trước" : "Prev"}
          </button>
          <span className="text-xs font-bold text-slate-400">{page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            {lang === "VN" ? "Sau" : "Next"}
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}