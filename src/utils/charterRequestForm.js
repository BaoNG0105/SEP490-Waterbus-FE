export const deckOptions = [1, 2];

/** Ảnh minh họa theo số tầng tàu — dùng chung cho lựa chọn tầng tàu (CharterRequestForm) và
 * tab chọn loại dịch vụ Waterbus (1 tầng) / WaterSightseeing (2 tầng) khi tạo chuyến (Admin). */
export const deckOptionImages = {
  1: "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/15/5b/30/ea/saigon-waterbus-lu-t.jpg?w=1200&h=-1&s=1",
  2: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNjBezqsnPRbARMzFhnjKsf9iQcLUnZLV9CEBL1zV7w6uOrEm6V33a2Oo&s=10",
};

/** Cửa sổ giờ khởi hành áp dụng cho cả thuê theo giờ và theo ngày. */
export const CHARTER_DAY_WINDOW_START = "07:00";
export const CHARTER_DAY_WINDOW_END = "23:00";
/** Giờ muộn nhất user được chọn làm giờ đi (22:00 = 23:00 - 1h, vì 23:00 là giờ đóng cửa station). */
export const CHARTER_DAY_WINDOW_END_EXCLUSIVE = "22:00";
/** Bước nhảy phút cho input giờ đi (60 = bước 1 giờ, không cho phút lẻ). */
export const CHARTER_DAY_WINDOW_STEP = 60;

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

/** Giờ khởi hành hợp lệ: từ 07:00 đến trước 22:00 (vì giờ đóng cửa station Waterbus là 23:00, cần về trước 23:00). */
export const isCharterDayStartTimeValid = (startTime) => {
  const minutes = toCharterTimeMinutes(startTime);
  if (minutes == null) return false;
  const start = toCharterTimeMinutes(CHARTER_DAY_WINDOW_START);
  const end = toCharterTimeMinutes(CHARTER_DAY_WINDOW_END_EXCLUSIVE);
  return minutes >= start && minutes < end;
};

export const getCharterDayStartTimeError = (startTime, lang = "VN") => {
  if (isCharterDayStartTimeValid(startTime)) return null;
  return lang === "VN"
    ? `Giờ đi phải từ ${CHARTER_DAY_WINDOW_START} đến trước ${CHARTER_DAY_WINDOW_END_EXCLUSIVE}.`
    : `Start time must be from ${CHARTER_DAY_WINDOW_START} to before ${CHARTER_DAY_WINDOW_END_EXCLUSIVE}.`;
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
  stayDurationMinutes: 5,
  note: "",
});

export const createEmptyBoatRequest = () => ({
  numberOfDecks: 1,
});

export const PASSENGER_TYPE_ADULT = "Adult";
export const PASSENGER_TYPE_CHILD = "Child";

export const createEmptyPassenger = (type = PASSENGER_TYPE_ADULT) => ({
  fullName: "",
  birthYear: "",
  type,
});

/**
 * Phân bổ type cho danh sách hành khách dựa trên adultCount / childCount đã khai báo ở bước Lộ trình.
 * - adultCount passenger đầu = Adult
 * - childCount passenger sau = Child
 * - Nếu tổng passengers khác tổng khai báo → còn thừa/thiếu thì nguyên cũ (an toàn).
 */
export const assignPassengerTypesFromCounts = (passengers, adultCount, childCount) => {
  const list = Array.isArray(passengers) ? passengers : [];
  const adults = Math.max(0, Number(adultCount) || 0);
  const children = Math.max(0, Number(childCount) || 0);
  const expectedTotal = adults + children;
  if (list.length !== expectedTotal) return list;
  return list.map((p, idx) => {
    const desired = idx < adults ? PASSENGER_TYPE_ADULT : PASSENGER_TYPE_CHILD;
    if (p && p.type === desired) return p;
    return { ...(p || createEmptyPassenger(desired)), type: desired };
  });
};

/** Tính số adult/child thực tế từ danh sách hành khách theo type. */
export const countPassengersByType = (passengers) => {
  const list = Array.isArray(passengers) ? passengers : [];
  let adultCount = 0;
  let childCount = 0;
  for (const p of list) {
    if (p?.type === PASSENGER_TYPE_ADULT) adultCount += 1;
    else if (p?.type === PASSENGER_TYPE_CHILD) childCount += 1;
  }
  return { adultCount, childCount, total: adultCount + childCount };
};

/**
 * Sort danh sách gói bảo hiểm active cho luồng Charter:
 * - Gói Waterbus default (`isWaterbusDefault`) luôn lên đầu.
 * - Sau đó sort theo `displayOrder` tăng dần.
 * - Giữ nguyên thứ tự BE trả nếu các gói còn lại bằng displayOrder.
 */
export const sortActivePackagesForCharter = (packages = []) => {
  const list = Array.isArray(packages) ? packages : [];
  return [...list].sort((a, b) => {
    const aDefault = Boolean(a?.isWaterbusDefault);
    const bDefault = Boolean(b?.isWaterbusDefault);
    if (aDefault !== bDefault) return aDefault ? -1 : 1;
    return Number(a?.displayOrder ?? 0) - Number(b?.displayOrder ?? 0);
  });
};

/**
 * Trả về id gói bảo hiểm mặc định cho Charter (ưu tiên gói Waterbus default).
 * Trả `null` nếu list rỗng.
 */
export const getCharterDefaultPackageId = (packages = []) => {
  const list = Array.isArray(packages) ? packages : [];
  const waterbusDefault = list.find((pkg) => pkg?.isWaterbusDefault);
  return (
    waterbusDefault?.id
    ?? waterbusDefault?.insurancePackageId
    ?? list[0]?.id
    ?? list[0]?.insurancePackageId
    ?? null
  );
};

/** Validate danh sách hành khách có khớp số lượng adult/child đã khai báo không. Trả về null nếu hợp lệ. */
export const getPassengerTypeMismatchError = (passengers, adultCount, childCount, lang = "VN") => {
  const declared = Math.max(0, Number(adultCount) || 0) + Math.max(0, Number(childCount) || 0);
  const { total } = countPassengersByType(passengers);
  if (total !== declared) {
    return lang === "VN"
      ? `Danh sách hành khách (${total}) chưa khớp số lượng đã khai báo (${declared}).`
      : `Passenger list (${total}) does not match declared count (${declared}).`;
  }
  const { adultCount: a, childCount: c } = countPassengersByType(passengers);
  if (a !== Math.max(0, Number(adultCount) || 0) || c !== Math.max(0, Number(childCount) || 0)) {
    return lang === "VN"
      ? `Cần đúng ${adultCount} người lớn và ${childCount} trẻ em (đang có ${a} người lớn, ${c} trẻ em).`
      : `Need exactly ${adultCount} adult(s) and ${childCount} child(ren) (got ${a} adult(s), ${c} child(ren)).`;
  }
  if (c > 0 && a <= 0) {
    return lang === "VN"
      ? "Cần có ít nhất 1 người lớn nếu có trẻ em đi cùng."
      : "At least 1 adult is required if children are included.";
  }
  return null;
};

export const normalizeDeckCount = (value, fallback = 1) => {
  const numberOfDecks = Number(value);
  return deckOptions.includes(numberOfDecks) ? numberOfDecks : fallback;
};

/**
 * Chuẩn hoá input số điện thoại VN khi user paste/gõ:
 * - Chỉ giữ chữ số và dấu '+' ở đầu.
 * - Nếu bắt đầu bằng '+84' hoặc '84' (đủ 10–11 chữ số) → đổi sang '0' + 9 chữ số còn lại.
 * - Nếu không match → trả về chuỗi đã strip ký tự lạ, không tự ý thêm '0'.
 * Dùng cho cả onChange input lẫn load từ profile (đề phòng profile lưu số quốc tế).
 */
export const normalizeVietnamPhoneInput = (raw) => {
  const original = String(raw ?? "");
  // Bỏ mọi ký tự không phải số và không phải '+', nhưng chỉ cho phép '+' ở đầu.
  let cleaned = original.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (!cleaned) return "";

  // +84xxxxxxxxx (11–12 chars) hoặc 84xxxxxxxxx (10–11 chars) → convert sang 0xxxxxxxxx
  if (/^\+?84\d{9}$/.test(cleaned) || /^84\d{9}$/.test(cleaned)) {
    return `0${cleaned.replace(/^\+?84/, "").slice(0, 9)}`;
  }
  // Người dùng mới gõ "+84" rồi dừng: giữ nguyên để họ tiếp tục nhập.
  return cleaned;
};
