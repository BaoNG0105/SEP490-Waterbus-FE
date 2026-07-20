const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

export const normalizeNotification = (item) => ({
  id: pick(item, ["notificationId", "id"], ""),
  title: pick(item, ["title"], ""),
  body: pick(item, ["body", "message"], ""),
  type: pick(item, ["type"], ""),
  isRead: Boolean(item?.isRead),
  readAt: item?.readAt || null,
  relatedEntityType: pick(item, ["relatedEntityType"], ""),
  relatedEntityId: pick(item, ["relatedEntityId"], ""),
  createdAt: pick(item, ["createdAt"], ""),
});

const TYPE_META = {
  booking_confirmed: { icon: "confirmation_number", color: "emerald" },
  booking_cancelled: { icon: "event_busy", color: "rose" },
  booking_expired: { icon: "event_busy", color: "rose" },
  payment_success: { icon: "payments", color: "emerald" },
  payment_failed: { icon: "error", color: "rose" },
  refund_processed: { icon: "currency_exchange", color: "sky" },
  refund_requested: { icon: "currency_exchange", color: "amber" },
  promotion: { icon: "local_offer", color: "amber" },
};
const DEFAULT_TYPE_META = { icon: "notifications", color: "slate" };

export const getNotificationTypeMeta = (type) => TYPE_META[type] || DEFAULT_TYPE_META;

export const NOTIFICATION_COLOR_CLASSES = {
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  slate: "bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400",
};

// Backend chỉ trả relatedEntityType (vd "booking") chứ không phân biệt waterbus/sightseeing/charter,
// nên tuyến điều hướng bên dưới suy đoán best-effort dựa theo tiền tố của `type`.
export const resolveNotificationLink = (notification) => {
  const type = String(notification?.type || "").toLowerCase();
  const relatedEntityType = String(notification?.relatedEntityType || "").toLowerCase();
  const relatedEntityId = notification?.relatedEntityId;
  if (!relatedEntityId) return null;

  if (relatedEntityType === "booking") {
    if (type.includes("charter")) return `/profile/my-charter-booking/${relatedEntityId}`;
    if (type.includes("sightseeing")) return `/profile/my-sightseeing-booking/${relatedEntityId}`;
    return `/profile/my-waterbus-booking/${relatedEntityId}`;
  }
  return null;
};

export const formatNotificationTime = (value, lang = "VN") => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return lang === "VN" ? "Vừa xong" : "Just now";
  if (diffMin < 60) return lang === "VN" ? `${diffMin} phút trước` : `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return lang === "VN" ? `${diffHour} giờ trước` : `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return lang === "VN" ? `${diffDay} ngày trước` : `${diffDay}d ago`;

  return date.toLocaleString(lang === "VN" ? "vi-VN" : "en-US", { dateStyle: "medium", timeStyle: "short" });
};
