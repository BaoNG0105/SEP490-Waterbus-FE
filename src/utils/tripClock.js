/** Hiển thị giờ chuyến theo VN — tránh lệch UTC vs +07. */

const pad2 = (n) => String(n).padStart(2, "0");

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
