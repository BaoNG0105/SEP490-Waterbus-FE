/** Hiển thị giờ chuyến theo VN — tránh lệch UTC vs +07. */

const pad2 = (n) => String(n).padStart(2, "0");

const vietnamDateParts = (date) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(date).map((part) => [part.type, part.value]));

/** DateOnly giữ nguyên; timestamp có timezone được đổi sang ngày Việt Nam. */
export const formatTripDateKey = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) {
    const year = Number(value.year ?? value.Year);
    const month = Number(value.month ?? value.Month);
    const day = Number(value.day ?? value.Day);
    if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const text = value instanceof Date ? "" : String(value).trim();
  const dateOnly = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateOnly) return `${dateOnly[1]}-${pad2(dateOnly[2])}-${pad2(dateOnly[3])}`;

  const dayFirst = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dayFirst) return `${dayFirst[3]}-${pad2(dayFirst[2])}-${pad2(dayFirst[1])}`;

  const isoPrefix = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T|\s)/);
  const hasExplicitTimeZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(text);
  if (isoPrefix && !hasExplicitTimeZone) {
    return `${isoPrefix[1]}-${pad2(isoPrefix[2])}-${pad2(isoPrefix[3])}`;
  }

  const parsed = value instanceof Date ? value : new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = vietnamDateParts(parsed);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/**
 * Lay nguyen HH:mm trong gia tri BE tra ve, khong quy doi mui gio.
 * Dung cho cac man hinh can phan anh dung gia tri lich trong response.
 */
export const formatLiteralClock = (value) => {
  if (value == null || value === "") return "--:--";
  const text = String(value).trim();
  if (!text) return "--:--";

  const timeOnly = text.match(/^(?:\d+\.)?(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  const embedded = text.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/);
  const matched = timeOnly || embedded;
  if (!matched) return "--:--";

  return `${pad2(Number(matched[1]))}:${matched[2]}`;
};

/**
 * ISO / HH:mm → HH:mm (Asia/Ho_Chi_Minh).
 * - Có +07:00 → lấy HH:mm trên chuỗi (giờ tường VN).
 * - Không TZ → coi là giờ tường VN.
 * - Z / offset khác → đổi sang Asia/Ho_Chi_Minh (không lấy HH:mm UTC trần).
 */
export const formatTripClock = (value) => {
  if (value == null || value === "") return "--:--";
  const text = String(value).trim();
  if (!text) return "--:--";

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
    const [h, m] = text.split(":");
    return `${pad2(Number(h))}:${m}`;
  }

  const matched = text.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?/);
  const offset = matched?.[3] || "";
  const normalizedOffset = offset.toUpperCase() === "Z"
    ? "Z"
    : offset.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");

  if (matched && (normalizedOffset === "+07:00" || !normalizedOffset)) {
    return `${pad2(Number(matched[1]))}:${matched[2]}`;
  }

  const ms = Date.parse(text);
  if (Number.isNaN(ms)) {
    if (matched) return `${pad2(Number(matched[1]))}:${matched[2]}`;
    return "--:--";
  }

  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  let hour = parts.hour || "00";
  if (hour === "24") hour = "00";
  return `${hour}:${parts.minute || "00"}`;
};

/** Phút trong ngày (VN) để sort — cùng rule formatTripClock. */
export const tripClockSortMinutes = (value) => {
  const clock = formatTripClock(value);
  if (!clock || clock === "--:--") return 0;
  const [h, m] = clock.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
};
