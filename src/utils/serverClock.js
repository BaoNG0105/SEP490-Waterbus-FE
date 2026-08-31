export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

let serverOffsetMs = null;
let serverAnchorMs = null;
let monotonicAnchorMs = null;

const getMonotonicNow = () => (
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : null
);

/**
 * Đồng bộ giờ BE theo midpoint của request/response để giảm sai số do độ trễ mạng.
 * Timestamp vẫn là epoch UTC; timezone chỉ được dùng khi format ngày/giờ hiển thị.
 */
export const syncServerTime = (
  serverTime,
  requestStartedAt = Date.now(),
  responseReceivedAt = Date.now(),
) => {
  const serverMs = Date.parse(String(serverTime || ""));
  const startedMs = Number(requestStartedAt);
  const receivedMs = Number(responseReceivedAt);
  if (!Number.isFinite(serverMs) || !Number.isFinite(receivedMs)) return false;

  const validStartedMs = Number.isFinite(startedMs) && startedMs <= receivedMs
    ? startedMs
    : receivedMs;
  const midpointMs = validStartedMs + ((receivedMs - validStartedMs) / 2);
  serverOffsetMs = serverMs - midpointMs;

  // Neo theo monotonic clock để giờ đã đồng bộ không nhảy nếu đồng hồ hệ điều hành đổi.
  serverAnchorMs = receivedMs + serverOffsetMs;
  monotonicAnchorMs = getMonotonicNow();
  return true;
};

export const isServerClockSynchronized = () => Number.isFinite(serverOffsetMs);

export const getServerNowMs = () => {
  const monotonicNow = getMonotonicNow();
  if (
    Number.isFinite(serverAnchorMs)
    && Number.isFinite(monotonicAnchorMs)
    && Number.isFinite(monotonicNow)
  ) {
    return serverAnchorMs + (monotonicNow - monotonicAnchorMs);
  }
  return Date.now() + (Number.isFinite(serverOffsetMs) ? serverOffsetMs : 0);
};

export const getServerNow = () => new Date(getServerNowMs());

export const formatVietnamTime = (value, options = {}) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...options,
  }).format(date);
};

/** YYYY-MM-DD theo ngày vận hành Việt Nam, không phụ thuộc timezone của thiết bị. */
export const getVietnamDateYmd = (value = getServerNowMs()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
