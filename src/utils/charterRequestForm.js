export const deckOptions = [1, 2];

/** Cửa sổ giờ khởi hành áp dụng cho cả thuê theo giờ và theo ngày. */
export const CHARTER_DAY_WINDOW_START = "07:00";
export const CHARTER_DAY_WINDOW_END = "23:00";

export const toCharterTimeMinutes = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/** Giờ khởi hành hợp lệ: từ 07:00 đến 23:00 (bao gồm hai mốc). */
export const isCharterDayStartTimeValid = (startTime) => {
  const minutes = toCharterTimeMinutes(startTime);
  if (minutes == null) return false;
  const start = toCharterTimeMinutes(CHARTER_DAY_WINDOW_START);
  const end = toCharterTimeMinutes(CHARTER_DAY_WINDOW_END);
  return minutes >= start && minutes <= end;
};

export const getCharterDayStartTimeError = (startTime, lang = "VN") => {
  if (isCharterDayStartTimeValid(startTime)) return null;
  return lang === "VN"
    ? `Giờ đi phải từ ${CHARTER_DAY_WINDOW_START} đến ${CHARTER_DAY_WINDOW_END}.`
    : `Start time must be from ${CHARTER_DAY_WINDOW_START} to ${CHARTER_DAY_WINDOW_END}.`;
};

export const getMinDepartureDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const createEmptyStop = () => ({
  stationId: "",
  stopOrder: 1,
  stayDurationMinutes: 0,
  note: "",
});

export const createEmptyBoatRequest = () => ({
  numberOfDecks: 1,
});

export const normalizeDeckCount = (value, fallback = 1) => {
  const numberOfDecks = Number(value);
  return deckOptions.includes(numberOfDecks) ? numberOfDecks : fallback;
};
