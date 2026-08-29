import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { TicketQrCameraScanner } from "../../../components/TicketQrCameraScanner";
import {
  buildEligibilityConfirmNote,
  checkInAllBookingManifest,
  checkOutAllBookingManifest,
  checkInTicket,
  checkOutTicket,
  collectConcessionCodes,
  collectEligibilityCodes,
  fetchBookingManifestByQr,
  isGroupQrToken,
  lookupTicketOrManifest,
  rejectTicketConcession,
  resolveIndividualTicketToken,
  updateCharterManifestAttendance,
} from "../../../services/ticketScanService";
import { formatTicketTypeLabel } from "../../../services/ticketTypeService";
import { createBookingPayment } from "../../../services/paymentService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { notify } from "../../../utils/swalToast";

const pickDeep = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const ticketMatchesToken = (ticket, token) => {
  const needle = String(token || "").trim().toUpperCase();
  if (!needle) return false;
  const candidates = [
    ticket?.ticketId,
    ticket?.ticketCode,
    ticket?.codeOrToken,
  ].map((v) => String(v || "").trim().toUpperCase()).filter(Boolean);
  return candidates.includes(needle);
};

/** Cập nhật UI ngay sau check-in/out — không chờ POST /tickets/scan lại. */
const applyLocalAttendance = (prev, { token = "", ticketId = "", action = "checkin" } = {}) => {
  if (!prev) return prev;
  const isIn = action === "checkin";
  const nowIso = new Date().toISOString();
  const patchFields = isIn
    ? {
      status: "CheckedIn",
      canCheckIn: false,
      canCheckOut: true,
      checkedInAt: nowIso,
    }
    : {
      status: "CheckedOut",
      canCheckIn: false,
      canCheckOut: false,
      checkedOutAt: nowIso,
    };

  if (prev.kind === "ticket") {
    return {
      ...prev,
      ...patchFields,
      checkedInAt: isIn ? (prev.checkedInAt || nowIso) : prev.checkedInAt,
      checkedOutAt: !isIn ? (prev.checkedOutAt || nowIso) : prev.checkedOutAt,
    };
  }

  if (prev.kind === "manifest" && Array.isArray(prev.tickets)) {
    return {
      ...prev,
      tickets: prev.tickets.map((ticket) => {
        const match = (ticketId && String(ticket.ticketId || "") === String(ticketId))
          || ticketMatchesToken(ticket, token);
        if (!match) return ticket;
        return {
          ...ticket,
          ...patchFields,
          checkedInAt: isIn ? (ticket.checkedInAt || nowIso) : ticket.checkedInAt,
          checkedOutAt: !isIn ? (ticket.checkedOutAt || nowIso) : ticket.checkedOutAt,
        };
      }),
    };
  }
  return prev;
};

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("vi-VN")}đ`;
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) return String(value);
  return new Date(ms).toLocaleString("vi-VN");
};

const ticketTypeLabel = (code, lang, name = "") => {
  const rawName = String(name || "").trim();
  // Ưu tiên ticketTypeName tiếng Việt từ BE (vd "Người cao tuổi trên 70").
  if (lang === "VN" && rawName && !/^(ADULT|CHILD|INFANT|SENIOR|DISABLED)$/i.test(rawName)) {
    return rawName;
  }
  return formatTicketTypeLabel(code || name, lang);
};

const formatSkippedTickets = (skipped, lang) => {
  if (!Array.isArray(skipped) || skipped.length === 0) return "";
  const labels = skipped.slice(0, 5).map((row) => {
    if (typeof row === "string") return row;
    return row?.ticketCode || row?.fullName || row?.ticketId || row?.reason || "—";
  });
  const more = skipped.length > 5 ? ` (+${skipped.length - 5})` : "";
  return lang === "VN"
    ? `Bỏ qua ${skipped.length}: ${labels.join(", ")}${more}`
    : `Skipped ${skipped.length}: ${labels.join(", ")}${more}`;
};

const eligibilityCodesOf = (ticket) => (
  Array.isArray(ticket?.eligibilityCodes) && ticket.eligibilityCodes.length
    ? ticket.eligibilityCodes
    : collectEligibilityCodes(ticket)
);

const concessionCodesOf = (ticket) => (
  Array.isArray(ticket?.concessionCodes) && ticket.concessionCodes.length
    ? ticket.concessionCodes
    : collectConcessionCodes(ticket)
);

const formatClock = (value) => {
  if (!value) return "—";
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) {
    const m = String(value).match(/(\d{1,2}):(\d{2})/);
    return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "—";
  }
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const statusTone = (ticket) => {
  const raw = String(ticket?.status || "").toLowerCase().replace(/[\s_-]/g, "");
  if (ticket?.canCheckOut || raw.includes("checkedin")) {
    return {
      badge: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
      strip: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    };
  }
  // Chỉ highlight sẵn sàng khi BE cho phép check-in (đã cập bến lên / trong khung dừng).
  if (ticket?.canCheckIn) {
    return {
      badge: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200",
      strip: "border-sky-200 bg-sky-50/70 dark:border-sky-500/30 dark:bg-sky-500/10",
    };
  }
  if (raw === "active") {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
      strip: "border-amber-100 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5",
    };
  }
  if (raw.includes("checkout") || raw.includes("used") || raw.includes("complete")) {
    return {
      badge: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300",
      strip: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50",
    };
  }
  return {
    badge: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300",
    strip: "border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800",
  };
};

const statusLabel = (ticket, lang) => {
  const raw = String(ticket?.status || "").toLowerCase().replace(/[\s_-]/g, "");
  if (raw.includes("used")) {
    return lang === "VN" ? "Đã sử dụng" : "Used";
  }
  if (raw.includes("expired")) {
    return lang === "VN" ? "Hết hạn" : "Expired";
  }
  if (raw.includes("cancel")) {
    return lang === "VN" ? "Đã hủy" : "Cancelled";
  }
  // checkedout trước checkedin — "checkedout".includes("checkedin") === false nhưng dễ nhầm thứ tự.
  if (raw.includes("checkedout") || raw === "checkout") {
    return lang === "VN" ? "Đã check-out" : "Checked out";
  }
  if (ticket?.canCheckOut || raw.includes("checkedin")) {
    return lang === "VN" ? "Đã check-in" : "Checked in";
  }
  if (ticket?.canCheckIn) {
    return lang === "VN" ? "Sẵn sàng check-in" : "Ready to check in";
  }
  if (raw === "active") {
    return lang === "VN" ? "Chờ cập bến" : "Waiting at berth";
  }
  return ticket?.status || "—";
};

const statusKeyOf = (value) => String(value || "").toLowerCase().replace(/[\s_-]/g, "");

const bookingStatusLabel = (value, lang) => {
  const key = statusKeyOf(value);
  if (!key) return "—";
  const map = {
    pendingpayment: { vn: "Chờ thanh toán", en: "Pending payment" },
    pending: { vn: "Chờ xử lý", en: "Pending" },
    confirmed: { vn: "Đã xác nhận", en: "Confirmed" },
    completed: { vn: "Hoàn tất", en: "Completed" },
    cancelled: { vn: "Đã hủy", en: "Cancelled" },
    canceled: { vn: "Đã hủy", en: "Cancelled" },
    expired: { vn: "Hết hạn", en: "Expired" },
    refunded: { vn: "Đã hoàn tiền", en: "Refunded" },
  };
  const row = map[key];
  if (!row) return String(value);
  return lang === "VN" ? row.vn : row.en;
};

const paymentStatusLabel = (value, lang) => {
  const key = statusKeyOf(value);
  if (!key) return "—";
  const map = {
    paid: { vn: "Đã thanh toán", en: "Paid" },
    unpaid: { vn: "Chưa thanh toán", en: "Unpaid" },
    pending: { vn: "Chờ thanh toán", en: "Pending" },
    pendingpayment: { vn: "Chờ thanh toán", en: "Pending payment" },
    depositpaid: { vn: "Đã cọc", en: "Deposit paid" },
    failed: { vn: "Thanh toán thất bại", en: "Failed" },
    refunded: { vn: "Đã hoàn tiền", en: "Refunded" },
    partiallyrefunded: { vn: "Hoàn một phần", en: "Partially refunded" },
  };
  const row = map[key];
  if (!row) return String(value);
  return lang === "VN" ? row.vn : row.en;
};

const ticketTypeTone = (code) => {
  const key = String(code || "").toUpperCase();
  if (key === "SENIOR") {
    return "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100";
  }
  if (key === "DISABLED") {
    return "border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-100";
  }
  if (key === "CHILD") {
    return "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-100";
  }
  if (key === "INFANT") {
    return "border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-100";
  }
  return "border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200";
};

/** Hiển thị passengers[] trên 1 vé: holder + INFANT đi kèm (chung QR). CHILD = vé riêng. */
const PassengersOnTicket = ({ ticket, lang, compact = false }) => {
  const passengers = Array.isArray(ticket?.passengers) ? ticket.passengers : [];
  const isCompanion = (row) => Boolean(
    row?.isLapInfant
    || row?.usesCompanionTicket
    || String(row?.ticketTypeCode || "").toUpperCase() === "INFANT",
  );
  const holders = passengers.filter((row) => !isCompanion(row));
  const companions = passengers.filter((row) => isCompanion(row));
  const sharedTicketCode = ticket?.ticketCode || ticket?.codeOrToken || "";

  const companionsForHolder = (holder) => {
    const holderName = String(holder?.fullName || "").trim().toLowerCase();
    const matched = companions.filter((row) => {
      const companion = String(row.companionPassengerName || "").trim().toLowerCase();
      return companion && holderName && companion === holderName;
    });
    if (matched.length) return matched;
    if (holders.length === 1) return companions;
    return [];
  };

  const orphanCompanions = companions.filter(
    (row) => !holders.some((holder) => companionsForHolder(holder).includes(row)),
  );

  const birthYearLine = (row) => {
    if (!row?.birthYear) return "";
    return lang === "VN" ? ` · Năm sinh ${row.birthYear}` : ` · Born ${row.birthYear}`;
  };

  if (!passengers.length) {
    if (compact) return null;
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-xs font-black text-slate-700 dark:text-slate-200">{ticket.passengerName || "—"}</p>
      </div>
    );
  }

  // 1 khách, không đi kèm → không lặp khối (đã hiện ở hero).
  if (compact && holders.length <= 1 && companions.length === 0) return null;

  const renderCompanion = (row) => {
    const type = String(row.ticketTypeCode || "").toUpperCase();
    const isInfant = row.isLapInfant || type === "INFANT";
    return (
      <div
        key={`companion-${row.fullName}-${row.companionPassengerName}-${row.seatCode}`}
        className={`mt-2 rounded-xl border px-3 py-2 ${
          isInfant
            ? "border-violet-200 bg-violet-50/80 dark:border-violet-500/30 dark:bg-violet-500/10"
            : "border-sky-200 bg-sky-50/80 dark:border-sky-500/30 dark:bg-sky-500/10"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-lg border bg-white px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wider dark:bg-slate-900 ${
            isInfant
              ? "border-violet-200 text-violet-700 dark:border-violet-500/30 dark:text-violet-200"
              : "border-sky-200 text-sky-700 dark:border-sky-500/30 dark:text-sky-200"
          }`}>
            {isInfant
              ? (lang === "VN" ? "Em bé đi kèm" : "Lap infant")
              : (lang === "VN" ? "Trẻ em đi kèm" : "Child companion")}
          </span>
        </div>
        <p className={`mt-1 text-xs font-black ${
          isInfant ? "text-violet-950 dark:text-violet-100" : "text-sky-950 dark:text-sky-100"
        }`}>
          {row.fullName}
        </p>
        <p className={`mt-0.5 text-[10px] font-bold ${
          isInfant ? "text-violet-700/90 dark:text-violet-200/90" : "text-sky-700/90 dark:text-sky-200/90"
        }`}>
          {lang === "VN" ? "Đi kèm với" : "With"}: {row.companionPassengerName || ticket.passengerName || "—"}
          {row.seatCode ? ` · ${lang === "VN" ? "Ghế" : "Seat"} ${row.seatCode}` : ""}
          {birthYearLine(row)}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
        {lang === "VN" ? "Hành khách trên vé" : "Passengers on ticket"}
        {sharedTicketCode ? ` · ${sharedTicketCode}` : ""}
      </p>
      {holders.map((holder) => (
        <div
          key={`holder-${holder.fullName}-${holder.seatCode}`}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900"
        >
          <p className="text-xs font-black text-[#124757] dark:text-yellow-400">{holder.fullName}</p>
          <p className="mt-0.5 text-[10px] font-bold text-slate-500">
            {ticketTypeLabel(holder.ticketTypeCode || ticket.ticketTypeCode, lang, holder.ticketTypeName || ticket.ticketTypeName)}
            {" · "}
            {holder.seatCode || ticket.seatLabel
              ? `${lang === "VN" ? "Ghế" : "Seat"} ${holder.seatCode || ticket.seatLabel}`
              : (lang === "VN" ? "Chưa có ghế" : "No seat")}
            {birthYearLine(holder)}
          </p>
          {holder.phoneNumber ? (
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">{holder.phoneNumber}</p>
          ) : null}
          {companionsForHolder(holder).map(renderCompanion)}
        </div>
      ))}
      {orphanCompanions.map(renderCompanion)}
      {!holders.length && companions.map(renderCompanion)}
    </div>
  );
};

const DetailField = ({ label, children, className = "" }) => (
  <div className={className}>
    <dt className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
      {label}
    </dt>
    <dd className="mt-1 text-sm font-black text-slate-800 dark:text-slate-100">
      {children}
    </dd>
  </div>
);

/** Card chi tiết vé — ưu tiên thông tin staff cần đối chiếu / thao tác. */
const TicketResultCard = ({
  ticket,
  lang,
  isActing,
  onCheckIn,
  onCheckOut,
  onRejectEligibility,
}) => {
  const tone = statusTone(ticket);
  const typeCode = String(ticket.ticketTypeCode || "").toUpperCase();
  const typeLabel = ticketTypeLabel(typeCode, lang, ticket.ticketTypeName);
  const needsVerify = concessionCodesOf(ticket).length > 0;
  const routeLine = [ticket.fromStation, ticket.toStation].filter(Boolean).join(" → ") || "—";
  const stationCodes = [ticket.fromStationCode, ticket.toStationCode].filter(Boolean).join(" → ");
  const primary = ticket.primaryPassenger || ticket.passengers?.find((p) => !p.isLapInfant) || null;
  const raw = ticket.raw && typeof ticket.raw === "object" ? ticket.raw : {};
  const rawPassenger = raw.ticketPassenger || raw.TicketPassenger || null;
  const phone = String(
    ticket.passengerPhone
    || primary?.phoneNumber
    || raw.contactPhone
    || raw.ContactPhone
    || rawPassenger?.phoneNumber
    || rawPassenger?.PhoneNumber
    || "",
  ).trim();
  const email = String(
    ticket.passengerEmail
    || primary?.email
    || raw.contactEmail
    || raw.ContactEmail
    || rawPassenger?.email
    || rawPassenger?.Email
    || "",
  ).trim();
  const birthYear = ticket.birthYear || primary?.birthYear || "";
  const passengerCount = Array.isArray(ticket.passengers) && ticket.passengers.length
    ? ticket.passengers.length
    : (ticket.passengerCount || 1);
  const passengerTypeCode = String(
    ticket.passengerType || primary?.passengerType || typeCode || "",
  ).toUpperCase();

  return (
    <div className={`overflow-hidden rounded-4xl border shadow-sm dark:border-slate-700/50 ${tone.strip}`}>
      {/* Hero */}
      <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/60 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-xl border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wide ${tone.badge}`}>
                {statusLabel(ticket, lang)}
              </span>
              {needsVerify && ticket.canCheckIn ? (
                <span className="rounded-xl border border-amber-300 bg-amber-100 px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wide text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100">
                  {lang === "VN" ? "Cần đối chiếu giấy tờ" : "Verify ID"}
                </span>
              ) : null}
            </div>
            <h3 className="mt-2 font-headline text-xl font-black text-[#124757] dark:text-yellow-400 sm:text-2xl">
              {ticket.passengerName || "—"}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-[11px] font-headline font-black ${ticketTypeTone(typeCode)}`}>
                {typeLabel}
                {passengerTypeCode && passengerTypeCode !== typeCode ? (
                  <span className="ml-1.5 opacity-70">· {passengerTypeCode}</span>
                ) : null}
                {ticket.price != null && Number(ticket.price) === 0 ? (
                  <span className="ml-1.5 opacity-80">· {lang === "VN" ? "Miễn phí" : "Free"}</span>
                ) : null}
              </span>
              {ticket.boatName ? (
                <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {ticket.boatName}
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {passengerCount} {lang === "VN" ? "hành khách" : "pax"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#124757]/20 bg-white px-4 py-2.5 text-center shadow-sm dark:border-yellow-400/30 dark:bg-slate-900">
            <p className="text-[9px] font-headline font-black uppercase tracking-widest text-slate-400">
              {lang === "VN" ? "Ghế" : "Seat"}
            </p>
            <p className="font-headline text-2xl font-black tabular-nums text-[#124757] dark:text-yellow-400">
              {ticket.seatLabel || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Hành khách chi tiết — ticketPassenger + ticketStatus */}
      <div className="border-b border-slate-200/70 bg-white/60 px-5 py-4 dark:border-slate-700/60 dark:bg-slate-900/30 sm:px-6">
        <p className="mb-3 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Thông tin hành khách" : "Passenger details"}
        </p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailField label={lang === "VN" ? "Họ và tên" : "Full name"}>
            {ticket.passengerName || primary?.fullName || "—"}
          </DetailField>
          <DetailField label={lang === "VN" ? "Loại vé" : "Ticket type"}>
            <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-headline font-black ${ticketTypeTone(passengerTypeCode || typeCode)}`}>
              {ticketTypeLabel(passengerTypeCode || typeCode, lang, ticket.ticketTypeName)}
            </span>
          </DetailField>
          <DetailField label={lang === "VN" ? "Năm sinh" : "Birth year"}>
            {birthYear || "—"}
          </DetailField>
          <DetailField label={lang === "VN" ? "Trạng thái vé" : "Ticket status"}>
            {statusLabel(ticket, lang)}
          </DetailField>
          <DetailField label={lang === "VN" ? "Số điện thoại" : "Phone"}>
            {phone || "—"}
          </DetailField>
          <DetailField label="Email">
            <span className="break-all text-xs">{email || "—"}</span>
          </DetailField>
          {ticket.contactName && ticket.contactName !== ticket.passengerName ? (
            <DetailField label={lang === "VN" ? "Người liên hệ" : "Contact"}>
              {ticket.contactName}
            </DetailField>
          ) : null}
        </dl>
        <div className="mt-3">
          <PassengersOnTicket ticket={ticket} lang={lang} compact />
        </div>
      </div>

      {/* Lộ trình / chuyến */}
      <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/60 sm:px-6">
        <p className="mb-3 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Lộ trình & chuyến" : "Route & trip"}
        </p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailField label={lang === "VN" ? "Ga lên → xuống" : "From → to"} className="sm:col-span-2">
            {routeLine}
            {stationCodes ? (
              <span className="mt-0.5 block text-[11px] font-bold text-slate-400">{stationCodes}</span>
            ) : null}
          </DetailField>
          <DetailField label={lang === "VN" ? "Giờ lên dự kiến" : "Board at"}>
            <span className="tabular-nums">
              {ticket.scheduledBoardingAt
                ? formatClock(ticket.scheduledBoardingAt)
                : (ticket.startTime || "—")}
            </span>
          </DetailField>
          <DetailField label={lang === "VN" ? "Giờ xuống dự kiến" : "Alight at"}>
            <span className="tabular-nums">{formatClock(ticket.scheduledAlightingAt)}</span>
          </DetailField>
          <DetailField label={lang === "VN" ? "Ngày khởi hành" : "Departure date"}>
            {ticket.departureDate || "—"}
          </DetailField>
          <DetailField label={lang === "VN" ? "Tàu" : "Boat"}>
            {ticket.boatName || "—"}
          </DetailField>
          <DetailField label={lang === "VN" ? "Mã chuyến" : "Trip code"} className="sm:col-span-2">
            <span className="break-all text-xs">{ticket.tripCode || "—"}</span>
            {ticket.legLabel ? (
              <span className="mt-0.5 block text-[11px] font-bold text-slate-500">{ticket.legLabel}</span>
            ) : null}
          </DetailField>
        </dl>
      </div>

      {/* Mã / booking */}
      <div className="border-b border-slate-200/70 bg-white/50 px-5 py-4 dark:border-slate-700/60 dark:bg-slate-900/20 sm:px-6">
        <p className="mb-3 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Mã & thanh toán" : "Codes & payment"}
        </p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailField label={lang === "VN" ? "Mã vé" : "Ticket code"}>
            <span className="font-mono text-xs">{ticket.ticketCode || ticket.codeOrToken || "—"}</span>
          </DetailField>
          <DetailField label={lang === "VN" ? "Mã booking" : "Booking code"}>
            <span className="font-mono text-xs">{ticket.bookingCode || "—"}</span>
          </DetailField>
          <DetailField label={lang === "VN" ? "Ghế" : "Seat"}>
            {ticket.seatLabel || "—"}
          </DetailField>
          <DetailField label={lang === "VN" ? "Giá vé" : "Fare"}>
            {formatMoney(ticket.price)}
            {ticket.price != null && Number(ticket.price) === 0 ? (
              <span className="ml-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                ({lang === "VN" ? "miễn phí" : "free"})
              </span>
            ) : null}
          </DetailField>
          <DetailField label={lang === "VN" ? "Trạng thái booking" : "Booking status"}>
            {bookingStatusLabel(
              ticket.bookingStatus
              || ticket.raw?.bookingStatus
              || ticket.raw?.BookingStatus
              || "",
              lang,
            )}
          </DetailField>
          <DetailField label={lang === "VN" ? "Thanh toán" : "Payment"}>
            {paymentStatusLabel(
              ticket.paymentStatus
              || ticket.raw?.paymentStatus
              || ticket.raw?.PaymentStatus
              || "",
              lang,
            )}
          </DetailField>
        </dl>
      </div>

      {/* Check-in / out */}
      <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-700/60 sm:px-6">
        <p className="mb-3 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Lịch sử soát vé" : "Scan history"}
        </p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailField label={lang === "VN" ? "Check-in" : "Checked in"}>
            {ticket.checkedInAt ? formatDateTime(ticket.checkedInAt) : (lang === "VN" ? "Chưa check-in" : "Not yet")}
            {ticket.checkedInByName ? (
              <span className="mt-0.5 block text-[11px] font-bold text-slate-500">
                {lang === "VN" ? "Bởi" : "By"}: {ticket.checkedInByName}
              </span>
            ) : null}
          </DetailField>
          <DetailField label={lang === "VN" ? "Check-out" : "Checked out"}>
            {ticket.checkedOutAt ? formatDateTime(ticket.checkedOutAt) : "—"}
            {ticket.checkedOutByName ? (
              <span className="mt-0.5 block text-[11px] font-bold text-slate-500">
                {lang === "VN" ? "Bởi" : "By"}: {ticket.checkedOutByName}
              </span>
            ) : null}
          </DetailField>
        </dl>
      </div>

      <div className="bg-white px-5 py-4 dark:bg-slate-800 sm:px-6">
        <TicketActionButtons
          ticket={ticket}
          lang={lang}
          isActing={isActing}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          onRejectEligibility={onRejectEligibility}
        />
      </div>
    </div>
  );
};

/** Nút theo BE: canCheckIn → Check-in; ưu đãi cần xác nhận đối tượng trước. */
const TicketActionButtons = ({
  ticket,
  lang,
  isActing,
  onCheckIn,
  onCheckOut,
  onRejectEligibility,
}) => {
  const statusKey = String(ticket?.status || "").toLowerCase().replace(/[\s_-]/g, "");
  if (statusKey.includes("used") || statusKey.includes("cancelled") || statusKey.includes("canceled")) {
    return (
      <p className="text-[11px] font-bold text-slate-400">
        {statusKey.includes("used")
          ? (lang === "VN" ? "Vé đã sử dụng — không check-in được." : "Ticket used — check-in disabled.")
          : (lang === "VN" ? "Vé đã hủy — không có thao tác." : "Ticket cancelled — no actions.")}
      </p>
    );
  }

  const concessionCodes = concessionCodesOf(ticket);
  const needsConcessionCheck = ticket.canCheckIn && concessionCodes.length > 0;

  if (needsConcessionCheck) {
    return (
      <div className="w-full space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-[11px] font-black text-amber-900 dark:text-amber-100">
            {lang === "VN"
              ? "Vé ưu đãi SENIOR / DISABLED — đối chiếu giấy tờ trước khi cho lên tàu."
              : "SENIOR / DISABLED concession — verify ID before boarding."}
          </p>
          <p className="mt-1 text-[10px] font-bold text-amber-800/90 dark:text-amber-200/90">
            {concessionCodes.map((code) => ticketTypeLabel(code, lang)).join(" · ")}
            {ticket.birthYear ? ` · birthYear ${ticket.birthYear}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isActing}
            onClick={() => onCheckIn(ticket, {
              eligibilityConfirmed: true,
              eligibilityCodes: concessionCodes,
            })}
            className="rounded-xl bg-yellow-400 px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-slate-900 disabled:opacity-50"
          >
            {lang === "VN" ? "Xác nhận đúng đối tượng" : "Confirm eligible"}
          </button>
          <button
            type="button"
            disabled={isActing}
            onClick={() => onRejectEligibility(ticket, concessionCodes)}
            className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-rose-700 disabled:opacity-50 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
          >
            {lang === "VN" ? "Sai đối tượng ưu đãi" : "Wrong concession"}
          </button>
        </div>
      </div>
    );
  }

  if (ticket.canCheckIn) {
    return (
      <button
        type="button"
        disabled={isActing}
        onClick={() => onCheckIn(ticket)}
        className="w-full rounded-xl bg-yellow-400 px-5 py-3 text-[11px] font-headline font-black uppercase tracking-wider text-slate-900 disabled:opacity-50 sm:w-auto"
      >
        Check-in
      </button>
    );
  }
  if (ticket.canCheckOut) {
    return (
      <button
        type="button"
        disabled={isActing}
        onClick={() => onCheckOut(ticket)}
        className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3 text-[11px] font-headline font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 sm:w-auto"
      >
        Check-out
      </button>
    );
  }

  const statusKeyIdle = String(ticket?.status || "").toLowerCase().replace(/[\s_-]/g, "");
  const waitingBerth = statusKeyIdle === "active" || statusKeyIdle === "";
  const hint = String(ticket?.blockedReason || "").trim();
  return (
    <p className="text-[11px] font-bold leading-relaxed text-slate-500 dark:text-slate-400">
      {hint
        || (waitingBerth
          ? (lang === "VN"
            ? "Chưa đến thời gian check-in hoặc tàu chưa cập bến lên."
            : "Check-in is not open yet or the boat has not arrived at the boarding stop.")
          : (lang === "VN" ? "Không có thao tác khả dụng." : "No actions available."))}
    </p>
  );
};

/**
 * Quét vé Staff OnBoard — contract BE:
 * 1) Luôn POST /tickets/scan trước (BE tự nhận TK / BK / CB)
 * 2) Vé riêng → /tickets/check-in|out với mã TK (không gửi BK/CB)
 * 3) QR tổng booking → check-in-all / check-out-all (?tripCode= khứ hồi)
 * 4) QR tổng charter → /charter-bookings/.../attendance
 */
export function StaffTicketScanPage() {
  const { lang } = useApp();
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [selectedTripCode, setSelectedTripCode] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [lastError, setLastError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const lookupSeqRef = useRef(0);

  const isManifest = result?.kind === "manifest";
  const ticket = result?.kind === "ticket" ? result : null;
  const manifest = isManifest ? result : null;
  const isCharterManifest = Boolean(manifest?.isCharter);

  /** Refresh nền — không chặn toast / nút. */
  const refreshAfterAction = (token = "") => {
    const trimmed = String(token || "").trim();
    if (!trimmed) return;
    Promise.resolve()
      .then(() => {
        if (isCharterManifest || String(trimmed).toUpperCase().startsWith("CB") || isManifest) {
          return refreshManifest(trimmed);
        }
        return lookupTicketOrManifest(trimmed).then((data) => setResult(data));
      })
      .catch(() => {
        /* giữ optimistic UI nếu refresh fail */
      });
  };

  const tripOptions = useMemo(() => {
    if (!manifest) return [];
    return (manifest.tripCodes || []).map((tripCode) => ({
      value: tripCode,
      label: tripCode,
    }));
  }, [manifest]);

  const applyManifestResult = (data) => {
    setResult(data);
    setSelectedTripCode((prev) => (
      prev && data.tripCodes.includes(prev) ? prev : (data.selectedTripCode || data.tripCodes[0] || "")
    ));
    setSelectedTicketIds((prev) => prev.filter((id) =>
      data.tickets.some((row) => row.ticketId === id),
    ));
    return data;
  };

  const refreshManifest = async (token = manifest?.bookingQrToken || code) => {
    if (isCharterManifest || String(token || "").toUpperCase().startsWith("CB")) {
      const data = await lookupTicketOrManifest(token);
      if (data?.kind === "manifest") return applyManifestResult(data);
      setResult(data);
      return data;
    }
    const data = await fetchBookingManifestByQr(token);
    return applyManifestResult(data);
  };

  const notifyAttendanceResult = (data, fallbackTitle) => {
    const skippedText = formatSkippedTickets(data?.skippedTickets, lang);
    const updated = Number(data?.updatedCount);
    notify({
      icon: "success",
      title: fallbackTitle,
      text: [
        Number.isFinite(updated) && updated > 0
          ? (lang === "VN" ? `Đã cập nhật ${updated} vé` : `Updated ${updated} ticket(s)`)
          : "",
        skippedText,
      ].filter(Boolean).join(". ") || undefined,
      timer: skippedText ? 3200 : 1600,
      showConfirmButton: Boolean(skippedText),
      confirmButtonColor: "#124757",
    });
  };

  const lookupByCode = useCallback(async (rawCode) => {
    const trimmed = String(rawCode || "").trim();
    if (!trimmed) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Nhập mã vé / QR booking" : "Enter ticket or booking QR",
        confirmButtonColor: "#124757",
      });
      return;
    }
    const seq = ++lookupSeqRef.current;
    try {
      setIsScanning(true);
      // Giữ kết quả cũ trên UI khi đang tra — tránh màn hình trống / cảm giác load lâu.
      setSelectedTicketIds([]);
      setLastError("");
      const data = await lookupTicketOrManifest(trimmed);
      if (seq !== lookupSeqRef.current) return;
      setResult(data);
      if (data.kind === "manifest") {
        setSelectedTripCode(data.selectedTripCode || data.tripCodes[0] || "");
      }
    } catch (error) {
      if (seq !== lookupSeqRef.current) return;
      setResult(null);
      const message = getApiErrorMessage(
        error,
        lang === "VN" ? "Mã không hợp lệ hoặc không có quyền soát vé." : "Invalid code or no scan permission.",
      );
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Không tra được vé" : "Lookup failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      if (seq === lookupSeqRef.current) setIsScanning(false);
    }
  }, [lang]);

  const handleLookup = async (event) => {
    event?.preventDefault?.();
    await lookupByCode(code);
  };

  const handleCameraScan = useCallback(async (decodedText) => {
    const trimmed = String(decodedText || "").trim();
    if (!trimmed) return;
    setCameraOpen(false);
    setCode(trimmed);
    await lookupByCode(trimmed);
  }, [lookupByCode]);

  const handleCheckInOne = async (row, options = {}) => {
    try {
      setIsActing(true);
      setLastError("");

      const eligibilityCodes = options.eligibilityCodes
        || concessionCodesOf(row)
        || eligibilityCodesOf(row);
      const needsVerify = concessionCodesOf(row).length > 0;
      if (needsVerify && !options.eligibilityConfirmed) {
        notify({
          icon: "warning",
          title: lang === "VN" ? "Cần xác nhận đối tượng" : "Confirm eligibility first",
          text: lang === "VN"
            ? "Vé SENIOR/DISABLED — đối chiếu giấy tờ rồi bấm «Xác nhận đúng đối tượng»."
            : "SENIOR/DISABLED ticket — verify ID, then tap “Confirm eligible”.",
          confirmButtonColor: "#124757",
        });
        return;
      }

      if (isCharterManifest) {
        const token = String(manifest?.bookingQrToken || code || "").trim();
        const ticketId = String(row?.ticketId || "").trim();
        if (!token || !ticketId) throw new Error("EMPTY_CODE");
        const data = await updateCharterManifestAttendance(token, {
          action: "CheckIn",
          mode: "Selected",
          ticketIds: [ticketId],
        });
        applyManifestResult(data);
        notifyAttendanceResult(data, lang === "VN" ? "Check-in thành công" : "Checked in");
        return;
      }

      // Vé riêng / từng vé trong booking thường: chỉ TK — không gửi QR tổng BK.
      const scannedFallback = (!isManifest && !isGroupQrToken(code)) ? code : "";
      const trimmed = resolveIndividualTicketToken(row, scannedFallback);
      if (!trimmed) {
        notify({
          icon: "warning",
          title: lang === "VN" ? "Thiếu mã vé riêng" : "Missing ticket code",
          text: lang === "VN"
            ? "Check-in từng vé cần mã TK. QR tổng BK chỉ dùng nút Check-in tất cả."
            : "Per-ticket check-in needs a TK code. Use Check-in all for BK group QR.",
          confirmButtonColor: "#124757",
        });
        return;
      }
      const note = needsVerify ? buildEligibilityConfirmNote(eligibilityCodes) : undefined;
      await checkInTicket(trimmed, { note });
      setResult((prev) => applyLocalAttendance(prev, {
        token: trimmed,
        ticketId: row?.ticketId,
        action: "checkin",
      }));
      notify({
        icon: "success",
        title: lang === "VN" ? "Check-in thành công" : "Checked in",
        timer: 1400,
        showConfirmButton: false,
      });
      refreshAfterAction(isManifest ? (manifest?.bookingQrToken || code) : trimmed);
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Check-in thất bại" : "Check-in failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleRejectEligibility = async (row, codes = []) => {
    const labels = (codes.length ? codes : concessionCodesOf(row))
      .map((code) => ticketTypeLabel(code, lang))
      .join(", ");

    const prompt = await notify({
      dialog: true,
      icon: "warning",
      title: lang === "VN" ? "Sai đối tượng ưu đãi" : "Wrong concession",
      text: lang === "VN"
        ? `Nhập lý do từ chối${labels ? ` (${labels})` : ""}. Hệ thống sẽ hủy vé Waterbus hoặc chuyển về ADULT (Sightseeing) tùy loại booking.`
        : `Enter rejection reason${labels ? ` (${labels})` : ""}. Waterbus tickets are cancelled; Sightseeing may adjust to ADULT with extra payment.`,
      input: "textarea",
      inputPlaceholder: lang === "VN"
        ? "VD: Khách không chứng minh đúng đối tượng"
        : "e.g. Passenger could not prove eligibility",
      inputValue: lang === "VN"
        ? "Khách không chứng minh đúng đối tượng"
        : "Passenger could not prove eligibility",
      inputValidator: (value) => {
        if (!String(value || "").trim()) {
          return lang === "VN" ? "Bắt buộc nhập lý do" : "Reason is required";
        }
        return undefined;
      },
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Gửi từ chối" : "Submit reject",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
      confirmButtonColor: "#124757",
    });

    if (!prompt?.isConfirmed) return;

    const reason = String(prompt.value || "").trim();
    const note = labels
      ? (lang === "VN" ? `Từ chối ưu đãi: ${labels}` : `Concession rejected: ${labels}`)
      : undefined;

    try {
      setIsActing(true);
      setLastError("");

      const scannedFallback = (!isManifest && !isGroupQrToken(code)) ? code : "";
      const trimmed = resolveIndividualTicketToken(row, scannedFallback);
      if (!trimmed) {
        notify({
          icon: "warning",
          title: lang === "VN" ? "Thiếu mã vé riêng" : "Missing ticket code",
          text: lang === "VN"
            ? "Reject ưu đãi cần mã TK / qrToken của vé."
            : "Concession reject needs the ticket TK / qrToken.",
          confirmButtonColor: "#124757",
        });
        return;
      }

      const resultReject = await rejectTicketConcession(trimmed, {
        reason,
        note,
        source: "Qr",
      });

      const actionKey = String(resultReject.action || "").toLowerCase();

      if (actionKey === "cancelled") {
        if (isManifest) await refreshManifest();
        else {
          try {
            const data = await lookupTicketOrManifest(trimmed);
            setResult(data);
          } catch {
            setResult((prev) => (prev?.kind === "ticket"
              ? { ...prev, canCheckIn: false, status: resultReject.ticketStatus || "Cancelled" }
              : prev));
          }
        }
        notify({
          icon: "info",
          title: lang === "VN" ? "Vé đã bị hủy" : "Ticket cancelled",
          text: lang === "VN"
            ? "Waterbus thường: vé ưu đãi đã hủy, không cho check-in nữa."
            : "Regular Waterbus: concession ticket cancelled — check-in is no longer allowed.",
          confirmButtonColor: "#124757",
        });
        return;
      }

      if (actionKey === "adjustedtoadult" || resultReject.requiresAdditionalPayment) {
        const formatMoneyVn = (value) => {
          const n = Number(value);
          if (!Number.isFinite(n)) return "—";
          return `${n.toLocaleString("vi-VN")}đ`;
        };
        const bookingId = resultReject.bookingId
          || row?.bookingId
          || ticket?.bookingId
          || "";

        const payAsk = await notify({
          dialog: true,
          icon: "warning",
          title: lang === "VN" ? "Đã chuyển về vé ADULT" : "Adjusted to ADULT",
          html: lang === "VN"
            ? `<div class="text-left text-sm space-y-1">
                <p>Sightseeing: cần thu phần còn lại trước khi check-in.</p>
                <p><b>Phụ thu:</b> ${formatMoneyVn(resultReject.additionalAmount)}</p>
                <p><b>Còn lại booking:</b> ${formatMoneyVn(resultReject.bookingRemainingAmount)}</p>
                <p><b>Tổng booking:</b> ${formatMoneyVn(resultReject.bookingTotalAmount)}</p>
              </div>`
            : `<div class="text-left text-sm space-y-1">
                <p>Sightseeing: collect remaining fare before check-in.</p>
                <p><b>Surcharge:</b> ${formatMoneyVn(resultReject.additionalAmount)}</p>
                <p><b>Booking remaining:</b> ${formatMoneyVn(resultReject.bookingRemainingAmount)}</p>
                <p><b>Booking total:</b> ${formatMoneyVn(resultReject.bookingTotalAmount)}</p>
              </div>`,
          showCancelButton: Boolean(bookingId),
          confirmButtonText: bookingId
            ? (lang === "VN" ? "Tạo link thanh toán (Full)" : "Create Full payment link")
            : (lang === "VN" ? "Đã hiểu" : "OK"),
          cancelButtonText: lang === "VN" ? "Để sau" : "Later",
          confirmButtonColor: "#124757",
        });

        if (isManifest) await refreshManifest();
        else {
          try {
            const data = await lookupTicketOrManifest(trimmed);
            setResult(data);
          } catch {
            setResult((prev) => (prev?.kind === "ticket"
              ? {
                ...prev,
                canCheckIn: false,
                ticketTypeCode: "ADULT",
                passengerType: "ADULT",
                status: resultReject.ticketStatus || prev.status,
              }
              : prev));
          }
        }

        if (payAsk?.isConfirmed && bookingId) {
          try {
            const payment = await createBookingPayment({
              bookingId,
              paymentOption: "Full",
            });
            const checkoutUrl = String(pickDeep(payment, [
              "checkoutUrl", "paymentUrl", "paymentLink", "payUrl", "url",
              "data.checkoutUrl", "data.paymentUrl", "data.paymentLink", "data.payUrl", "data.url",
              "payment.checkoutUrl", "payment.paymentUrl",
              "data.payment.checkoutUrl", "data.payment.paymentUrl",
            ], "") || "").trim();
            if (checkoutUrl) {
              window.open(checkoutUrl, "_blank", "noopener,noreferrer");
              notify({
                icon: "success",
                title: lang === "VN" ? "Đã mở link thanh toán" : "Payment link opened",
                text: lang === "VN"
                  ? "Sau khi khách thanh toán xong, quét lại vé (đã là ADULT) rồi check-in bình thường."
                  : "After the customer pays, scan again (now ADULT) and check in as usual.",
                confirmButtonColor: "#124757",
              });
            } else {
              notify({
                icon: "warning",
                title: lang === "VN" ? "Chưa có checkoutUrl" : "No checkoutUrl",
                text: lang === "VN"
                  ? "Payment đã tạo nhưng BE không trả link. Kiểm tra booking trên hệ thống."
                  : "Payment was created but no checkout URL was returned.",
                confirmButtonColor: "#124757",
              });
            }
          } catch (payError) {
            notify({
              icon: "error",
              title: lang === "VN" ? "Không tạo được thanh toán" : "Unable to create payment",
              text: getApiErrorMessage(payError),
              confirmButtonColor: "#124757",
            });
          }
        }
        return;
      }

      if (isManifest) await refreshManifest();
      else {
        try {
          const data = await lookupTicketOrManifest(trimmed);
          setResult(data);
        } catch {
          /* ignore refresh errors */
        }
      }
      notify({
        icon: "success",
        title: lang === "VN" ? "Đã ghi nhận từ chối ưu đãi" : "Concession rejected",
        text: resultReject.message
          || (resultReject.action
            ? `action: ${resultReject.action}`
            : undefined),
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Từ chối ưu đãi thất bại" : "Concession reject failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCheckOutOne = async (row) => {
    try {
      setIsActing(true);
      setLastError("");

      if (isCharterManifest) {
        const token = String(manifest?.bookingQrToken || code || "").trim();
        const ticketId = String(row?.ticketId || "").trim();
        if (!token || !ticketId) throw new Error("EMPTY_CODE");
        const data = await updateCharterManifestAttendance(token, {
          action: "CheckOut",
          mode: "Selected",
          ticketIds: [ticketId],
        });
        applyManifestResult(data);
        notifyAttendanceResult(data, lang === "VN" ? "Check-out thành công" : "Checked out");
        return;
      }

      // Booking thường: checkout từng vé bằng TK; QR tổng dùng nút Check-out tất cả.
      const scannedFallback = (!isManifest && !isGroupQrToken(code)) ? code : "";
      const trimmed = resolveIndividualTicketToken(row, scannedFallback);
      if (!trimmed) {
        notify({
          icon: "warning",
          title: lang === "VN" ? "Thiếu mã vé riêng" : "Missing ticket code",
          text: lang === "VN"
            ? "Check-out từng vé cần mã TK. QR tổng BK dùng nút Check-out tất cả."
            : "Per-ticket check-out needs a TK code. Use Check-out all for BK group QR.",
          confirmButtonColor: "#124757",
        });
        return;
      }
      await checkOutTicket(trimmed);
      setResult((prev) => applyLocalAttendance(prev, {
        token: trimmed,
        ticketId: row?.ticketId,
        action: "checkout",
      }));
      notify({
        icon: "success",
        title: lang === "VN" ? "Check-out thành công" : "Checked out",
        timer: 1400,
        showConfirmButton: false,
      });
      refreshAfterAction(isManifest ? (manifest?.bookingQrToken || code) : trimmed);
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Check-out thất bại" : "Check-out failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCharterAttendanceAll = async (action) => {
    const token = String(manifest?.bookingQrToken || code || "").trim();
    if (!token) return;
    try {
      setIsActing(true);
      setLastError("");
      const data = await updateCharterManifestAttendance(token, {
        action,
        mode: "All",
      });
      applyManifestResult(data);
      notifyAttendanceResult(
        data,
        action === "CheckOut"
          ? (lang === "VN" ? "Check-out cả nhóm thành công" : "Group check-out done")
          : (lang === "VN" ? "Check-in cả nhóm thành công" : "Group check-in done"),
      );
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: action === "CheckOut"
          ? (lang === "VN" ? "Check-out nhóm thất bại" : "Group check-out failed")
          : (lang === "VN" ? "Check-in nhóm thất bại" : "Group check-in failed"),
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCharterAttendanceSelected = async (action) => {
    const token = String(manifest?.bookingQrToken || code || "").trim();
    if (!token || selectedTicketIds.length === 0) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Chọn ít nhất 1 vé" : "Select at least one ticket",
        confirmButtonColor: "#124757",
      });
      return;
    }
    try {
      setIsActing(true);
      setLastError("");
      const data = await updateCharterManifestAttendance(token, {
        action,
        mode: "Selected",
        ticketIds: selectedTicketIds,
      });
      applyManifestResult(data);
      setSelectedTicketIds([]);
      notifyAttendanceResult(
        data,
        action === "CheckOut"
          ? (lang === "VN" ? "Check-out đã chọn" : "Selected check-out done")
          : (lang === "VN" ? "Check-in đã chọn" : "Selected check-in done"),
      );
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Thao tác thất bại" : "Action failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCheckInAll = async () => {
    if (isCharterManifest) {
      await handleCharterAttendanceAll("CheckIn");
      return;
    }

    const token = String(manifest?.bookingQrToken || code || "").trim();
    if (!token) return;
    if (manifest?.isRoundTrip && !selectedTripCode) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Chọn mã chuyến" : "Select trip code",
        text: lang === "VN"
          ? "Booking khứ hồi cần tripCode chiều đang boarding để tránh check-in nhầm cả hai chiều."
          : "Round-trip bookings require the boarding leg tripCode to avoid checking in both legs.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    try {
      setIsActing(true);
      setLastError("");
      await checkInAllBookingManifest(token, selectedTripCode);
      await refreshManifest(token);
      notify({
        icon: "success",
        title: lang === "VN" ? "Check-in cả nhóm thành công" : "Group check-in done",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Check-in nhóm thất bại" : "Group check-in failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCheckOutAll = async () => {
    if (isCharterManifest) {
      await handleCharterAttendanceAll("CheckOut");
      return;
    }

    const token = String(manifest?.bookingQrToken || code || "").trim();
    if (!token) return;
    if (manifest?.isRoundTrip && !selectedTripCode) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Chọn mã chuyến" : "Select trip code",
        text: lang === "VN"
          ? "Booking khứ hồi cần tripCode chiều đang trả khách để tránh check-out nhầm cả hai chiều."
          : "Round-trip bookings require the alighting leg tripCode to avoid checking out both legs.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    try {
      setIsActing(true);
      setLastError("");
      const data = await checkOutAllBookingManifest(token, selectedTripCode);
      await refreshManifest(token);
      notifyAttendanceResult(
        data,
        lang === "VN" ? "Check-out cả nhóm thành công" : "Group check-out done",
      );
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Check-out nhóm thất bại" : "Group check-out failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const toggleTicketSelection = (ticketId) => {
    const id = String(ticketId || "").trim();
    if (!id) return;
    setSelectedTicketIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10 font-body">
      <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Vận hành" : "Operations"}
        </p>
        <h2 className="mt-1 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Quét vé (OnBoard)" : "Ticket scan (OnBoard)"}
        </h2>
        <Link
          to="/admin/staff/scan-history"
          className="mt-3 inline-flex text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] underline dark:text-yellow-400"
        >
          {lang === "VN" ? "Lịch sử quét" : "Scan history"}
        </Link>

        <form onSubmit={handleLookup} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
              {lang === "VN" ? "Mã vé / QR booking" : "Ticket code / booking QR"}
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={lang === "VN" ? "Nhập, dán hoặc quét camera…" : "Type, paste, or scan…"}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={() => setCameraOpen((prev) => !prev)}
            disabled={isScanning}
            className={`inline-flex h-11.5 items-center justify-center gap-1.5 rounded-2xl px-4 text-xs font-headline font-black uppercase tracking-wider disabled:opacity-50 ${
              cameraOpen
                ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                : "border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              {cameraOpen ? "close" : "photo_camera"}
            </span>
            {cameraOpen
              ? (lang === "VN" ? "Đóng cam" : "Close cam")
              : (lang === "VN" ? "Quét cam" : "Camera")}
          </button>
          <button
            type="submit"
            disabled={isScanning}
            className="h-11.5 rounded-2xl bg-[#124757] px-6 text-xs font-headline font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
          >
            {isScanning
              ? (lang === "VN" ? "Đang tra…" : "Looking up…")
              : (lang === "VN" ? "Tra cứu" : "Lookup")}
          </button>
        </form>

        {isScanning ? (
          <p className="mt-3 text-[11px] font-bold text-slate-400">
            {lang === "VN" ? "Đang tra cứu vé từ máy chủ…" : "Looking up ticket from server…"}
          </p>
        ) : null}

        {cameraOpen ? (
          <TicketQrCameraScanner
            lang={lang}
            active={cameraOpen}
            onScan={handleCameraScan}
            onClose={() => setCameraOpen(false)}
            className="mt-4"
          />
        ) : null}

        {lastError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {lastError}
          </div>
        ) : null}
      </div>

      {ticket ? (
        <TicketResultCard
          ticket={ticket}
          lang={lang}
          isActing={isActing}
          onCheckIn={handleCheckInOne}
          onCheckOut={handleCheckOutOne}
          onRejectEligibility={handleRejectEligibility}
        />
      ) : null}

      {manifest ? (
        <div className="space-y-4 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                {isCharterManifest
                  ? (lang === "VN" ? "QR tổng Request" : "Request group QR")
                  : (lang === "VN" ? "QR tổng booking" : "Booking group QR")}
              </p>
              <p className="mt-1 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                {manifest.bookingCode}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {manifest.tickets.length} {lang === "VN" ? "vé" : "ticket(s)"}
                {selectedTicketIds.length > 0
                  ? ` · ${lang === "VN" ? "đã chọn" : "selected"} ${selectedTicketIds.length}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {!isCharterManifest && manifest.isRoundTrip && tripOptions.length > 1 ? (
                <label className="block space-y-1">
                  <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                    {lang === "VN" ? "Chiều chuyến (khứ hồi)" : "Trip leg (round-trip)"}
                  </span>
                  <select
                    value={selectedTripCode}
                    onChange={(e) => setSelectedTripCode(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#124757] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  >
                    {tripOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                disabled={isActing || !manifest.tickets.some((row) => row.canCheckIn)}
                onClick={handleCheckInAll}
                className="rounded-xl bg-yellow-400 px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-slate-900 disabled:opacity-50"
              >
                {lang === "VN" ? "Check-in tất cả" : "Check-in all"}
              </button>
              <button
                type="button"
                disabled={isActing || !manifest.tickets.some((row) => row.canCheckOut)}
                onClick={handleCheckOutAll}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
              >
                {lang === "VN" ? "Check-out tất cả" : "Check-out all"}
              </button>
              {isCharterManifest ? (
                <>
                  <button
                    type="button"
                    disabled={isActing || selectedTicketIds.length === 0}
                    onClick={() => handleCharterAttendanceSelected("CheckIn")}
                    className="rounded-xl bg-[#124757] px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
                  >
                    {lang === "VN" ? "Check-in đã chọn" : "Check-in selected"}
                  </button>
                  <button
                    type="button"
                    disabled={isActing || selectedTicketIds.length === 0}
                    onClick={() => handleCharterAttendanceSelected("CheckOut")}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                  >
                    {lang === "VN" ? "Check-out đã chọn" : "Check-out selected"}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            {manifest.tickets.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">
                {lang === "VN" ? "Manifest chưa có vé." : "No tickets in manifest."}
              </p>
            ) : (
              manifest.tickets.map((row) => {
                const rowKey = row.ticketId || `${row.ticketCode || row.codeOrToken}-${row.tripCode}`;
                const checked = row.ticketId && selectedTicketIds.includes(row.ticketId);
                return (
                  <div key={rowKey} className="relative">
                    {isCharterManifest && row.ticketId ? (
                      <label className="absolute left-3 top-3 z-10 inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={Boolean(checked)}
                          onChange={() => toggleTicketSelection(row.ticketId)}
                          className="h-4 w-4 rounded border-slate-300 text-[#124757] focus:ring-[#124757]"
                        />
                      </label>
                    ) : null}
                    <div className={isCharterManifest && row.ticketId ? "pl-6" : ""}>
                      <TicketResultCard
                        ticket={row}
                        lang={lang}
                        isActing={isActing}
                        onCheckIn={handleCheckInOne}
                        onCheckOut={handleCheckOutOne}
                        onRejectEligibility={handleRejectEligibility}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
