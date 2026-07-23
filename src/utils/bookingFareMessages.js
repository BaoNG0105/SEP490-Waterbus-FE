/** Lý do khóa đặt / thiếu km từ search trip & seat-map. */

const looksLikeMissingKm = (text) => {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  return /km|distance|distancefromprevious|thiếu\s*km|missing\s*(segment\s*)?distance|fare\s*unavailable|chưa\s*(có\s*)?(giá|km)|không\s*tính\s*được\s*giá|no\s*fare|pricing\s*unavailable/i.test(
    t,
  );
};

export const isMissingKmBookingBlock = (tripOrMap) => {
  if (!tripOrMap) return false;
  const reason = tripOrMap.bookingClosedReason || tripOrMap.validationMessage || tripOrMap.message;
  if (looksLikeMissingKm(reason)) return true;
  const minPrice = tripOrMap.minPrice;
  const hasNullPrice = minPrice === null || minPrice === undefined;
  if (hasNullPrice && (tripOrMap.isBookable === false || tripOrMap.isBookingClosed === true)) {
    return true;
  }
  return false;
};

/** Thông báo cho khách (và gợi ý admin nhập km). */
export const formatBookingClosedMessage = (tripOrMap, lang = "VN") => {
  const reason = String(
    tripOrMap?.bookingClosedReason
    || tripOrMap?.validationMessage
    || tripOrMap?.message
    || "",
  ).trim();

  if (isMissingKmBookingBlock(tripOrMap)) {
    if (lang === "VN") {
      return reason
        ? `Chưa tính được giá vì thiếu km chặng. Admin cần nhập distanceFromPreviousKm trên tuyến. (${reason})`
        : "Chưa tính được giá vì thiếu km chặng. Admin cần nhập distanceFromPreviousKm trên tuyến/bến dừng.";
    }
    return reason
      ? `Price unavailable — missing segment km. Admin must set distanceFromPreviousKm on the route. (${reason})`
      : "Price unavailable — missing segment km. Admin must set distanceFromPreviousKm on route stops.";
  }

  if (reason) return reason;

  if (Number(tripOrMap?.availableSeats) <= 0) {
    return lang === "VN" ? "Hết chỗ" : "Sold out";
  }

  if (tripOrMap?.isBookable === false || tripOrMap?.isBookingClosed === true) {
    return lang === "VN" ? "Đã khóa bến lên" : "Boarding closed";
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

/** Ghế bị khóa trên seat-map theo chặng (có thể do chặng giao nhau). */
export const formatSegmentLockedSeatHint = (lang = "VN") => (
  lang === "VN"
    ? "Ghế đã bán/giữ trên chặng giao nhau — cùng ghế vẫn trống nếu chặng không giao."
    : "Seat sold/held on an overlapping segment — same seat stays free when segments do not overlap."
);

/** Label phụ thu từ search / seat-map / trip (null → không hiện). */
export const formatFareAdjustmentLabel = (adj, lang = "VN") => {
  if (adj == null || adj === "") return "";
  if (typeof adj === "string") return adj.trim();
  const name = String(
    adj.name || adj.label || adj.scope || adj.type || adj.adjustmentType || "",
  ).trim();
  const pct = adj.surchargePercent ?? adj.percent ?? adj.percentage;
  const pctN = Number(pct);
  if (name && Number.isFinite(pctN)) return `${name} +${pctN}%`;
  if (Number.isFinite(pctN)) {
    return lang === "VN" ? `Phụ thu +${pctN}%` : `Surcharge +${pctN}%`;
  }
  return name;
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
