/** Tuổi / loại vé theo birthYear (BE chưa dùng ngày-tháng sinh). */

export const getVietnamCalendarYear = (date = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
    }).formatToParts(date instanceof Date ? date : new Date(date));
    const year = Number(parts.find((p) => p.type === "year")?.value);
    if (Number.isFinite(year)) return year;
  } catch {
    // fallback
  }
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
};

/** Năm đi từ departureDate (YYYY-MM-DD / ISO / Date) — fallback năm VN hiện tại. */
export const getTravelYear = (departureDate) => {
  const raw = String(departureDate || "").trim();
  if (raw) {
    const isoYear = raw.match(/^(\d{4})/);
    if (isoYear) return Number(isoYear[1]);
    const ms = Date.parse(raw);
    if (!Number.isNaN(ms)) return getVietnamCalendarYear(new Date(ms));
  }
  return getVietnamCalendarYear();
};

export const getAgeFromBirthYear = (birthYear, travelYear) => {
  const by = Number(birthYear);
  const ty = Number(travelYear);
  if (!Number.isInteger(by) || !Number.isInteger(ty) || by < 1900 || by > ty) return null;
  return ty - by;
};

/**
 * Rule BE:
 * - INFANT: tuổi <= 2
 * - CHILD: tuổi > 2 và <= 12
 * - ADULT (theo tuổi): >= 13
 */
export const classifyPassengerAgeBand = (birthYear, travelYear) => {
  const age = getAgeFromBirthYear(birthYear, travelYear);
  if (age == null) return null;
  if (age <= 2) return "INFANT";
  if (age <= 12) return "CHILD";
  return "ADULT";
};

export const isTicketTypeMatchingBirthYear = (ticketTypeCode, birthYear, travelYear) => {
  const type = String(ticketTypeCode || "").toUpperCase();
  const band = classifyPassengerAgeBand(birthYear, travelYear);
  if (!band) return false;
  if (type === "INFANT") return band === "INFANT";
  if (type === "CHILD") return band === "CHILD";
  // ADULT / SENIOR / DISABLED: không phải INFANT/CHILD theo tuổi
  if (["ADULT", "SENIOR", "DISABLED"].includes(type)) return band === "ADULT";
  return true;
};

export const ticketTypeAgeHint = (ticketTypeCode, travelYear, lang = "VN") => {
  const type = String(ticketTypeCode || "").toUpperCase();
  const y = Number(travelYear) || getVietnamCalendarYear();
  if (type === "INFANT") {
    return lang === "VN"
      ? `Em bé ≤ 2 tuổi (sinh từ ${y - 2}–${y}). Không ghế, đi kèm người lớn.`
      : `Infant ≤ 2 years (born ${y - 2}–${y}). No seat; accompany an adult.`;
  }
  if (type === "CHILD") {
    return lang === "VN"
      ? `Trẻ em > 2 đến ≤ 12 tuổi (sinh từ ${y - 12}–${y - 3}). Có ghế riêng + QR riêng; booking cần ≥ 1 ADULT cùng chặng.`
      : `Child > 2 and ≤ 12 (born ${y - 12}–${y - 3}). Own seat + own QR; booking needs ≥ 1 ADULT on the same leg.`;
  }
  return "";
};
