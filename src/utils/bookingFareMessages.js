/** Lý do khóa đặt / thiếu km từ search trip & seat-map. */

export const looksLikeMissingKm = (text) => {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  return /km|distance|distancefromprevious|thiếu\s*km|missing\s*(segment\s*)?distance|fare\s*unavailable|chưa\s*(có\s*)?(giá|km)|không\s*tính\s*được\s*giá|no\s*fare|pricing\s*unavailable|chưa\s*nhập\s*đủ\s*số\s*km/i.test(
    t,
  );
};

export const pickBookingClosedReason = (tripOrMap) => String(
  tripOrMap?.bookingClosedReason
  || tripOrMap?.validationMessage
  || tripOrMap?.message
  || "",
).trim();

/**
 * BE contract:
 * - thiếu km: isBookingClosed=false, isBookable=false, bookingClosedReason có nội dung (minPrice thường null)
 * - đóng/chưa mở theo giờ: isBookingClosed=true
 * Không dùng isBookable=false một mình để hiện "chưa mở bán".
 */
export const isMissingKmBookingBlock = (tripOrMap) => {
  if (!tripOrMap) return false;
  if (tripOrMap.isBookingClosed === true) return false;
  const reason = pickBookingClosedReason(tripOrMap);
  if (looksLikeMissingKm(reason)) return true;
  // Search: isBookable=false + minPrice=null thường là thiếu distance fare.
  if (
    tripOrMap.isBookable === false
    && (tripOrMap.minPrice === null || tripOrMap.minPrice === undefined || tripOrMap.minPrice === "")
  ) {
    if (tripOrMap.segmentDistanceKm == null) return true;
    return Boolean(reason) && looksLikeMissingKm(reason);
  }
  return false;
};

/** Badge trên thẻ chuyến khi thiếu km (theo note BE). */
export const formatMissingKmTripBadge = (lang = "VN") => (
  lang === "VN" ? "Chưa có giá - thiếu km tuyến" : "No price - missing route km"
);

/** Thông báo ngắn trên thẻ chuyến (tránh tràn layout). */
export const formatTripUnavailableShortLabel = (tripOrMap, lang = "VN") => {
  if (!tripOrMap) return lang === "VN" ? "Không thể chọn" : "Unavailable";

  if (isMissingKmBookingBlock(tripOrMap)) {
    return formatMissingKmTripBadge(lang);
  }

  if (tripOrMap.isBookingClosed === true) {
    return lang === "VN" ? "Đã đóng / chưa mở bán" : "Closed / not open yet";
  }

  if (Number(tripOrMap?.availableSeats) <= 0) {
    return lang === "VN" ? "Hết chỗ" : "Sold out";
  }

  if (tripOrMap.isBookable === false) {
    const reason = pickBookingClosedReason(tripOrMap);
    if (reason) {
      return reason.length > 42 ? `${reason.slice(0, 40)}…` : reason;
    }
    return lang === "VN" ? "Chưa thể đặt vé" : "Not bookable";
  }

  return lang === "VN" ? "Không thể chọn" : "Unavailable";
};

/**
 * Thông báo cho khách theo contract BE:
 * isBookingClosed → đóng/chưa mở theo thời gian
 * !isBookable + bookingClosedReason → hiện reason (vd thiếu km)
 * !isBookable → chưa thể đặt
 */
export const formatBookingClosedMessage = (tripOrMap, lang = "VN") => {
  if (!tripOrMap) {
    return lang === "VN" ? "Không thể chọn" : "Unavailable";
  }

  if (tripOrMap.isBookingClosed === true) {
    return lang === "VN"
      ? "Đã đóng bán / chưa mở bán theo thời gian."
      : "Booking is closed / not open yet by schedule.";
  }

  if (Number(tripOrMap?.availableSeats) <= 0) {
    return lang === "VN" ? "Hết chỗ" : "Sold out";
  }

  if (tripOrMap.isBookable === false) {
    const reason = pickBookingClosedReason(tripOrMap);
    if (reason) return reason;
    return lang === "VN"
      ? "Chuyến hiện chưa thể đặt vé."
      : "This trip cannot be booked right now.";
  }

  return lang === "VN" ? "Không thể chọn" : "Unavailable";
};

export const formatMinPriceLabel = (minPrice, lang = "VN") => {
  if (minPrice === null || minPrice === undefined || minPrice === "") {
    return lang === "VN" ? "Chưa có giá" : "Price N/A";
  }
  const n = Number(minPrice);
  if (!Number.isFinite(n)) {
    return lang === "VN" ? "Chưa có giá" : "Price N/A";
  }
  return `${n.toLocaleString("vi-VN")} VND`;
};

/** Label phụ thu từ search / seat-map / trip (null → không hiện). */
export const formatFareAdjustmentLabel = (adj, lang = "VN") => {
  if (adj == null || adj === "") return "";
  const localizeName = (value) => {
    const raw = String(value || "").trim();
    if (lang !== "VN") return raw;
    const key = raw.toLowerCase().replace(/[_\s-]/g, "");
    if (key === "weekend" || key === "weekendsurcharge") return "Phụ thu cuối tuần";
    if (key === "holiday" || key === "holidaysurcharge") return "Phụ thu ngày lễ";
    return raw
      .replace(/^weekend\b/i, "Phụ thu cuối tuần")
      .replace(/^holiday\b/i, "Phụ thu ngày lễ");
  };
  if (typeof adj === "string") return localizeName(adj);
  const name = String(
    adj.name || adj.label || adj.scope || adj.type || adj.adjustmentType || "",
  ).trim();
  const pct = adj.surchargePercent ?? adj.percent ?? adj.percentage;
  const pctN = Number(pct);
  const label = localizeName(name);
  if (label && Number.isFinite(pctN)) return `${label} +${pctN}%`;
  if (Number.isFinite(pctN)) {
    return lang === "VN" ? `Phụ thu +${pctN}%` : `Surcharge +${pctN}%`;
  }
  return label;
};

/** Quãng đường chặng từ seat-map (null/undefined → thiếu km). */
export const pickSegmentDistanceKm = (seatMapOrTrip) => {
  if (!seatMapOrTrip || typeof seatMapOrTrip !== "object") return null;
  const raw = seatMapOrTrip.segmentDistanceKm
    ?? seatMapOrTrip.SegmentDistanceKm
    ?? seatMapOrTrip.distanceKm
    ?? seatMapOrTrip.segmentKm;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const formatSegmentDistanceLabel = (km, lang = "VN") => {
  if (km == null || !Number.isFinite(Number(km))) {
    return lang === "VN" ? "Quãng đường: —" : "Distance: —";
  }
  const n = Number(km);
  const text = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return lang === "VN" ? `Quãng đường: ${text} km` : `Distance: ${text} km`;
};
