import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "../../../context/AppContext";
//import
import { fetchMyBookingDetail } from "../../../services/bookingService";
import { fetchTripDetail } from "../../../services/tripService";
import { fetchReviewableTrips, submitBookingReview } from "../../../services/reviewService";
import { PayOSLogo, payosButtonClassName } from "../../../components/PayOSLogo";
import { CharterInsuranceInfo } from "../../../components/CharterInsuranceInfo";
import { MY_BOOKINGS_PATH, getBookingServiceConfig } from "../../../utils/bookingServiceType";
import {
  getBookingInsurancePackageId,
  normalizeInsuranceFromBooking,
  resolveInsuranceSelected,
} from "../../../utils/insurancePreview";
import { INSURANCE_BOOKING_TYPES } from "../../../services/insuranceService";
import { formatTicketTypeLabel } from "../../../services/ticketTypeService";
import { notify } from "../../../utils/swalToast";
import { normalizeReviewableTrip, StarRatingDisplay, TripReviewModal } from "../../../components/TripReview";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const STATUS_STYLES = {
  pendingpayment: "text-amber-700 dark:text-amber-300",
  confirmed: "text-emerald-700 dark:text-emerald-300",
  completed: "text-sky-700 dark:text-sky-300",
  cancelled: "text-slate-500 dark:text-slate-400",
  expired: "text-rose-600 dark:text-rose-300",
  paid: "text-emerald-700 dark:text-emerald-300",
  unpaid: "text-amber-700 dark:text-amber-300",
  depositpaid: "text-indigo-700 dark:text-indigo-300",
  active: "text-emerald-700 dark:text-emerald-300",
  pending: "text-amber-700 dark:text-amber-300",
  used: "text-slate-600 dark:text-slate-300",
  checkedin: "text-sky-700 dark:text-sky-300",
  checkedout: "text-slate-500 dark:text-slate-400",
  refunded: "text-teal-700 dark:text-teal-300",
  failed: "text-rose-600 dark:text-rose-300",
  pendingquote: "text-violet-700 dark:text-violet-300",
  quoted: "text-indigo-700 dark:text-indigo-300",
};

const STATUS_LABELS = {
  pendingpayment: { vn: "Chờ thanh toán", en: "Pending payment" },
  confirmed: { vn: "Đã xác nhận", en: "Confirmed" },
  completed: { vn: "Hoàn tất", en: "Completed" },
  cancelled: { vn: "Đã hủy", en: "Cancelled" },
  expired: { vn: "Hết hạn", en: "Expired" },
  refunded: { vn: "Đã hoàn tiền", en: "Refunded" },
  pendingquote: { vn: "Chờ báo giá", en: "Pending quote" },
  quoted: { vn: "Đã báo giá", en: "Quoted" },
  paid: { vn: "Đã thanh toán ", en: "Paid in full" },
  unpaid: { vn: "Chưa thanh toán", en: "Unpaid" },
  depositpaid: { vn: "Đã cọc", en: "Deposit paid" },
  pending: { vn: "Chờ thanh toán", en: "Pending" },
  failed: { vn: "Thanh toán thất bại", en: "Payment failed" },
  partiallyrefunded: { vn: "Hoàn một phần", en: "Partially refunded" },
  active: { vn: "Còn hiệu lực", en: "Active" },
  used: { vn: "Đã sử dụng", en: "Used" },
  checkedin: { vn: "Đã check-in", en: "Checked in" },
  checkedout: { vn: "Đã check-out", en: "Checked out" },
};

const getStatusKey = (status) => String(status || "").toLowerCase().replace(/[\s_-]/g, "");
const getStatusClasses = (status) => STATUS_STYLES[getStatusKey(status)]
  || "text-slate-500 dark:text-slate-400";

/** Vé còn hiện QR: Active hoặc đang trên tàu (CheckedIn). Used/CheckedOut/Cancelled/Expired = terminal. */
const isQrEligibleTicketStatus = (status) => {
  const key = getStatusKey(status);
  return key === "active" || key === "checkedin";
};

/** Booking đã xác nhận + thanh toán + vé còn hiệu lực để hiện QR / mã vé. */
const isTicketIssued = (booking, item) => (
  getStatusKey(booking?.status || booking?.bookingStatus) === "confirmed"
  && getStatusKey(booking?.paymentStatus) === "paid"
  && (Boolean(String(item?.ticketCode || "").trim()) || Boolean(String(item?.ticketQrToken || "").trim()))
  && isQrEligibleTicketStatus(item?.ticketStatus || item?.itemStatus)
);

const getStatusLabel = (status, lang = "VN") => {
  const entry = STATUS_LABELS[getStatusKey(status)];
  if (!entry) return status || "--";
  return lang === "VN" ? entry.vn : entry.en;
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
};

const formatTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatDateOnly = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/** Chuẩn hoá mã loại vé từ code / tên BE. */
const resolveItemTicketTypeCode = (item) => {
  const rawCode = String(pick(item, ["ticketTypeCode"], "")).trim();
  if (rawCode) {
    const key = rawCode.toUpperCase().replace(/[\s_-]+/g, "");
    if (key === "INFANT" || key === "EMBE") return "INFANT";
    if (key === "CHILD" || key === "TREEM") return "CHILD";
    if (key === "ADULT" || key === "NGUOILON") return "ADULT";
    if (key === "SENIOR" || key === "NGUOICAOTUOI" || key === "NCT") return "SENIOR";
    if (key === "DISABLED" || key === "NGUOIKHUYETTAT" || key === "NKT") return "DISABLED";
    return key;
  }
  const name = String(pick(item, ["ticketTypeName"], "")).trim().toLowerCase();
  if (!name) return "";
  if (name.includes("em bé") || name.includes("infant") || name.includes("≤ 2") || name.includes("<= 2")) return "INFANT";
  if (name.includes("trẻ em") || name.includes("child")) return "CHILD";
  if (name.includes("cao tuổi") || name.includes("senior")) return "SENIOR";
  if (name.includes("khuyết") || name.includes("disabled")) return "DISABLED";
  if (name.includes("người lớn") || name.includes("adult")) return "ADULT";
  return "";
};

/** Em bé / vé đi kèm: luôn gộp dưới người lớn — không tin usesCompanionTicket=false từ BE. */
const isCompanionBookingItem = (item) => {
  if (!item || typeof item !== "object") return false;
  if (item.usesCompanionTicket === true || item.UsesCompanionTicket === true) return true;

  const type = resolveItemTicketTypeCode(item);
  // BE rule: INFANT không ghế, dùng QR người lớn — luôn nest.
  if (type === "INFANT") return true;

  const seat = String(pick(item, ["seatNumber", "SeatNumber"], "") || item.seatNumber || "").trim();
  const qr = String(pick(item, ["ticketQrToken", "TicketQrToken"], "") || item.ticketQrToken || "").trim();

  // Legacy CHILD không ghế / không QR.
  if (type === "CHILD" && !seat && !qr) return true;

  // Fallback: không ghế + không QR + không phải loại có ghế riêng.
  if (!seat && !qr && !["ADULT", "SENIOR", "DISABLED", "CHILD"].includes(type)) {
    return true;
  }
  return false;
};

const normalizeItem = (item) => {
  const ticketTypeCode = resolveItemTicketTypeCode(item) || pick(item, ["ticketTypeCode"], "");
  const seatNumber = pick(item, ["seatNumber"], "");
  const ticketQrToken = pick(item, ["ticketQrToken"], "");
  const normalized = {
    id: pick(item, ["bookingItemId", "id"], ""),
    tripCode: pick(item, ["tripCode"], ""),
    passengerName: pick(item, ["passengerName"], "--"),
    passengerPhone: pick(item, ["passengerPhone"], "") || "",
    passengerEmail: pick(item, ["passengerEmail"], "") || "",
    ticketTypeCode,
    ticketTypeName: pick(item, ["ticketTypeName", "ticketTypeCode"], ""),
    seatNumber,
    fromStationName: pick(item, ["fromStationName"], "--"),
    toStationName: pick(item, ["toStationName"], "--"),
    scheduledDeparture: pick(item, ["scheduledDeparture"], ""),
    scheduledArrival: pick(item, ["scheduledArrival"], ""),
    unitPrice: Number(pick(item, ["unitPrice"], 0)),
    itemStatus: pick(item, ["itemStatus"], ""),
    ticketCode: pick(item, ["ticketCode"], ""),
    ticketQrToken,
    ticketStatus: pick(item, ["ticketStatus"], ""),
    birthYear: (() => {
      const raw = pick(item, ["birthYear", "BirthYear"], "");
      if (raw === "" || raw == null) return "";
      const num = Number(raw);
      return Number.isFinite(num) && num > 0 ? String(num) : String(raw).trim();
    })(),
    boatCode: pick(item, ["boatCode", "BoatCode"], "") || "",
    boatName: pick(item, ["boatName", "BoatName"], "") || "",
    tripId: String(pick(item, ["tripId", "TripId"], "") || "").trim(),
    companionPassengerId: String(pick(item, [
      "companionPassengerId",
      "CompanionPassengerId",
    ], "") || "").trim(),
    companionPassengerName: pick(item, [
      "companionPassengerName",
      "CompanionPassengerName",
      "companionName",
      "accompaniedByName",
    ], ""),
  };
  return {
    ...normalized,
    usesCompanionTicket: isCompanionBookingItem({ ...item, ...normalized }),
  };
};

/** Vé đã phát hành — có ít nhất ticketCode hoặc ticketQrToken, dùng để hiện mã vé / QR. */
const isTicketVisible = (booking, item) => (
  isTicketIssued(booking, item)
  && !item.usesCompanionTicket
);

const normalizePassengerKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const compareSeatLabel = (a, b) => {
  const sa = String(a || "").trim();
  const sb = String(b || "").trim();
  if (!sa && !sb) return 0;
  if (!sa) return 1;
  if (!sb) return -1;
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
};

/**
 * Gộp INFANT dưới đúng người lớn theo companionPassengerId / companionPassengerName.
 * Mỗi ADULT tối đa 1 em bé — tin companionPassengerId từ API; không gán lung tung theo ghế.
 */
const nestCompanionsUnderHolders = (items) => {
  const list = Array.isArray(items) ? items : [];
  const holders = list
    .filter((item) => !item.usesCompanionTicket)
    .slice()
    .sort((a, b) => compareSeatLabel(a.seatNumber, b.seatNumber));
  const companions = list.filter((item) => item.usesCompanionTicket);
  const used = new Set();
  const holderHasCompanion = new Set();

  const companionKey = (companion) => companion.id || companion.passengerId || companion;

  const nameMatches = (holderName, companionOf) => {
    const a = normalizePassengerKey(holderName);
    const b = normalizePassengerKey(companionOf);
    if (!a || !b) return false;
    return a === b;
  };

  const matchStrength = (holder, companion) => {
    const companionId = String(companion.companionPassengerId || "").trim().toLowerCase();
    const holderId = String(holder.id || holder.passengerId || "").trim().toLowerCase();
    // API đã gán companion → chỉ tin id, không fallback tên/ghế.
    if (companionId) {
      return holderId && companionId === holderId ? 4 : 0;
    }

    if (nameMatches(holder.passengerName, companion.companionPassengerName)) return 2;

    // Fallback yếu: ADULT trống cùng trip — chỉ khi đúng 1 ADULT còn slot.
    const type = String(holder.ticketTypeCode || "").toUpperCase();
    return type === "ADULT" ? 1 : 0;
  };

  const rows = holders.map((holder) => ({ holder, companions: [] }));
  const freeAdultIndexes = () => rows
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) => (
      !holderHasCompanion.has(index)
      && String(row.holder?.ticketTypeCode || "").toUpperCase() === "ADULT"
    ))
    .map(({ index }) => index);

  const candidates = [];
  companions.forEach((companion) => {
    rows.forEach((row, holderIndex) => {
      const strength = matchStrength(row.holder, companion);
      if (strength > 0) {
        candidates.push({ companion, holderIndex, strength });
      }
    });
  });

  candidates
    .sort((a, b) => b.strength - a.strength || a.holderIndex - b.holderIndex)
    .forEach(({ companion, holderIndex, strength }) => {
      const key = companionKey(companion);
      if (used.has(key) || holderHasCompanion.has(holderIndex)) return;
      // Strength 1 chỉ khi còn đúng 1 ADULT trống trên chiều này.
      if (strength === 1 && freeAdultIndexes().length !== 1) return;
      used.add(key);
      holderHasCompanion.add(holderIndex);
      rows[holderIndex].companions.push(companion);
    });

  companions.forEach((companion) => {
    const key = companionKey(companion);
    if (used.has(key)) return;
    rows.push({ holder: null, companions: [companion] });
  });

  return rows;
};

const normalizePayment = (payment) => ({
  id: pick(payment, ["paymentId", "id"], ""),
  paymentCode: pick(payment, ["paymentCode"], "--"),
  provider: pick(payment, ["provider"], ""),
  amount: Number(pick(payment, ["amount"], 0)),
  paymentMethod: pick(payment, ["paymentMethod"], ""),
  paymentPurpose: pick(payment, ["paymentPurpose"], ""),
  paymentStatus: pick(payment, ["paymentStatus"], ""),
  checkoutUrl: pick(payment, ["checkoutUrl"], ""),
  qrCode: pick(payment, ["qrCode"], ""),
  paidAt: pick(payment, ["paidAt"], ""),
  expiresAt: pick(payment, ["expiresAt"], ""),
  refundAmount: Number(pick(payment, ["refundAmount"], 0)),
});

const normalizeBookingDetail = (data) => ({
  id: String(pick(data, ["bookingId", "id"], "")),
  bookingCode: pick(data, ["bookingCode"], "--"),
  bookedAt: pick(data, ["bookedAt"], ""),
  status: pick(data, ["bookingStatus"], "--"),
  serviceType: pick(data, ["serviceType"], ""),
  subtotalAmount: Number(pick(data, ["subtotalAmount"], 0)),
  discountAmount: Number(pick(data, ["discountAmount"], 0)),
  totalAmount: Number(pick(data, ["totalAmount"], 0)),
  pointsUsed: Number(pick(data, ["pointsUsed"], 0)),
  paymentStatus: pick(data, ["paymentStatus"], ""),
  bookingQrToken: pick(data, ["bookingQrToken"], ""),
  holdExpiresAt: pick(data, ["holdExpiresAt"], ""),
  returnTripCode: pick(data, ["returnTripCode"], ""),
  tripId: String(pick(data, ["tripId", "TripId"], "") || "").trim(),
  boatCode: pick(data, ["boatCode", "BoatCode"], "") || "",
  boatName: pick(data, ["boatName", "BoatName"], "") || "",
  returnTripId: String(pick(data, ["returnTripId", "ReturnTripId"], "") || "").trim(),
  returnBoatCode: pick(data, ["returnBoatCode", "ReturnBoatCode"], "") || "",
  returnBoatName: pick(data, ["returnBoatName", "ReturnBoatName"], "") || "",
  contactName: pick(data, ["contactName", "ContactName"], "") || "",
  contactPhone: pick(data, ["contactPhone", "ContactPhone"], "") || "",
  contactEmail: pick(data, ["contactEmail", "ContactEmail"], "") || "",
  insuranceSelected: resolveInsuranceSelected(data),
  insurancePackageId: getBookingInsurancePackageId(data),
  insurance: normalizeInsuranceFromBooking(data),
  items: Array.isArray(data?.items) ? data.items.map(normalizeItem) : [],
  payments: Array.isArray(data?.payments) ? data.payments.map(normalizePayment) : [],
});

const pickTripBoatFields = (trip) => {
  if (!trip || typeof trip !== "object") return { boatCode: "", boatName: "" };
  const boat = trip.boat || trip.Boat || {};
  return {
    boatCode: String(
      trip.boatCode
      || trip.BoatCode
      || boat.code
      || boat.boatCode
      || boat.Code
      || boat.vesselCode
      || boat.VesselCode
      || "",
    ).trim(),
    boatName: String(
      trip.boatName
      || trip.BoatName
      || boat.name
      || boat.boatName
      || boat.Name
      || boat.vesselName
      || boat.VesselName
      || "",
    ).trim(),
  };
};

/** Nếu booking detail chưa có tàu — bổ sung từ GET /trips/{tripId} (public). */
const enrichBookingItemsWithBoat = async (booking) => {
  if (!booking?.items?.length) return booking;

  const tripIdByCode = new Map();
  if (booking.tripId && booking.items[0]?.tripCode) {
    tripIdByCode.set(String(booking.items[0].tripCode).trim().toUpperCase(), booking.tripId);
  }
  if (booking.returnTripId && booking.returnTripCode) {
    tripIdByCode.set(String(booking.returnTripCode).trim().toUpperCase(), booking.returnTripId);
  }

  const boatByTripKey = new Map();
  const rememberBoat = (key, boat) => {
    if (!key || (!boat.boatCode && !boat.boatName)) return;
    boatByTripKey.set(key, boat);
  };

  if (booking.boatCode || booking.boatName) {
    rememberBoat(booking.tripId, { boatCode: booking.boatCode, boatName: booking.boatName });
    if (booking.items[0]?.tripCode) {
      rememberBoat(String(booking.items[0].tripCode).trim().toUpperCase(), {
        boatCode: booking.boatCode,
        boatName: booking.boatName,
      });
    }
  }
  if (booking.returnBoatCode || booking.returnBoatName) {
    rememberBoat(booking.returnTripId, {
      boatCode: booking.returnBoatCode,
      boatName: booking.returnBoatName,
    });
    if (booking.returnTripCode) {
      rememberBoat(String(booking.returnTripCode).trim().toUpperCase(), {
        boatCode: booking.returnBoatCode,
        boatName: booking.returnBoatName,
      });
    }
  }

  booking.items.forEach((item) => {
    if (item.boatCode || item.boatName) {
      rememberBoat(item.tripId, { boatCode: item.boatCode, boatName: item.boatName });
      rememberBoat(String(item.tripCode || "").trim().toUpperCase(), {
        boatCode: item.boatCode,
        boatName: item.boatName,
      });
    }
    if (item.tripId && item.tripCode) {
      tripIdByCode.set(String(item.tripCode).trim().toUpperCase(), item.tripId);
    }
  });

  const tripIdsToFetch = [...new Set(
    booking.items
      .filter((item) => !(item.boatCode || item.boatName))
      .map((item) => (
        item.tripId
        || tripIdByCode.get(String(item.tripCode || "").trim().toUpperCase())
        || ""
      ))
      .filter(Boolean),
  )];

  await Promise.all(tripIdsToFetch.map(async (tripId) => {
    try {
      const trip = await fetchTripDetail(tripId);
      const boat = pickTripBoatFields(trip);
      rememberBoat(tripId, boat);
      const code = String(trip?.tripCode || trip?.TripCode || "").trim().toUpperCase();
      if (code) rememberBoat(code, boat);
    } catch (error) {
      console.warn(`Không lấy được thông tin tàu cho chuyến ${tripId}:`, error);
    }
  }));

  const items = booking.items.map((item) => {
    if (item.boatCode || item.boatName) return item;
    const byId = item.tripId ? boatByTripKey.get(item.tripId) : null;
    const byCode = boatByTripKey.get(String(item.tripCode || "").trim().toUpperCase());
    const boat = byId || byCode;
    if (!boat) return item;
    return { ...item, boatCode: boat.boatCode || "", boatName: boat.boatName || "" };
  });

  return { ...booking, items };
};

/** Đánh giá của tôi cho 1 chuyến — CTA nếu chưa đánh giá, card đọc nếu đã gửi. */
const TripReviewSlot = ({ reviewable, lang, onOpenReview }) => {
  if (!reviewable) return null;

  if (!reviewable.myReview) {
    return (
      <div className="p-5 sm:p-6">
        <button
          type="button"
          onClick={() => onOpenReview(reviewable)}
          className="flex items-center gap-2 rounded-xl border border-[#124757]/20 bg-[#124757]/5 px-3.5 py-2 text-xs font-headline font-black uppercase tracking-wide text-[#124757] transition hover:bg-[#124757]/10 dark:border-yellow-400/20 dark:bg-yellow-400/5 dark:text-yellow-400"
        >
          {lang === "VN" ? "Đánh giá chuyến này" : "Review this trip"}
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6">
      <StarRatingDisplay rating={reviewable.myReview.rating} size="text-base" />
      {reviewable.myReview.comment ? (
        <p className="mt-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
          {reviewable.myReview.comment}
        </p>
      ) : null}
    </div>
  );
};

function CopyableCode({ value, className = "" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — silently ignore.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy"
      className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left font-mono text-[11px] font-bold text-slate-600 transition hover:border-[#124757]/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${className}`}
    >
      <span className="min-w-0 flex-1 break-all">{value}</span>
      <span className="material-symbols-outlined shrink-0 text-sm text-slate-400">
        {copied ? "check" : "content_copy"}
      </span>
    </button>
  );
}

// Vé/booking dùng qrToken làm mã quét — encode thành ảnh QR thật để staff scan được.
function QrCodeBlock({ value, label, size = 88 }) {
  const [isEnlarged, setIsEnlarged] = useState(false);
  if (!value) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsEnlarged(true)}
        title={label}
        className="inline-flex flex-col items-center gap-1"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700">
          <QRCodeSVG value={value} size={size} />
        </div>
        <span className="text-[10px] font-bold text-slate-400">{label}</span>
      </button>

      {isEnlarged && (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsEnlarged(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setIsEnlarged(false); }}
          role="presentation"
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label={label}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400">{label}</span>
              <button type="button" onClick={() => setIsEnlarged(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex justify-center">
              <QRCodeSVG value={value} size={240} />
            </div>
            <p className="mt-4 break-all text-center font-mono text-[11px] text-slate-500">{value}</p>
          </div>
        </div>
      )}
    </>
  );
}

const DetailSkeleton = () => (
  <div className="mx-auto max-w-5xl animate-pulse space-y-4">
    <div className="h-28 rounded-3xl bg-slate-200 dark:bg-slate-700" />
    <div className="h-52 rounded-3xl bg-slate-100 dark:bg-slate-800" />
    <div className="h-40 rounded-3xl bg-slate-100 dark:bg-slate-800" />
  </div>
);

const STATUS_BADGE_SIZES = {
  sm: "text-[10px]",
  lg: "text-sm",
};

const StatusBadge = ({ status, lang, size = "sm" }) => {
  if (!status) return null;
  return (
    <span className={`font-headline font-black uppercase tracking-wide ${STATUS_BADGE_SIZES[size]} ${getStatusClasses(status)}`}>
      {getStatusLabel(status, lang)}
    </span>
  );
};

/** Người đi kèm: chỉ tên + năm sinh (không lặp nhãn Em bé / Trẻ em). */
const CompanionChip = ({ companion, lang }) => {
  const birthYear = companion?.birthYear != null && companion.birthYear !== ""
    ? String(companion.birthYear)
    : "";

  return (
    <div className="rounded-xl border border-violet-200/70 bg-white/80 px-3 py-2 dark:border-violet-500/20 dark:bg-slate-900/40">
      <p className="text-sm font-black text-violet-950 dark:text-violet-50">
        {companion.passengerName || "—"}
      </p>
      {birthYear ? (
        <p className="mt-0.5 text-[10px] font-medium text-violet-600/75 dark:text-violet-300/70">
          {lang === "VN" ? "Năm sinh" : "Born"} {birthYear}
        </p>
      ) : null}
    </div>
  );
};

export function BookingDetailPage({ serviceType }) {
  const config = getBookingServiceConfig(serviceType);
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAuthenticated } = useSelector((state) => state.auth);

  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [bookingReviewable, setBookingReviewable] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
    []
  );

  const listPath = `${MY_BOOKINGS_PATH}?type=${config.serviceType}`;

  const loadDetail = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      if (!silent) {
        setIsLoading(true);
        setErrorMsg("");
        setNotFound(false);
      }
      const data = await fetchMyBookingDetail(id);
      const normalized = normalizeBookingDetail(data);
      const enriched = await enrichBookingItemsWithBoat(normalized);
      setBooking(enriched);
    } catch (error) {
      console.error(`Lỗi tải chi tiết booking ${id}:`, error);
      if (error?.response?.status === 404) {
        setNotFound(true);
      } else if (!silent) {
        setErrorMsg(error.response?.data?.message || (lang === "VN" ? "Không thể tải chi tiết booking." : "Unable to load this booking."));
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [id, isAuthenticated, lang, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadDetail();
  }, [loadDetail]);

  // Review giờ tính theo booking (không phải trip) — chỉ cần tìm entry có bookingId khớp booking đang xem.
  const loadReviewableTrips = useCallback(async () => {
    if (!booking?.id) return;
    try {
      const data = await fetchReviewableTrips({ page: 1, pageSize: 100 });
      const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
      const match = list
        .map(normalizeReviewableTrip)
        .find((trip) => trip.bookingId === booking.id);
      setBookingReviewable(match || null);
    } catch (error) {
      console.error("Lỗi khi tải danh sách chuyến có thể đánh giá:", error);
    }
  }, [booking?.id]);

  // Chỉ có booking đã hoàn tất dịch vụ mới xuất hiện trong reviewable-trips.
  useEffect(() => {
    if (!booking) return;
    loadReviewableTrips();
  }, [booking, loadReviewableTrips]);

  const handleReviewSubmitted = useCallback(async (rating, comment) => {
    if (!bookingReviewable?.bookingId) return;
    await submitBookingReview(bookingReviewable.bookingId, { rating, comment });
    setBookingReviewable((prev) => (prev ? { ...prev, myReview: { rating, comment, status: "Hidden" } } : prev));
    setReviewModalOpen(false);
    notify({
      toast: true,
      icon: "success",
      title: lang === "VN" ? "Đã gửi đánh giá" : "Review submitted",
      text: lang === "VN"
        ? "Cảm ơn bạn! Đánh giá sẽ hiển thị công khai sau khi được duyệt."
        : "Thanks! Your review will show publicly once approved.",
    });
  }, [bookingReviewable, lang]);

  const holdExpiresAtMs = booking?.holdExpiresAt
    ? new Date(booking.holdExpiresAt).getTime()
    : NaN;
  const hasActiveHold = Number.isFinite(holdExpiresAtMs)
    && getStatusKey(booking?.status) === "pendingpayment";
  const hasPendingPaymentDeadline = Boolean(
    booking?.payments?.some((payment) => (
      getStatusKey(payment.paymentStatus) === "pending"
      && payment.expiresAt
    )),
  );

  useEffect(() => {
    if (!hasActiveHold && !hasPendingPaymentDeadline) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveHold, hasPendingPaymentDeadline]);

  // Hết holdExpiresAt → refetch GET /bookings/{id} để lấy status Expired / ghế đã nhả.
  useEffect(() => {
    if (!hasActiveHold || !Number.isFinite(holdExpiresAtMs)) return undefined;
    const remaining = holdExpiresAtMs - Date.now();
    if (remaining <= 0) {
      loadDetail({ silent: true });
      return undefined;
    }
    const timer = window.setTimeout(() => loadDetail({ silent: true }), remaining + 200);
    return () => window.clearTimeout(timer);
  }, [hasActiveHold, holdExpiresAtMs, loadDetail]);

  const holdRemainingMs = hasActiveHold ? Math.max(0, holdExpiresAtMs - nowTick) : 0;
  const isHoldExpired = hasActiveHold && holdRemainingMs <= 0;
  const isBookingExpired = getStatusKey(booking?.status) === "expired" || isHoldExpired;

  const formatCountdown = (msRemaining) => {
    const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const groupedTrips = useMemo(() => {
    if (!booking) return [];
    const map = new Map();
    booking.items.forEach((item) => {
      if (!map.has(item.tripCode)) map.set(item.tripCode, []);
      map.get(item.tripCode).push(item);
    });
    return [...map.entries()].map(([tripCode, items]) => {
      const rows = nestCompanionsUnderHolders(items);
      const companionCount = rows.reduce((sum, row) => sum + row.companions.length, 0);
      const sample = rows.find((row) => row.holder)?.holder
        || items.find((item) => !item.usesCompanionTicket)
        || items[0]
        || null;
      return {
        tripCode,
        isReturn: Boolean(booking.returnTripCode) && tripCode === booking.returnTripCode,
        rows,
        ticketCount: rows.filter((row) => row.holder).length,
        companionCount,
        fromStationName: sample?.fromStationName || "—",
        toStationName: sample?.toStationName || "—",
        scheduledDeparture: sample?.scheduledDeparture || "",
        scheduledArrival: sample?.scheduledArrival || "",
        boatCode: sample?.boatCode || "",
        boatName: sample?.boatName || "",
      };
    }).sort((a, b) => {
      // Chiều đi trước chiều về; cùng chiều thì theo giờ khởi hành.
      if (a.isReturn !== b.isReturn) return a.isReturn ? 1 : -1;
      const ta = Date.parse(String(a.scheduledDeparture || "")) || 0;
      const tb = Date.parse(String(b.scheduledDeparture || "")) || 0;
      return ta - tb;
    });
  }, [booking]);

  const totalTicketCount = useMemo(
    () => groupedTrips.reduce((sum, group) => sum + group.ticketCount, 0),
    [groupedTrips],
  );
  const totalCompanionCount = useMemo(
    () => groupedTrips.reduce((sum, group) => sum + group.companionCount, 0),
    [groupedTrips],
  );
  // Giá vé = tổng unitPrice các vé có ghế (không gồm INFANT 0đ / bảo hiểm).
  const ticketFareAmount = useMemo(() => {
    if (!booking?.items?.length) return 0;
    return booking.items.reduce((sum, item) => {
      if (item.usesCompanionTicket) return sum;
      return sum + (Number(item.unitPrice) || 0);
    }, 0);
  }, [booking]);
  const insuranceAmount = Number(booking?.insurance?.totalAmount) || 0;
  const insuranceUnit = Number(booking?.insurance?.unitPremiumAmount) || 0;
  const insuranceQty = Number(booking?.insurance?.quantity) || 0;

  // BE: ẩn hoàn tiền cho booking thường + sightseeing. Charter dùng luồng riêng (hủy → nhập STK).
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        <DetailSkeleton />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-4xl border border-dashed border-slate-200 bg-white p-16 text-center dark:border-slate-700 dark:bg-slate-800">
          <span className="material-symbols-outlined mb-3 block text-5xl text-slate-300 dark:text-slate-600">search_off</span>
          <p className="font-headline text-lg font-black text-slate-500 dark:text-slate-300">
            {lang === "VN" ? "Không tìm thấy booking này." : "This booking could not be found."}
          </p>
          <button
            type="button"
            onClick={() => navigate(listPath)}
            className="mt-4 rounded-xl bg-[#FFD100] px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-900"
          >
            {lang === "VN" ? "Về danh sách vé" : "Back to bookings"}
          </button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-100 bg-red-50 p-6 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {errorMsg}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl space-y-5">
        <button
          type="button"
          onClick={() => navigate(listPath)}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Về danh sách vé" : "Back to bookings"}
        </button>

        {/* HEADER — cùng ngôn ngữ card danh sách vé */}
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <div className="flex flex-col gap-4 border-l-4 border-[#124757] p-5 pl-5 dark:border-yellow-400 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400">
                {lang === "VN" ? "Chi tiết đặt vé" : "Booking detail"}
              </p>
              <h1 className="mt-1 truncate font-headline text-2xl font-black text-[#124757] dark:text-white">
                {lang === "VN" ? "MÃ ĐẶT CHỖ" : "BOOKING CODE"}: {booking.bookingCode}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {lang === "VN" ? "Đặt lúc" : "Booked at"} {formatDateTime(booking.bookedAt)}
                {totalTicketCount > 0
                  ? ` · ${totalTicketCount} ${lang === "VN" ? "vé" : "ticket(s)"}`
                  : ""}
                {totalCompanionCount > 0
                  ? ` · ${totalCompanionCount} ${lang === "VN" ? "đi kèm" : "companion(s)"}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={booking.status} lang={lang} size="lg" />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          <div className="space-y-5 lg:col-span-7">
            {groupedTrips.map((group) => (
              <div key={group.tripCode} className="space-y-5">
                <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-headline font-black text-[#124757] dark:text-yellow-400">
                        {group.isReturn
                          ? (lang === "VN" ? "Chiều về" : "Return")
                          : (lang === "VN" ? "Chiều đi" : "Departure")}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {group.ticketCount} {lang === "VN" ? "vé" : "ticket(s)"}
                      {group.companionCount > 0
                        ? ` · ${group.companionCount} ${lang === "VN" ? "đi kèm" : "companion(s)"}`
                        : ""}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {group.rows.flatMap((row) => {
                      const item = row.holder;
                      if (!item) {
                        return row.companions.map((companion) => (
                          <article key={companion.id} className="p-5 sm:p-6">
                            <CompanionChip companion={companion} lang={lang} />
                          </article>
                        ));
                      }

                      const isLoopTour = item.fromStationName && item.fromStationName === item.toStationName;
                      const sameDay = formatDateOnly(item.scheduledArrival) === formatDateOnly(item.scheduledDeparture);
                      const routeTitle = isLoopTour
                        ? (lang === "VN"
                          ? `Tour tham quan sông Sài Gòn`
                          : `Sightseeing tour on Saigon River`)
                        : `${item.fromStationName} → ${item.toStationName}`;
                      const timeLine = `${formatDateOnly(item.scheduledDeparture)} · ${formatTime(item.scheduledDeparture)} → ${sameDay ? "" : `${formatDateOnly(item.scheduledArrival)} `}${formatTime(item.scheduledArrival)}`;

                      return [(
                        <article key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:gap-5 sm:p-6">
                          {isTicketVisible(booking, item) && item.ticketQrToken ? (
                            <div className="flex shrink-0 items-start gap-3">
                              <QrCodeBlock
                                value={item.ticketQrToken}
                                label={lang === "VN" ? "QR vé" : "Ticket QR"}
                                size={72}
                              />
                            </div>
                          ) : null}

                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h3 className="font-headline text-base font-black text-[#124757] dark:text-white">
                                  {routeTitle}
                                </h3>
                                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {timeLine}
                                </p>
                              </div>
                              <StatusBadge status={item.ticketStatus || item.itemStatus} lang={lang} />
                            </div>

                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                              <div>
                                <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Ghế" : "Seat"}</dt>
                                <dd className="font-bold text-[#124757] dark:text-yellow-400">{item.seatNumber || "—"}</dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Loại vé" : "Type"}</dt>
                                <dd className="font-bold text-slate-700 dark:text-slate-200">
                                  {formatTicketTypeLabel(item.ticketTypeCode || item.ticketTypeName, lang)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Giá vé" : "Ticket fare"}</dt>
                                <dd className="font-bold text-slate-700 dark:text-slate-200">{currencyFormatter.format(item.unitPrice)}</dd>
                              </div>
                              <div className="col-span-2 sm:col-span-3">
                                <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Tàu" : "Boat"}</dt>
                                <dd className="font-bold text-slate-700 dark:text-slate-200">
                                  {item.boatName || (
                                    <span className="font-medium text-slate-400">
                                      {lang === "VN" ? "Đang cập nhật" : "Updating"}
                                    </span>
                                  )}
                                </dd>
                              </div>
                              <div className="col-span-2 sm:col-span-3">
                                <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Hành khách" : "Passenger"}</dt>
                                <dd className="font-bold text-slate-700 dark:text-slate-200">
                                  {item.passengerName}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Năm sinh" : "Birth year"}</dt>
                                <dd className="font-bold text-slate-700 dark:text-slate-200">
                                  {item.birthYear || "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "SĐT" : "Phone"}</dt>
                                <dd className="font-bold text-slate-700 dark:text-slate-200">
                                  {item.passengerPhone || "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-bold text-slate-400">Email</dt>
                                <dd className="font-bold text-slate-700 dark:text-slate-200 break-all">
                                  {item.passengerEmail || "—"}
                                </dd>
                              </div>
                            </dl>

                            {row.companions.length > 0 ? (
                              <div className="rounded-2xl border border-violet-200/80 bg-violet-50/90 px-3.5 py-3 dark:border-violet-500/25 dark:bg-violet-500/10">
                                <p className="text-[10px] font-headline font-black uppercase tracking-wider text-violet-700 dark:text-violet-200">
                                  {lang === "VN" ? "Đi kèm" : "Accompanying"}
                                </p>
                                <p className="mt-0.5 text-[10px] font-medium text-violet-600/80 dark:text-violet-300/70">
                                  {lang === "VN"
                                    ? "Dùng chung QR với vé người lớn phía trên."
                                    : "Shares the adult ticket QR above."}
                                </p>
                                <ul className="mt-2 space-y-1.5">
                                  {row.companions.map((companion) => (
                                    <li key={companion.id}>
                                      <CompanionChip companion={companion} lang={lang} />
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {isTicketVisible(booking, item) && item.ticketCode ? null : (() => {
                              const ticketKey = getStatusKey(item.ticketStatus || item.itemStatus);
                              if (ticketKey === "used") {
                                return (
                                  <p className="text-[11px] font-medium text-slate-400">
                                    {lang === "VN"
                                      ? "Vé đã sử dụng / hết chuyến — không còn hiệu lực để check-in."
                                      : "Ticket used / trip ended — no longer valid for check-in."}
                                  </p>
                                );
                              }
                              if (ticketKey === "checkedout") {
                                return (
                                  <p className="text-[11px] font-medium text-slate-400">
                                    {lang === "VN" ? "Đã check-out — hành khách đã rời tàu." : "Checked out — passenger has left the boat."}
                                  </p>
                                );
                              }
                              if (ticketKey === "cancelled" || ticketKey === "expired") {
                                return (
                                  <p className="text-[11px] font-medium text-slate-400">
                                    {lang === "VN" ? "Vé không còn hợp lệ." : "Ticket is no longer valid."}
                                  </p>
                                );
                              }
                              if (!isTicketIssued(booking, item)) {
                                return (
                                  <p className="text-[11px] font-medium text-slate-400">
                                    {lang === "VN"
                                      ? "Vé điện tử sẽ hiện sau khi thanh toán thành công và vé được kích hoạt."
                                      : "The e-ticket appears after successful payment and ticket activation."}
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </article>
                      )];
                    })}
                  </div>
                </section>
              </div>
            ))}

            {bookingReviewable ? (
              <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
                <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-700 sm:px-6">
                  <h3 className="font-headline text-sm font-black text-[#124757] dark:text-white">
                    {lang === "VN" ? "Đánh giá của bạn" : "Your review"}
                  </h3>
                </div>
                <TripReviewSlot
                  reviewable={bookingReviewable}
                  lang={lang}
                  onOpenReview={() => setReviewModalOpen(true)}
                />
              </section>
            ) : null}
          </div>

          <div className="space-y-5 lg:sticky lg:top-28 lg:col-span-5">
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
              <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-700 sm:px-6">
                <h3 className="font-headline text-sm font-black text-[#124757] dark:text-white">
                  {lang === "VN" ? "Chi tiết booking" : "Booking details"}
                </h3>
              </div>
              <div className="space-y-4 p-5 sm:p-6">
                {groupedTrips.length > 0 ? (
                  <div className="space-y-3 border-b border-slate-100 pb-4 dark:border-slate-700">
                    {groupedTrips.map((group) => {
                      const isLoopTour = group.fromStationName
                        && group.fromStationName === group.toStationName;
                      const sameDay = formatDateOnly(group.scheduledArrival)
                        === formatDateOnly(group.scheduledDeparture);
                      const routeTitle = isLoopTour
                        ? (lang === "VN"
                          ? `Tour tham quan sông Sài Gòn`
                          : `Sightseeing tour on Saigon River`)
                        : `${group.fromStationName} → ${group.toStationName}`;
                      const timeLine = [
                        formatDateOnly(group.scheduledDeparture),
                        `${formatTime(group.scheduledDeparture)} → ${sameDay ? "" : `${formatDateOnly(group.scheduledArrival)} `}${formatTime(group.scheduledArrival)}`,
                      ].filter(Boolean).join(" · ");
                      return (
                        <div key={`summary-${group.tripCode}`} className="space-y-1">
                          <p className="text-[11px] font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
                            {group.isReturn
                              ? (lang === "VN" ? "Chiều về" : "Return")
                              : (lang === "VN" ? "Chiều đi" : "Departure")}
                          </p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {routeTitle}
                          </p>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {timeLine}
                          </p>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {lang === "VN" ? "Tàu" : "Boat"}:{" "}
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                              {group.boatName || (lang === "VN" ? "Đang cập nhật" : "Updating")}
                            </span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {(booking.contactName || booking.contactPhone || booking.contactEmail) ? (
                  <div className="space-y-1.5 border-b border-slate-100 pb-4 text-sm dark:border-slate-700">
                    <p className="text-[11px] font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
                      {lang === "VN" ? "Người đặt vé" : "Booker"}
                    </p>
                    {booking.contactName ? (
                      <p className="font-bold text-slate-800 dark:text-slate-100">{booking.contactName}</p>
                    ) : null}
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {lang === "VN" ? "SĐT" : "Phone"}:{" "}
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {booking.contactPhone || "—"}
                      </span>
                    </p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Email:{" "}
                      <span className="font-bold text-slate-700 dark:text-slate-200 break-all">
                        {booking.contactEmail || "—"}
                      </span>
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between gap-3">
                    <span>{lang === "VN" ? "Tổng số vé" : "Total tickets"}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {totalTicketCount + totalCompanionCount}
                      {totalCompanionCount > 0
                        ? (
                          <span className="ml-1 text-xs font-medium text-slate-400">
                            {lang === "VN"
                              ? `(${totalTicketCount} vé · ${totalCompanionCount} đi kèm)`
                              : `(${totalTicketCount} ticket(s) · ${totalCompanionCount} companion(s))`}
                          </span>
                        )
                        : null}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>{lang === "VN" ? "Giá vé" : "Ticket fare"}</span>
                    <span className="font-bold">
                      {ticketFareAmount > 0
                        ? `+${currencyFormatter.format(ticketFareAmount)}`
                        : currencyFormatter.format(0)}
                    </span>
                  </div>
                  <div className={`flex justify-between gap-3 ${booking.discountAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    <span>{lang === "VN" ? "Giảm giá" : "Discount"}</span>
                    <span className="font-bold">
                      {booking.discountAmount > 0
                        ? `-${currencyFormatter.format(booking.discountAmount)}`
                        : currencyFormatter.format(0)}
                    </span>
                  </div>
                  {insuranceAmount > 0 ? (
                    <div className="space-y-0.5">
                      <div className="flex justify-between gap-3">
                        <span>{lang === "VN" ? "Bảo hiểm" : "Insurance"}</span>
                        <span className="font-bold">+{currencyFormatter.format(insuranceAmount)}</span>
                      </div>
                      {(insuranceUnit > 0 || insuranceQty > 0) ? (
                        <p className="text-right text-[11px] font-medium text-slate-400">
                          {insuranceUnit > 0 && insuranceQty > 0
                            ? `${currencyFormatter.format(insuranceUnit)}/${lang === "VN" ? "khách" : "pax"} × ${insuranceQty}`
                            : (insuranceQty > 0
                              ? `${insuranceQty} ${lang === "VN" ? "khách" : "pax"}`
                              : "")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex justify-between gap-3">
                      <span>{lang === "VN" ? "Bảo hiểm" : "Insurance"}</span>
                      <span className="font-bold">{currencyFormatter.format(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span>{lang === "VN" ? "Điểm đã dùng" : "Points used"}</span>
                    <span className="font-bold">
                      {booking.pointsUsed > 0 ? `-${booking.pointsUsed}` : 0}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                    <span className="font-headline font-black text-[#124757] dark:text-white">
                      {lang === "VN" ? "Tổng cộng" : "Total"}
                    </span>
                    <span className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                      {currencyFormatter.format(booking.totalAmount)}
                    </span>
                  </div>
                </div>

                {getStatusKey(booking.status) === "pendingpayment" && booking.holdExpiresAt ? (
                  <div className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${isBookingExpired
                      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                    }`}
                  >
                    {isBookingExpired ? (
                      <p>{lang === "VN" ? "Booking đã hết hạn" : "Booking has expired"}</p>
                    ) : (
                      <>
                        <p>
                          {lang === "VN" ? "Giữ chỗ đến" : "Held until"}: {formatDateTime(booking.holdExpiresAt)}
                        </p>
                        <p className="mt-1 font-headline text-base font-black tabular-nums">
                          {formatCountdown(holdRemainingMs)}
                        </p>
                        <p className="mt-1 text-[10px] font-medium opacity-80">
                          {lang === "VN"
                            ? "Thời gian giữ chỗ có thể ngắn hơn nếu gần giờ tàu chạy."
                            : "Hold time may be shorter when departure is near."}
                        </p>
                      </>
                    )}
                  </div>
                ) : null}

                {getStatusKey(booking.status) === "expired" && !booking.holdExpiresAt ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                    {lang === "VN" ? "Booking đã hết hạn" : "Booking has expired"}
                  </div>
                ) : null}

                {booking.bookingQrToken ? (
                  <div className="flex items-start gap-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                    <QrCodeBlock
                      value={booking.bookingQrToken}
                      label={lang === "VN" ? "QR booking" : "Booking QR"}
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-400">
                        {lang === "VN" ? "Mã QR booking" : "Booking QR code"}
                      </p>
                      <CopyableCode value={booking.bookingQrToken} />
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {(booking.insuranceSelected === true || booking.insurance || booking.insuranceSelected === false) && (
              <CharterInsuranceInfo
                booking={booking}
                lang={lang}
                currencyFormatter={currencyFormatter}
                bookingType={INSURANCE_BOOKING_TYPES.PASSENGER}
              />
            )}

            {booking.payments.length > 0 && (
              <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
                <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-700 sm:px-6">
                  <h3 className="font-headline text-sm font-black text-[#124757] dark:text-white">
                    {lang === "VN" ? "Lịch sử thanh toán" : "Payment history"}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {booking.payments.map((payment) => {
                    const paymentExpired = Boolean(
                      payment.expiresAt && new Date(payment.expiresAt).getTime() <= nowTick,
                    );
                    const isPayable = getStatusKey(payment.paymentStatus) === "pending"
                      && payment.checkoutUrl
                      && !isBookingExpired
                      && !paymentExpired;
                    return (
                      <div key={payment.id} className="space-y-2 p-5 sm:px-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">{payment.paymentCode}</span>
                          <StatusBadge status={payment.paymentStatus} lang={lang} />
                        </div>
                        <p className="text-xs font-medium text-slate-400">
                          {payment.paymentMethod || "PayOS"}
                          {payment.paidAt
                            ? ` · ${lang === "VN" ? "Thanh toán lúc" : "Paid at"} ${formatDateTime(payment.paidAt)}`
                            : ""}
                        </p>
                        {payment.expiresAt && getStatusKey(payment.paymentStatus) === "pending" && !payment.paidAt ? (
                          <p className={`text-xs font-bold ${paymentExpired ? "text-rose-500" : "text-amber-700 dark:text-amber-300"}`}>
                            {paymentExpired
                              ? (lang === "VN" ? "Link thanh toán đã hết hạn" : "Payment link expired")
                              : `${lang === "VN" ? "Hạn thanh toán" : "Pay by"}: ${formatDateTime(payment.expiresAt)}`}
                          </p>
                        ) : null}
                        {payment.refundAmount > 0 ? (
                          <p className="text-xs font-bold text-rose-500">
                            {lang === "VN" ? "Đã hoàn" : "Refunded"}: {currencyFormatter.format(payment.refundAmount)}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <span className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                            {currencyFormatter.format(payment.amount)}
                          </span>
                          {isPayable ? (
                            <a href={payment.checkoutUrl} target="_blank" rel="noreferrer" className={payosButtonClassName}>
                              <PayOSLogo variant="white" className="h-4 w-auto" />
                              {lang === "VN" ? "Thanh toán" : "Pay"}
                            </a>
                          ) : null}
                        </div>
                        {isPayable ? (
                          <p className="text-[11px] font-medium text-slate-400">
                            {lang === "VN"
                              ? "Thanh toán trên cổng PayOS."
                              : "Complete payment on PayOS."}
                          </p>
                        ) : null}
                        {!isPayable && getStatusKey(payment.paymentStatus) === "pending" && (isBookingExpired || paymentExpired) ? (
                          <p className="text-[11px] font-medium text-rose-500">
                            {lang === "VN"
                              ? "Booking/link đã hết hạn. Vui lòng đặt lại hoặc tạo thanh toán mới."
                              : "Booking/link expired. Please book again or create a new payment."}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {reviewModalOpen ? (
        <TripReviewModal
          lang={lang}
          onClose={() => setReviewModalOpen(false)}
          onSubmitted={(rating, comment) => handleReviewSubmitted(rating, comment)}
        />
      ) : null}
    </div>
  );
}
