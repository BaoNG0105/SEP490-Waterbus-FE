import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import {
  downloadAllCharterBookingTickets,
  downloadCharterBookingTicketsPdf,
  downloadCharterBookingTicketsPdfByQrToken,
  downloadSelectedCharterBookingTickets,
  fetchCharterBookingQrImage,
  printSelectedCharterBookingTickets,
} from "../services/charterBookingService";
import {
  canShowCharterTickets,
  formatCharterPassengerType,
  getPassengerBirthYear,
  getCharterTicketId,
  hasCharterPassengerManifest,
  isCharterFullyPaid,
} from "../utils/charterBookingTickets";
import { getApiErrorMessage } from "../utils/apiError";
import {
  DEFAULT_BOAT_IMAGE,
  formatMatchedRouteLabel,
  formatRouteEstimate,
  getBoatCode,
  getBoatImageUrl,
  getBoatNameOnly,
  getBoatStatusLabel,
  getCharterRoutePricingWarning,
  getMatchedRouteSummary,
  getRouteEstimateCompleteness,
  hasCharterRouteForPricing,
  hasMatchedRouteOnLeg,
  isCharterRoutePricingBlocked,
  normalizeRouteEstimateLegs,
} from "../utils/charterBookingAdmin";
import { CharterRouteMapPanel } from "./CharterRouteMapPanel";
import { CharterPaymentLedger } from "./CharterPaymentLedger";
import { CharterInsuranceInfo } from "./CharterInsuranceInfo";
import { CharterQuotePreviewPanel } from "./CharterQuotePreviewTable";
import {
  formatQuoteUnitPriceLabel,
} from "../utils/charterQuotePreview";

function AdminCharterRouteInfoPanel({ lang, booking, formatDate, compact = false }) {
  const fromName = booking?.fromStationName || "--";
  const toName = booking?.toStationName || "--";
  const stops = Array.isArray(booking?.itineraryStops) ? booking.itineraryStops : [];
  const completeness = getRouteEstimateCompleteness(booking?.routeEstimate);
  const hasValidEstimate = completeness.isComplete;
  const estimateText = hasValidEstimate
    ? (formatRouteEstimate(booking?.routeEstimate, lang) || (lang === "VN" ? "Chưa có ước tính" : "No estimate yet"))
    : (lang === "VN" ? "Chưa có ước tính" : "No estimate yet");
  const routeWarning = getCharterRoutePricingWarning(booking, lang);
  const pricingBlocked = isCharterRoutePricingBlocked(booking);
  const routeLegs = Array.isArray(booking?.routeLegs) && booking.routeLegs.length > 0
    ? booking.routeLegs
    : normalizeRouteEstimateLegs(booking?.routeEstimate);
  const matchedSummary = getMatchedRouteSummary(booking?.routeEstimate, routeLegs);
  const summaryLabel = formatMatchedRouteLabel({
    matchedRouteId: booking?.matchedRouteId || matchedSummary.matchedRouteId,
    matchedRouteCode: booking?.matchedRouteCode || matchedSummary.matchedRouteCode,
    matchedRouteName: booking?.matchedRouteName || matchedSummary.matchedRouteName,
  });
  const showSummary = Boolean(summaryLabel);
  const panelTone = pricingBlocked || routeWarning
    ? "border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/10"
    : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900";
  const warningTone = "border-amber-300 bg-amber-100/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200";

  return (
    <div className={`rounded-3xl border ${panelTone} ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
            {lang === "VN" ? "Thông tin lộ trình" : "Route information"}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
            {fromName} → {toName}
          </p>
          {showSummary ? (
            <p className="mt-1 text-xs font-bold text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Tuyến hệ thống" : "System route"}
              {": "}
              {summaryLabel}
            </p>
          ) : null}
          {!showSummary && routeLegs.length === 0 ? (
            <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
              {lang === "VN"
                ? "Chưa match Route Master (matchedRoute* = null)."
                : "No Route Master match (matchedRoute* = null)."}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] font-medium text-slate-400">
            {lang === "VN"
              ? "Chỉ xem — không chỉnh lộ trình khi chốt giá. Thiếu route/GeoJSON thì cập nhật Route Master hoặc nhờ khách đổi bến."
              : "View only — do not edit the route while quoting. If route/GeoJSON is missing, update Route Master or ask the customer to change stations."}
          </p>
        </div>
        <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
          {formatDate(booking?.departureDate)} · {String(booking?.startTime || "--").slice(0, 5)}
        </span>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Bến đón" : "From"}</p>
          <p className="mt-0.5 text-sm font-bold text-slate-700 dark:text-slate-200">{fromName}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Bến trả" : "To"}</p>
          <p className="mt-0.5 text-sm font-bold text-slate-700 dark:text-slate-200">{toName}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Giờ khởi hành" : "Start time"}</p>
          <p className="mt-0.5 text-sm font-bold text-slate-700 dark:text-slate-200">{String(booking?.startTime || "--").slice(0, 5)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Ngày đi" : "Departure date"}</p>
          <p className="mt-0.5 text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(booking?.departureDate)}</p>
        </div>
      </div>

      {stops.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Điểm dừng" : "Itinerary stops"}
          </p>
          {stops.map((stop, index) => (
            <div
              key={`${stop.stationId || "stop"}-${stop.stopOrder || index}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {lang === "VN" ? `Dừng ${stop.stopOrder || index + 1}` : `Stop ${stop.stopOrder || index + 1}`}
                {": "}
                {stop.stationName || "--"}
              </p>
              <p className="text-[11px] font-medium text-slate-400">
                {Number(stop.stayDurationMinutes) > 0
                  ? `${stop.stayDurationMinutes} ${lang === "VN" ? "phút" : "min"}`
                  : (lang === "VN" ? "Không dừng lâu" : "No stay")}
                {stop.note ? ` · ${stop.note}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs font-medium text-slate-400">
          {lang === "VN" ? "Không có điểm dừng trung gian." : "No intermediate stops."}
        </p>
      )}

      {routeLegs.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Chặng tính giá (Route Master)" : "Pricing legs (Route Master)"}
          </p>
          {routeLegs.map((leg) => {
            const matched = hasMatchedRouteOnLeg(leg);
            const label = formatMatchedRouteLabel(leg);
            return (
              <div
                key={`leg-${leg.legOrder}`}
                className={`rounded-xl border px-3 py-2.5 ${matched ? "border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800" : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {lang === "VN" ? `Chặng ${leg.legOrder}` : `Leg ${leg.legOrder}`}
                    {": "}
                    {leg.fromStationName || "--"} → {leg.toStationName || "--"}
                  </p>
                  <p className="text-[11px] font-medium text-slate-400">
                    {matched && leg.distanceKm != null && leg.travelMinutes != null
                      ? `${leg.distanceKm} km · ${leg.travelMinutes} ${lang === "VN" ? "phút" : "min"}`
                      : (lang === "VN" ? "Chưa có ước tính" : "No estimate")}
                  </p>
                </div>
                <p className={`mt-1 text-xs font-bold ${matched ? "text-[#124757] dark:text-yellow-400" : "text-amber-700 dark:text-amber-300"}`}>
                  {matched
                    ? `${lang === "VN" ? "Tuyến hệ thống" : "System route"}: ${label}`
                    : (lang === "VN"
                      ? "Chưa match Route Master — chưa có ước tính hợp lệ"
                      : "No Route Master match — no valid estimate")}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {lang === "VN" ? "Ước tính lộ trình" : "Route estimate"}
        </p>
        <p className="mt-1 text-sm font-bold leading-snug text-slate-700 dark:text-slate-200">{estimateText}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${hasValidEstimate ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"}`}>
            {lang === "VN" ? "Quãng đường" : "Distance"}: {hasValidEstimate ? (lang === "VN" ? "Đủ" : "OK") : (lang === "VN" ? "Chưa có" : "None")}
          </span>
          <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${hasValidEstimate ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"}`}>
            {lang === "VN" ? "Thời gian" : "Travel time"}: {hasValidEstimate ? (lang === "VN" ? "Đủ" : "OK") : (lang === "VN" ? "Chưa có" : "None")}
          </span>
        </div>
      </div>

      {routeWarning ? (
        <div className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 ${warningTone}`}>
          <span className="material-symbols-outlined mt-0.5 text-base">warning</span>
          <p className="text-xs font-bold leading-relaxed">{routeWarning}</p>
        </div>
      ) : null}

      <div className="mt-4">
        <CharterRouteMapPanel lang={lang} booking={booking} />
      </div>
    </div>
  );
}

function AdminBoatQuoteSelect({
  lang,
  boatId,
  availableBoats,
  rentalUnit,
  currencyFormatter,
  onChange,
  getBoatId,
  getBoatDeckCount,
  getBoatSeatCount,
  getBoatPrice,
  formatDeckCount,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedBoat = availableBoats.find((boat) => getBoatId(boat) === boatId) || null;
  const activeUnit = rentalUnit === "Hour" ? "Hour" : "Day";

  const formatBoatMeta = (boat) => {
    const deckText = formatDeckCount(getBoatDeckCount(boat), lang);
    const seats = getBoatSeatCount(boat);
    const seatText = seats > 0 ? `${seats} ${lang === "VN" ? "ghế" : "seats"}` : "";
    return [deckText, seatText].filter(Boolean).join(" · ");
  };

  const formatBoatPrices = (boat) => {
    const dayPrice = getBoatPrice(boat, "Day");
    const hourPrice = getBoatPrice(boat, "Hour");
    const dayLabel = dayPrice > 0
      ? formatQuoteUnitPriceLabel(dayPrice, "Day", currencyFormatter, lang)
      : (lang === "VN" ? "Chưa có giá/ngày" : "No daily rate");
    const hourLabel = hourPrice > 0
      ? formatQuoteUnitPriceLabel(hourPrice, "Hour", currencyFormatter, lang)
      : (lang === "VN" ? "Chưa có giá/giờ" : "No hourly rate");

    return { dayLabel, hourLabel, dayPrice, hourPrice };
  };

  const renderBoatLabel = (boat, compact = false) => {
    const code = getBoatCode(boat);
    const name = getBoatNameOnly(boat);
    const { dayLabel, hourLabel } = formatBoatPrices(boat);
    return (
      <div className="min-w-0 flex-1">
        <p className={`truncate font-bold text-slate-800 dark:text-white ${compact ? "text-sm" : "text-sm"}`}>
          {code ? <span className="text-[#124757] dark:text-yellow-400">{code}</span> : null}
          {code && name ? <span className="text-slate-400"> · </span> : null}
          {name || code || "--"}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
          {formatBoatMeta(boat)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-headline font-black">
          <span className={activeUnit === "Day" ? "text-[#124757] dark:text-yellow-400" : "text-slate-400"}>
            {dayLabel}
          </span>
          <span className="font-medium text-slate-300 dark:text-slate-600">·</span>
          <span className={activeUnit === "Hour" ? "text-[#124757] dark:text-yellow-400" : "text-slate-400"}>
            {hourLabel}
          </span>
        </p>
      </div>
    );
  };

  return (
    <div
      className="relative mt-3"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
    >
      <input
        type="text"
        value={boatId || ""}
        readOnly
        required
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full items-center gap-3 rounded-2xl border bg-white px-3 py-2.5 text-left outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 ${
          isOpen
            ? "border-[#124757] ring-2 ring-[#124757]/15 dark:border-yellow-400 dark:ring-yellow-400/20"
            : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedBoat ? (
          <>
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900">
              <img
                src={getBoatImageUrl(selectedBoat)}
                alt={getBoatNameOnly(selectedBoat)}
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = DEFAULT_BOAT_IMAGE;
                }}
              />
            </div>
            {renderBoatLabel(selectedBoat, true)}
          </>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900">
              <span className="material-symbols-outlined text-2xl text-slate-300 dark:text-slate-600">directions_boat</span>
            </span>
            <p className="text-sm font-bold text-slate-400">{lang === "VN" ? "Chọn tàu" : "Select boat"}</p>
          </div>
        )}
        <span className={`material-symbols-outlined shrink-0 text-xl text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {isOpen && !disabled ? (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
          role="listbox"
        >
          {availableBoats.length > 0 ? availableBoats.map((boat) => {
            const id = getBoatId(boat);
            const isSelected = id === boatId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onChange(id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${
                  isSelected
                    ? "bg-[#124757]/5 ring-1 ring-[#124757]/15 dark:bg-yellow-400/10 dark:ring-yellow-400/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  <img
                    src={getBoatImageUrl(boat)}
                    alt={getBoatNameOnly(boat)}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = DEFAULT_BOAT_IMAGE;
                    }}
                  />
                </div>
                {renderBoatLabel(boat)}
                {isSelected ? (
                  <span className="material-symbols-outlined shrink-0 text-lg text-[#124757] dark:text-yellow-400">check_circle</span>
                ) : null}
              </button>
            );
          }) : (
            <p className="px-3 py-4 text-center text-xs font-bold text-slate-400">
              {lang === "VN" ? "Không có tàu phù hợp." : "No matching boats."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

function ManualStatusPanel({ lang, isSubmitting, manualStatusOptions, getStatusInfo, onStatusChange }) {
  return (
    <details className="group rounded-4xl border border-slate-100 bg-white shadow-sm open:shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
      <summary className="cursor-pointer list-none px-6 py-5 marker:content-none">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Cập nhật trạng thái thủ công" : "Manual Status Update"}
          </h3>
          <span className="material-symbols-outlined text-slate-400 transition group-open:rotate-180">expand_more</span>
        </div>
      </summary>
      <div className="border-t border-slate-100 px-6 pb-6 pt-4 dark:border-slate-700">
        <label className="block">
          <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Trạng thái mới" : "New status"}
          </span>
          <select
            defaultValue=""
            onChange={(event) => onStatusChange(event.target.value)}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="" disabled>{lang === "VN" ? "Chọn trạng thái" : "Select status"}</option>
            {manualStatusOptions.map((status) => (
              <option key={status} value={status}>{getStatusInfo(status).label}</option>
            ))}
          </select>
        </label>
        <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-400">
          {lang === "VN"
            ? "Quản trị chỉ cập nhật thủ công: Đã hủy, Hết hạn, Hoàn tất. Các trạng thái còn lại được xử lý theo quy trình hệ thống."
            : "Admins can manually set only Cancelled, Expired, or Completed. Other states follow the system workflow."}
        </p>
      </div>
    </details>
  );
}

function OverviewField({ icon, label, value, hint }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3F5] text-[#124757] dark:bg-slate-800 dark:text-yellow-400">
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-slate-400">{label}</p>
        <p className="mt-0.5 wrap-break-word text-sm font-bold leading-snug text-slate-800 dark:text-white">{value || "--"}</p>
        {hint ? <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}

function OverviewStat({ label, value, tone = "default" }) {
  const tones = {
    default: "border-slate-200/80 bg-[#F8FBFC] dark:border-slate-700 dark:bg-slate-900",
    accent: "border-[#D8E7EA] bg-[#F7FAFB] dark:border-slate-700 dark:bg-slate-900",
    warn: "border-rose-100 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10",
  };
  const valueTone = tone === "warn"
    ? "text-rose-600 dark:text-rose-300"
    : "text-[#124757] dark:text-yellow-400";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${tones[tone]}`}>
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className={`mt-1 font-headline text-xl font-black leading-none ${valueTone}`}>{value}</p>
    </div>
  );
}

export function AdminBookingOverviewTab({
  lang,
  booking,
  showBookingHoldCountdown,
  bookingHoldRemainingMs,
  quotePaymentDeadline,
  formatDate,
  formatDateTime,
  formatCountdown,
  formatDuration,
  formatPassengerSummary,
  formatDeckCount,
  getRequestedDeckCount,
  getBoatDeckCount,
  getBoatSeatSetupType,
  getBoatSeatCount,
  getPaymentStatusInfo,
  currencyFormatter,
  quoteTotal,
  bookingPaidAmount,
  remainingAmount,
  requestedBoats,
  selectedBoats,
  capabilities,
  onNavigateTab,
}) {
  const boatRows = [];
  const maxBoats = Math.max(requestedBoats.length, selectedBoats.length, 0);
  for (let index = 0; index < maxBoats; index += 1) {
    boatRows.push({
      requested: requestedBoats[index],
      assigned: selectedBoats[index],
      index,
    });
  }

  const paymentMeta = getPaymentStatusInfo(booking.paymentStatus, lang);
  const isReleasedAssignment = ["Cancelled", "Expired", "Refunded"].includes(String(booking.status || ""));

  return (
    <div className="space-y-5">
      {showBookingHoldCountdown ? (
        <section className="overflow-hidden rounded-[2rem] border border-sky-200/80 bg-sky-50 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-sky-500/20 dark:bg-sky-500/10">
          <div className="px-6 py-5 md:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold text-sky-600 dark:text-sky-300">
                  {lang === "VN" ? "Hạn thanh toán 12h sau khi chốt giá" : "12h payment window after quote"}
                </p>
                <p className="mt-1 text-sm font-bold text-sky-700 dark:text-sky-200">{formatDateTime(quotePaymentDeadline)}</p>
              </div>
              <p className="font-headline text-3xl font-black tabular-nums text-sky-700 dark:text-sky-200">
                {bookingHoldRemainingMs > 0 ? formatCountdown(bookingHoldRemainingMs) : (lang === "VN" ? "Hết hạn" : "Expired")}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-4xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
                {lang === "VN" ? "Thông tin booking" : "Booking information"}
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {lang === "VN" ? "Lộ trình, khách hàng và tình trạng thanh toán" : "Route, customer, and payment status"}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${paymentMeta.classes}`}>
              {paymentMeta.label}
            </span>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6 md:px-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <OverviewStat
              label={lang === "VN" ? "Giá chốt" : "Quote total"}
              value={quoteTotal > 0 ? currencyFormatter.format(quoteTotal) : "--"}
              tone="accent"
            />
            <OverviewStat
              label={lang === "VN" ? "Đã thu" : "Collected"}
              value={bookingPaidAmount > 0 ? currencyFormatter.format(bookingPaidAmount) : "--"}
            />
            <OverviewStat
              label={lang === "VN" ? "Còn lại" : "Remaining"}
              value={remainingAmount > 0 ? currencyFormatter.format(remainingAmount) : "--"}
              tone={remainingAmount > 0 ? "warn" : "default"}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">
                {lang === "VN" ? "Chuyến đi" : "Trip"}
              </p>
              <AdminCharterRouteInfoPanel lang={lang} booking={booking} formatDate={formatDate} />
              <OverviewField
                icon="groups"
                label={lang === "VN" ? "Hành khách" : "Passengers"}
                value={formatPassengerSummary(booking, lang)}
              />
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">
                {lang === "VN" ? "Khách hàng" : "Customer"}
              </p>
              <OverviewField
                icon="person"
                label={lang === "VN" ? "Tên khách" : "Customer name"}
                value={booking.customerName}
              />
              <OverviewField
                icon="call"
                label={lang === "VN" ? "Liên hệ" : "Contact"}
                value={booking.phone}
                hint={booking.email}
              />
              <OverviewField
                icon="sticky_note_2"
                label={lang === "VN" ? "Ghi chú đặc biệt" : "Special requests"}
                value={booking.specialRequests || (lang === "VN" ? "Không có" : "None")}
              />
              <CharterInsuranceInfo
                booking={booking}
                lang={lang}
                currencyFormatter={currencyFormatter}
              />
            </div>
          </div>
        </div>
      </section>

      {(booking.assignedManagerId || capabilities?.canAssignManager) ? (
        <section className="overflow-hidden rounded-4xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
                  {lang === "VN" ? "Quản lý phụ trách" : "Assigned manager"}
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {lang === "VN"
                    ? "Nên gán sau khi xác nhận chuyến. Có thể gán sớm từ tab Gán quản lý nếu cần."
                    : "Preferably assign after trip confirmation. You can still assign early from the Assign manager tab."}
                </p>
              </div>
              {capabilities?.canAssignManager && onNavigateTab ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab("assignment")}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
                >
                  {lang === "VN" ? "Gán quản lý" : "Assign manager"}
                </button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 px-6 py-6 sm:grid-cols-2 md:px-8">
            <OverviewField
              icon="supervisor_account"
              label={lang === "VN" ? "Quản lý phụ trách" : "Manager"}
              value={booking.assignedManagerName || (lang === "VN" ? "Chưa gán" : "Not assigned")}
            />
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-4xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
          <h2 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
            {lang === "VN" ? "Tàu yêu cầu & đã gán" : "Requested vs assigned boats"}
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {isReleasedAssignment
              ? (lang === "VN"
                ? "Đơn đã đóng — tàu đã gắn được xem là đã giải phóng khỏi lịch."
                : "Closed booking — previously assigned boats are treated as released.")
              : (lang === "VN" ? "So sánh nhanh từng tàu theo yêu cầu khách" : "Quick comparison per requested boat")}
          </p>
        </div>

        <div className="space-y-4 px-6 py-6 md:px-8">
          {boatRows.length > 0 ? boatRows.map(({ requested, assigned, index }) => {
            const requestedText = requested
              ? formatDeckCount(getRequestedDeckCount(requested), lang) || pick(requested, ["requiredSeatSetupType", "seatSetupType"], "--")
              : "--";
            const assignedCode = assigned ? getBoatCode(assigned) : "";
            const assignedName = assigned ? getBoatNameOnly(assigned, lang === "VN" ? `Tàu ${index + 1}` : `Boat ${index + 1}`) : "";
            const assignedDeckText = assigned
              ? formatDeckCount(getBoatDeckCount(assigned), lang) || getBoatSeatSetupType(assigned) || "--"
              : "";
            const assignedSeatCount = assigned ? getBoatSeatCount(assigned) : 0;
            const assignedStatus = assigned ? getBoatStatusLabel(assigned) : "";
            const assignedImageUrl = assigned ? getBoatImageUrl(assigned) : DEFAULT_BOAT_IMAGE;

            return (
              <div
                key={`boat-row-${index}`}
                className={`overflow-hidden rounded-3xl border border-slate-200/80 bg-[#F8FBFC] dark:border-slate-700 dark:bg-slate-900 ${isReleasedAssignment && assigned ? "opacity-80" : ""}`}
              >
                <div className="flex items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80 md:px-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#124757] font-headline text-sm font-black text-white dark:bg-yellow-400 dark:text-slate-900">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                      {lang === "VN" ? "Yêu cầu khách" : "Customer request"}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-700 dark:text-slate-200">{requestedText}</p>
                  </div>
                </div>

                {assigned ? (
                  <div className="grid gap-4 p-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-stretch md:p-5">
                    <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 shadow-inner dark:bg-slate-800 md:h-full md:min-h-[168px] md:aspect-auto ${isReleasedAssignment ? "grayscale" : ""}`}>
                      <img
                        src={assignedImageUrl}
                        alt={assignedName}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = DEFAULT_BOAT_IMAGE;
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-[#124757]/50 via-transparent to-transparent" />
                      <span className={`absolute bottom-3 left-3 rounded-lg px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wider shadow-sm ${
                        isReleasedAssignment
                          ? "bg-slate-800/95 text-white"
                          : "bg-white/95 text-[#124757] dark:bg-slate-900/95 dark:text-yellow-400"
                      }`}
                      >
                        {isReleasedAssignment
                          ? (lang === "VN" ? "Đã giải phóng" : "Released")
                          : (lang === "VN" ? "Đã gán" : "Assigned")}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-col justify-center gap-3">
                      <div>
                        {assignedCode ? (
                          <p className="text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">{assignedCode}</p>
                        ) : null}
                        <h3 className="mt-1 font-headline text-xl font-black leading-tight text-[#124757] dark:text-yellow-400 md:text-2xl">
                          {assignedName}
                        </h3>
                        {isReleasedAssignment ? (
                          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            {lang === "VN"
                              ? "Chỉ còn lịch sử gán — không còn giữ chỗ trên lịch tàu."
                              : "Assignment history only — no longer held on the boat schedule."}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        {assignedDeckText ? (
                          <div className="rounded-2xl border border-[#D8E7EA] bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{lang === "VN" ? "Số tầng" : "Decks"}</p>
                            <p className="mt-1 text-sm font-headline font-black text-[#124757] dark:text-yellow-400">{assignedDeckText}</p>
                          </div>
                        ) : null}
                        {assignedSeatCount > 0 ? (
                          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{lang === "VN" ? "Sức chứa" : "Capacity"}</p>
                            <p className="mt-1 text-sm font-headline font-black text-slate-700 dark:text-slate-200">
                              {assignedSeatCount} {lang === "VN" ? "ghế" : "seats"}
                            </p>
                          </div>
                        ) : null}
                        {assignedStatus ? (
                          <div className={`rounded-2xl border px-3 py-2.5 ${
                            isReleasedAssignment
                              ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                              : "border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                          }`}
                          >
                            <p className={`text-[10px] font-bold uppercase tracking-wide ${
                              isReleasedAssignment
                                ? "text-slate-400"
                                : "text-emerald-600/80 dark:text-emerald-300"
                            }`}
                            >
                              {lang === "VN" ? "Trạng thái tàu" : "Boat status"}
                            </p>
                            <p className={`mt-1 text-sm font-headline font-black ${
                              isReleasedAssignment
                                ? "text-slate-600 dark:text-slate-300"
                                : "text-emerald-700 dark:text-emerald-300"
                            }`}
                            >
                              {assignedStatus}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center md:py-12">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">directions_boat</span>
                    </span>
                    <div>
                      <p className="font-headline text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {lang === "VN" ? "Chưa gán tàu" : "Not assigned yet"}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-400">
                        {isReleasedAssignment
                          ? (lang === "VN" ? "Đơn đã đóng và không còn tàu được giữ." : "This closed booking has no held boats.")
                          : (lang === "VN" ? "Mở tab Thao tác để chọn tàu phù hợp." : "Open the Actions tab to assign a matching boat.")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
              {lang === "VN" ? "Chưa có dữ liệu tàu." : "No boat data."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function AdminBookingActionsTab({
  lang,
  phase,
  booking,
  statusInfo,
  boats,
  quoteForm,
  setQuoteForm,
  canManageQuote,
  hasBlockingPayment,
  isSubmitting,
  isQuoteBoatSelectionComplete,
  isPreviewLoading,
  quotePreviewError,
  quotePreview,
  currencyFormatter,
  formatDate,
  formatDuration,
  formatPassengerSummary,
  formatDeckCount,
  getBoatDeckCount,
  getBoatSeatSetupType,
  getBoatId,
  getBoatSeatCount,
  getBoatPrice,
  isActiveBoat,
  showBookingHoldCountdown,
  bookingHoldRemainingMs,
  quotePaymentDeadline,
  formatDateTime,
  formatCountdown,
  quoteTotal,
  bookingPaidAmount,
  selectedBoats,
  payments,
  manualStatusOptions,
  getStatusInfo,
  onSubmitQuote,
  onQuoteBoatChange,
  onQuoteRentalUnitChange,
  onStatusChange,
  onNavigateTab,
}) {
  const routePricingWarning = getCharterRoutePricingWarning(booking, lang);
  const quoteRentalUnit = quoteForm?.rentalUnit === "Day" ? "Day" : "Hour";
  const canSubmitQuote = canManageQuote
    && isQuoteBoatSelectionComplete
    && hasCharterRouteForPricing(booking)
    && !isSubmitting;

  if (phase === "quote") {
    return (
      <section className="space-y-6">
        <AdminCharterRouteInfoPanel lang={lang} booking={booking} formatDate={formatDate} />

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <form onSubmit={onSubmitQuote} className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
                  {lang === "VN" ? "Gán tàu & chốt giá" : "Assign Boats & Quote"}
                </h3>
              </div>
              <span className={`w-max rounded-xl border px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider ${statusInfo.classes}`}>
                {statusInfo.label}
              </span>
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Hình thức thuê (khách chọn)" : "Rental type (customer choice)"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-xl bg-[#124757] px-3 py-2 text-[11px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900">
                  {quoteRentalUnit === "Hour"
                    ? (lang === "VN" ? "Theo giờ" : "Hourly")
                    : (lang === "VN" ? "Theo ngày" : "Daily")}
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  {lang === "VN" ? "Admin không đổi — thời lượng do hệ thống tính từ lộ trình." : "Locked for admin — duration comes from the route estimate."}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-400">
                {lang === "VN"
                  ? quoteRentalUnit === "Hour"
                    ? "Theo giờ: thời lượng tính tiền lấy từ ước tính lộ trình (thường làm tròn tối thiểu 1 giờ)."
                    : "Theo ngày: dùng đơn giá ngày của tàu; số ngày do hệ thống ước tính."
                  : quoteRentalUnit === "Hour"
                    ? "Hourly: chargeable duration comes from the route estimate (usually at least 1 hour)."
                    : "Daily: uses the boat daily rate; day count comes from the system estimate."}
              </p>
            </div>

            {booking.specialRequests ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Ghi chú đặc biệt" : "Special requests"}
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                  {booking.specialRequests}
                </p>
              </div>
            ) : null}

            {!canManageQuote && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                {hasBlockingPayment
                  ? (lang === "VN" ? "Booking đã có giao dịch đang chờ hoặc đã thanh toán. Không thể đổi tàu hay báo giá." : "This booking has a pending or paid transaction. Boats and pricing can no longer be changed.")
                  : (lang === "VN" ? "Trạng thái hiện tại không cho phép cập nhật báo giá." : "The current status does not allow quote changes.")}
              </div>
            )}

            {routePricingWarning ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="material-symbols-outlined text-base">warning</span>
                <p className="text-xs font-bold leading-relaxed">{routePricingWarning}</p>
              </div>
            ) : null}

            <fieldset disabled={!canManageQuote || isSubmitting} className="mt-5 space-y-5 disabled:opacity-60">
              <div className="grid gap-4 xl:grid-cols-2">
                {quoteForm.boats.map((quoteBoat) => {
                  const selectedBoatIds = quoteForm.boats
                    .filter((boat) => boat.boatOrder !== quoteBoat.boatOrder && boat.boatId)
                    .map((boat) => boat.boatId);
                  const availableBoats = boats.filter((boat) => {
                    const boatId = getBoatId(boat);
                    const requiredDecks = Number(quoteBoat.requiredNumberOfDecks) || 0;
                    const matchesDeck = !requiredDecks || getBoatDeckCount(boat) === requiredDecks;
                    const matchesSeatSetup = requiredDecks
                      ? true
                      : (!quoteBoat.requiredSeatSetupType || getBoatSeatSetupType(boat) === quoteBoat.requiredSeatSetupType);
                    return isActiveBoat(boat) && matchesDeck && matchesSeatSetup && (!selectedBoatIds.includes(boatId) || boatId === quoteBoat.boatId);
                  });

                  return (
                    <div key={quoteBoat.boatOrder} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                          {lang === "VN" ? `Tàu ${quoteBoat.boatOrder}` : `Boat ${quoteBoat.boatOrder}`}
                        </p>
                        <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-black uppercase text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                          {formatDeckCount(quoteBoat.requiredNumberOfDecks, lang) || quoteBoat.requiredSeatSetupType || "--"}
                        </span>
                      </div>
                      <AdminBoatQuoteSelect
                        lang={lang}
                        boatId={quoteBoat.boatId}
                        availableBoats={availableBoats}
                        rentalUnit={quoteRentalUnit}
                        currencyFormatter={currencyFormatter}
                        onChange={(nextBoatId) => onQuoteBoatChange(quoteBoat.boatOrder, nextBoatId)}
                        getBoatId={getBoatId}
                        getBoatDeckCount={getBoatDeckCount}
                        getBoatSeatCount={getBoatSeatCount}
                        getBoatPrice={getBoatPrice}
                        formatDeckCount={formatDeckCount}
                        disabled={!canManageQuote || isSubmitting}
                      />
                    </div>
                  );
                })}
              </div>

              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {lang === "VN"
                  ? `Đang báo giá ${quoteRentalUnit === "Hour" ? "theo giờ" : "theo ngày"} — giá tương ứng được tô đậm trong danh sách tàu. Chọn đủ tàu rồi xem trước / chốt giá.`
                  : `Quoting ${quoteRentalUnit === "Hour" ? "hourly" : "daily"} — matching rates are highlighted in the boat list. Select boats, then preview / submit.`}
              </p>

              <button type="submit" disabled={!canSubmitQuote} className="w-full rounded-xl bg-[#124757] px-6 py-3 text-xs font-headline font-black uppercase tracking-widest text-white disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900">
                {isSubmitting ? (lang === "VN" ? "Đang xử lý..." : "Submitting...") : (lang === "VN" ? "Chốt giá" : "Submit Quote")}
              </button>
            </fieldset>
          </form>

          <CharterQuotePreviewPanel
            lang={lang}
            currencyFormatter={currencyFormatter}
            isPreviewLoading={isPreviewLoading}
            quotePreviewError={quotePreviewError}
            quotePreview={quotePreview}
            booking={booking}
            quoteForm={quoteForm}
            boatsCatalog={boats}
            getBoatId={getBoatId}
            getBoatPrice={getBoatPrice}
            isQuoteBoatSelectionComplete={isQuoteBoatSelectionComplete}
          />
        </div>

        <ManualStatusPanel
          lang={lang}
          isSubmitting={isSubmitting}
          manualStatusOptions={manualStatusOptions}
          getStatusInfo={getStatusInfo}
          onStatusChange={onStatusChange}
        />
      </section>
    );
  }

  if (phase === "payment") {
    return (
      <section className="space-y-6">
        <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Báo giá đã chốt" : "Quote confirmed"}
              </h3>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {lang === "VN" ? "Theo dõi thanh toán của khách trên tab Thanh toán." : "Monitor customer payment on the Payments tab."}
              </p>
            </div>
            <span className={`w-max rounded-xl border px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider ${statusInfo.classes}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="mt-5">
            <AdminCharterRouteInfoPanel lang={lang} booking={booking} formatDate={formatDate} compact />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: lang === "VN" ? "Giá chốt" : "Quote", value: quoteTotal > 0 ? currencyFormatter.format(quoteTotal) : "--" },
              { label: lang === "VN" ? "Đã thu" : "Paid", value: bookingPaidAmount > 0 ? currencyFormatter.format(bookingPaidAmount) : "--" },
              { label: lang === "VN" ? "Hành khách" : "Passengers", value: formatPassengerSummary(booking, lang) },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>

          {showBookingHoldCountdown && (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-500/20 dark:bg-sky-500/10">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">
                {lang === "VN" ? "Hạn thanh toán 12h sau khi chốt giá" : "12h payment window after quote"}
              </p>
              <p className="mt-1 font-headline text-2xl font-black tabular-nums text-sky-700 dark:text-sky-300">
                {bookingHoldRemainingMs > 0 ? formatCountdown(bookingHoldRemainingMs) : (lang === "VN" ? "Hết hạn" : "Expired")}
              </p>
              <p className="mt-1 text-xs font-bold text-sky-600/80 dark:text-sky-200">{formatDateTime(quotePaymentDeadline)}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => onNavigateTab("payments")}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#124757] px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
          >
            <span className="material-symbols-outlined text-base">payments</span>
            {lang === "VN" ? "Mở tab thanh toán" : "Open payments tab"}
          </button>
        </div>

        <ManualStatusPanel lang={lang} isSubmitting={isSubmitting} manualStatusOptions={manualStatusOptions} getStatusInfo={getStatusInfo} onStatusChange={onStatusChange} />
      </section>
    );
  }

  if (phase === "operate") {
    return (
      <section className="space-y-6">
        <div className="rounded-4xl border border-emerald-100 bg-emerald-50 p-6 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-3xl text-emerald-600 dark:text-emerald-300">sailing</span>
              <div>
                <h3 className="font-headline font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  {lang === "VN" ? "Sẵn sàng vận hành" : "Ready for operation"}
                </h3>
                <p className="mt-1 text-sm font-bold text-emerald-700/80 dark:text-emerald-200">
                  {formatPassengerSummary(booking, lang)} · {booking.route}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("tickets")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white"
            >
              {lang === "VN" ? "Quản lý vé/khách" : "Manage tickets"}
              <span className="material-symbols-outlined text-base">confirmation_number</span>
            </button>
          </div>
        </div>

        <ManualStatusPanel lang={lang} isSubmitting={isSubmitting} manualStatusOptions={manualStatusOptions} getStatusInfo={getStatusInfo} onStatusChange={onStatusChange} />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-4xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-3xl text-slate-500">event_busy</span>
            <div>
              <h3 className="font-headline font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {lang === "VN" ? "Booking đã đóng" : "Booking closed"}
              </h3>
              <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
                {statusInfo.label} · {lang === "VN" ? "Không thể chỉnh báo giá hoặc gán tàu." : "Quote and boat assignment are no longer available."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigateTab("payments")} className="rounded-xl bg-[#124757] px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900">
              {lang === "VN" ? "Xem thanh toán" : "View payments"}
            </button>
            {booking.status === "Completed" && (
              <button type="button" onClick={() => onNavigateTab("tickets")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {lang === "VN" ? "Xem vé/khách" : "View tickets"}
              </button>
            )}
          </div>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <CharterPaymentLedger payments={payments} lang={lang} currencyFormatter={currencyFormatter} />
        </div>
      )}

      {selectedBoats.length > 0 && (
        <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Tàu đã gán" : "Assigned boats"}
          </h3>
          <div className="mt-4 space-y-2">
            {selectedBoats.map((boat, index) => (
              <div key={getBoatId(boat) || index} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {boat.code ? `${boat.code} - ` : ""}{boat.name || "--"}
              </div>
            ))}
          </div>
        </div>
      )}

      <ManualStatusPanel lang={lang} isSubmitting={isSubmitting} manualStatusOptions={manualStatusOptions} getStatusInfo={getStatusInfo} onStatusChange={onStatusChange} />
    </section>
  );
}

const getTicketId = (ticket) => getCharterTicketId(ticket);

const getDownloadName = (response, fallbackName) => {
  const disposition = response.headers?.["content-disposition"] || "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const encodedName = utf8Match?.[1] || plainMatch?.[1];
  if (!encodedName) return fallbackName;
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
};

const downloadBlobResponse = (response, fallbackName) => {
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = getDownloadName(response, fallbackName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const openBlobInNewTab = (response) => {
  const url = URL.createObjectURL(response.data);
  const popup = window.open(url, "_blank");
  if (!popup) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
};

const getTicketStatusMeta = (status, lang) => {
  const normalized = String(status || "").toLowerCase().replace(/[\s_-]/g, "");
  switch (normalized) {
    case "active":
      return {
        label: lang === "VN" ? "Hoạt động" : "Active",
        classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
      };
    case "checkedin":
      return {
        label: lang === "VN" ? "Đã lên tàu" : "Checked in",
        classes: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
      };
    case "noshow":
      return {
        label: lang === "VN" ? "Không đến" : "No show",
        classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
      };
    case "cancelled":
    case "canceled":
      return {
        label: lang === "VN" ? "Đã hủy" : "Cancelled",
        classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
      };
    default:
      return {
        label: status || "--",
        classes: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
      };
  }
};

export function AdminBookingTicketsTab({
  lang,
  booking,
  tickets,
  formatDate,
}) {
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState("");

  const ticketRows = tickets.map((ticket, index) => {
    const ticketId = getTicketId(ticket);
    const ticketCode = pick(ticket, ["ticketCode", "code", "ticketNumber"], "");
    const fullName = pick(ticket, ["fullName", "passengerName", "name", "contactName"], "");
    const passengerType = pick(ticket, ["passengerType", "type"], "");
    const birthYear = getPassengerBirthYear(ticket);
    const status = pick(ticket, ["attendanceStatus", "ticketStatus", "status"], "Active");

    return {
      ticket,
      index,
      ticketId,
      ticketCode: ticketCode || (ticketId ? `ID ···${String(ticketId).slice(-8)}` : `#${index + 1}`),
      fullName: fullName || (lang === "VN" ? "Chưa có tên" : "No name"),
      passengerType: formatCharterPassengerType(passengerType, lang),
      birthYear,
      status,
      hasTicketId: Boolean(ticketId),
    };
  });

  const selectableTicketIds = ticketRows.filter((row) => row.hasTicketId).map((row) => row.ticketId);
  const canViewTickets = canShowCharterTickets(booking);
  const canExportTickets = canViewTickets && ticketRows.length > 0;
  const isFullyPaid = isCharterFullyPaid(booking);
  const hasManifest = hasCharterPassengerManifest(booking);

  const ticketGateMessage = (() => {
    if (!isFullyPaid) {
      return {
        tone: "amber",
        title: lang === "VN" ? "Chưa thanh toán đủ" : "Not fully paid",
        text: lang === "VN"
          ? "Vé chỉ phát hành sau khi khách thanh toán đủ (paymentStatus = Paid)."
          : "Tickets are issued only after the booking is fully paid (paymentStatus = Paid).",
      };
    }
    if (!hasManifest) {
      return {
        tone: "sky",
        title: lang === "VN" ? "Chưa có danh sách hành khách" : "Passenger list missing",
        text: lang === "VN"
          ? "Khách cần nhập và lưu danh sách hành khách trên trang booking của họ. Sau đó vé sẽ xuất hiện tại đây."
          : "The customer must save the passenger manifest on their booking page. Tickets will appear here afterward.",
      };
    }
    return null;
  })();

  useEffect(() => {
    if (!booking?.qrToken) {
      setQrImageUrl("");
      return undefined;
    }

    let active = true;
    let objectUrl = "";

    fetchCharterBookingQrImage(booking.qrToken)
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setQrImageUrl(objectUrl);
      })
      .catch(() => {
        if (active) setQrImageUrl("");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [booking?.qrToken]);

  const resolveTicketIds = useCallback((ticketIds = null) => {
    if (Array.isArray(ticketIds) && ticketIds.length > 0) return ticketIds;
    if (selectedTicketIds.length > 0) return selectedTicketIds;
    return null;
  }, [selectedTicketIds]);

  const handleTicketAction = async (action, ticketIds = null) => {
    if (!booking?.id || !canExportTickets) return;

    const targetTicketIds = resolveTicketIds(ticketIds);
    const popup = action === "print" || action === "view" ? window.open("", "_blank") : null;

    try {
      setIsSubmitting(true);
      let response;

      if (action === "zip") {
        response = targetTicketIds
          ? await downloadSelectedCharterBookingTickets(booking.id, targetTicketIds)
          : await downloadAllCharterBookingTickets(booking.id);
        downloadBlobResponse(response, `${booking.bookingCode}-tickets.zip`);
      } else if (action === "pdf") {
        try {
          response = await downloadCharterBookingTicketsPdf(booking.id, targetTicketIds);
        } catch (pdfError) {
          if (targetTicketIds || !booking.qrToken) throw pdfError;
          response = await downloadCharterBookingTicketsPdfByQrToken(booking.qrToken);
        }
        downloadBlobResponse(response, `${booking.bookingCode}-tickets.pdf`);
      } else {
        response = await printSelectedCharterBookingTickets(booking.id, targetTicketIds);
        const url = URL.createObjectURL(response.data);
        if (popup) popup.location.href = url;
        else openBlobInNewTab(response);
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (error) {
      if (popup) popup.close();
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể xuất vé" : "Unable to export tickets",
        text: getApiErrorMessage(
          error,
          lang === "VN"
            ? "Không thể mở hoặc in vé. Vui lòng thử lại sau khi khách đã lưu danh sách hành khách."
            : "Unable to open or print tickets. Please try again after the passenger list is saved.",
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTicketSelection = (ticketId) => {
    if (!ticketId) return;
    setSelectedTicketIds((prev) => (
      prev.includes(ticketId) ? prev.filter((id) => id !== ticketId) : [...prev, ticketId]
    ));
  };

  const toggleSelectAll = () => {
    setSelectedTicketIds((prev) => (
      prev.length === selectableTicketIds.length ? [] : [...selectableTicketIds]
    ));
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-4xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
                {lang === "VN" ? "Vé & hành khách" : "Tickets & passengers"}
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {lang === "VN"
                  ? "Xem, in hoặc tải vé để xử lý khi khách gặp sự cố tại bến."
                  : "View, print, or download tickets for on-site passenger support."}
              </p>
            </div>
            {qrImageUrl && (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <img src={qrImageUrl} alt={lang === "VN" ? "QR tổng booking" : "Booking group QR"} className="h-20 w-20 rounded-xl bg-white object-contain p-1" />
                <div>
                  <p className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "QR tổng" : "Group QR"}</p>
                  <p className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">{booking.bookingCode}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 px-6 py-6 md:px-8">
          {ticketGateMessage && (
            <div className={`rounded-2xl border px-4 py-4 ${
              ticketGateMessage.tone === "sky"
                ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200"
                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
            }`}
            >
              <p className="text-sm font-headline font-black">{ticketGateMessage.title}</p>
              <p className="mt-1 text-xs font-bold leading-5 opacity-90">{ticketGateMessage.text}</p>
            </div>
          )}

          {canViewTickets && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => handleTicketAction("view")}
              disabled={isSubmitting || !canExportTickets}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
            >
              <span className="material-symbols-outlined text-base">visibility</span>
              {selectedTicketIds.length > 0
                ? (lang === "VN" ? `Xem ${selectedTicketIds.length} vé` : `View ${selectedTicketIds.length}`)
                : (lang === "VN" ? "Xem tất cả vé" : "View all tickets")}
            </button>
            <button
              type="button"
              onClick={() => handleTicketAction("print")}
              disabled={isSubmitting || !canExportTickets}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
            >
              <span className="material-symbols-outlined text-base">print</span>
              {lang === "VN" ? "In vé" : "Print"}
            </button>
            <button
              type="button"
              onClick={() => handleTicketAction("pdf")}
              disabled={isSubmitting || !canExportTickets}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#124757] px-4 py-3 text-xs font-headline font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
            >
              <span className="material-symbols-outlined text-base">download</span>
              {lang === "VN" ? "Tải PDF" : "Download PDF"}
            </button>
          </div>
          )}

          {canExportTickets && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F8FBFC] px-4 py-3 ring-1 ring-[#D8E7EA] dark:bg-slate-900 dark:ring-slate-700">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedTicketIds.length > 0 && selectedTicketIds.length === selectableTicketIds.length}
                  onChange={toggleSelectAll}
                  className="accent-[#124757]"
                />
                {lang === "VN" ? "Chọn tất cả" : "Select all"}
              </label>
              {selectedTicketIds.length > 0 ? (
                <p className="text-xs font-bold text-slate-400">
                  {lang === "VN" ? `Đã chọn ${selectedTicketIds.length}/${ticketRows.length} vé` : `${selectedTicketIds.length}/${ticketRows.length} selected`}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-4xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
          <h3 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
            {lang === "VN" ? "Danh sách vé" : "Ticket list"}
          </h3>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {ticketRows.length} {lang === "VN" ? "vé" : "ticket(s)"} · {booking.route} · {formatDate(booking.departureDate)}
          </p>
        </div>

        <div className="space-y-3 px-6 py-6 md:px-8">
          {ticketRows.length > 0 ? ticketRows.map((row) => {
            const statusMeta = getTicketStatusMeta(row.status, lang);
            const isSelected = row.ticketId && selectedTicketIds.includes(row.ticketId);

            return (
              <div
                key={row.ticketId || `${row.ticketCode}-${row.index}`}
                className={`rounded-2xl border p-4 transition ${isSelected ? "border-[#124757] bg-[#F7FAFB] dark:border-yellow-400 dark:bg-slate-900" : "border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-900"}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {row.ticketId ? (
                      <label className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTicketSelection(row.ticketId)}
                          className="accent-[#124757]"
                        />
                      </label>
                    ) : (
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-400 dark:bg-slate-800">
                        {row.index + 1}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-headline text-base font-black text-[#124757] dark:text-yellow-400">{row.ticketCode}</p>
                        <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-headline font-black uppercase tracking-wider ${statusMeta.classes}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{row.fullName}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-400">
                        {row.passengerType && (
                          <span>{lang === "VN" ? "Loại" : "Type"}: {row.passengerType}</span>
                        )}
                        {row.birthYear && (
                          <span>{lang === "VN" ? "Năm sinh" : "Birth year"}: {row.birthYear}</span>
                        )}
                        {row.hasTicketId && (
                          <span className="font-mono text-[10px]">ID: {row.ticketId}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => handleTicketAction("view", row.hasTicketId ? [row.ticketId] : null)}
                      disabled={isSubmitting || !row.hasTicketId}
                      title={!row.hasTicketId ? (lang === "VN" ? "Vé chưa có ID hệ thống, dùng Xem tất cả vé" : "No ticket ID yet, use View all") : undefined}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-400"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      {lang === "VN" ? "Xem vé" : "View"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTicketAction("print", row.hasTicketId ? [row.ticketId] : null)}
                      disabled={isSubmitting || !row.hasTicketId}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#124757] px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
                    >
                      <span className="material-symbols-outlined text-sm">print</span>
                      {lang === "VN" ? "In" : "Print"}
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-700">
              <span className="material-symbols-outlined text-4xl text-slate-300">confirmation_number</span>
              <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
                {!canViewTickets
                  ? (lang === "VN" ? "Chưa có vé để hiển thị." : "No tickets to display yet.")
                  : (lang === "VN" ? "Đã đủ điều kiện nhưng hệ thống chưa trả vé." : "Eligible, but the system has not returned tickets yet.")}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {lang === "VN"
                  ? "Cần: thanh toán đủ + khách đã lưu danh sách hành khách."
                  : "Requires: full payment + saved passenger manifest."}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
