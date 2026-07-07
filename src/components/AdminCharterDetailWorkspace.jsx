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
  formatCharterTicketDate,
  getCharterTicketId,
  hasCharterPassengerManifest,
  isCharterFullyPaid,
} from "../utils/charterBookingTickets";
import { getApiErrorMessage } from "../utils/apiError";
import { CharterPaymentLedger } from "./CharterPaymentLedger";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

function QuotePreviewPanel({
  lang,
  currencyFormatter,
  isPreviewLoading,
  quotePreviewError,
  quotePreview,
  isQuoteBoatSelectionComplete,
}) {
  return (
    <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
      <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
        {lang === "VN" ? "Preview giá" : "Quote Preview"}
      </h3>
      {isPreviewLoading ? (
        <p className="mt-4 text-xs font-bold text-slate-400">{lang === "VN" ? "Đang tính..." : "Calculating..."}</p>
      ) : quotePreviewError ? (
        <p className="mt-4 text-xs font-bold text-red-500">{quotePreviewError}</p>
      ) : quotePreview ? (
        <div className="mt-4 space-y-3">
          {Array.isArray(quotePreview.boats) && quotePreview.boats.map((boat, index) => (
            <div key={`${pick(boat, ["boatOrder"], index + 1)}-${index}`} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-black text-slate-500 dark:text-slate-300">
                  {lang === "VN" ? `Tàu ${pick(boat, ["boatOrder"], index + 1)}` : `Boat ${pick(boat, ["boatOrder"], index + 1)}`}
                </span>
                <span className="font-headline font-black text-[#124757] dark:text-yellow-400">
                  {currencyFormatter.format(Number(pick(boat, ["subtotalAmount"], 0)) || 0)}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {lang === "VN" ? "Đơn giá" : "Unit price"}: {currencyFormatter.format(Number(pick(boat, ["unitPrice"], 0)) || 0)}
              </p>
            </div>
          ))}
          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500 dark:border-slate-700 dark:text-slate-300">
            <div className="flex justify-between">
              <span>{lang === "VN" ? "Tổng trước giảm" : "Subtotal"}</span>
              <span>{currencyFormatter.format(Number(pick(quotePreview, ["subtotalAmount"], 0)) || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>{lang === "VN" ? "Giảm giá" : "Discount"}</span>
              <span>{currencyFormatter.format(Number(pick(quotePreview, ["discountAmount"], 0)) || 0)}</span>
            </div>
            <div className="flex justify-between font-headline font-black text-[#124757] dark:text-yellow-400">
              <span>{lang === "VN" ? "Tổng cuối" : "Total"}</span>
              <span>{currencyFormatter.format(Number(pick(quotePreview, ["totalAmount"], 0)) || 0)}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-xs font-bold text-slate-400 dark:border-slate-700">
          {isQuoteBoatSelectionComplete
            ? (lang === "VN" ? "Preview sẽ hiển thị sau khi hệ thống tính giá." : "Preview will appear after pricing is calculated.")
            : (lang === "VN" ? "Chọn đủ tàu để preview giá." : "Select all boats to preview pricing.")}
        </p>
      )}
    </div>
  );
}

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
        <p className="mt-0.5 break-words text-sm font-bold leading-snug text-slate-800 dark:text-white">{value || "--"}</p>
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
  adminActionInfo,
  showBookingHoldCountdown,
  bookingHoldRemainingMs,
  formatDate,
  formatDateTime,
  formatCountdown,
  formatDuration,
  formatPassengerSummary,
  formatDeckCount,
  getRequestedDeckCount,
  getBoatDeckCount,
  getBoatSeatSetupType,
  getBoatId,
  getBoatSeatCount,
  getPaymentStatusInfo,
  currencyFormatter,
  quoteTotal,
  bookingPaidAmount,
  remainingAmount,
  requestedBoats,
  selectedBoats,
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

  return (
    <div className="space-y-5">
      <section className={`overflow-hidden rounded-[2rem] border shadow-[0_18px_50px_rgba(15,23,42,0.06)] ${adminActionInfo.urgent ? "border-amber-200/80 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10" : "border-slate-200/70 bg-white dark:border-slate-700/70 dark:bg-slate-800"}`}>
        <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${adminActionInfo.urgent ? "bg-amber-500 text-white" : "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"}`}>
              <span className="material-symbols-outlined text-2xl">{adminActionInfo.icon}</span>
            </span>
            <div>
              <p className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Việc cần làm tiếp theo" : "Next action"}</p>
              <p className="mt-1 font-headline text-xl font-black text-slate-800 dark:text-white">{adminActionInfo.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab(adminActionInfo.tab || "actions")}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-headline font-black uppercase tracking-wider md:w-auto ${adminActionInfo.buttonClasses}`}
          >
            {adminActionInfo.cta}
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>

        {showBookingHoldCountdown && (
          <div className="border-t border-sky-100 bg-sky-50/80 px-6 py-4 dark:border-sky-500/20 dark:bg-sky-500/10 md:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold text-sky-600 dark:text-sky-300">
                  {lang === "VN" ? "Hạn thanh toán sau khi khách chấp nhận" : "Payment deadline after acceptance"}
                </p>
                <p className="mt-1 text-sm font-bold text-sky-700 dark:text-sky-200">{formatDateTime(booking.bookingHoldExpiresAt)}</p>
              </div>
              <p className="font-headline text-3xl font-black tabular-nums text-sky-700 dark:text-sky-200">
                {bookingHoldRemainingMs > 0 ? formatCountdown(bookingHoldRemainingMs) : (lang === "VN" ? "Hết hạn" : "Expired")}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
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
              <OverviewField
                icon="route"
                label={lang === "VN" ? "Lộ trình" : "Route"}
                value={booking.route}
              />
              <OverviewField
                icon="event"
                label={lang === "VN" ? "Lịch thuê" : "Schedule"}
                value={`${formatDate(booking.departureDate)} · ${String(booking.startTime).slice(0, 5)}`}
                hint={formatDuration(booking.durationValue, booking.rentalUnit, lang)}
              />
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
                label={lang === "VN" ? "Ghi chú" : "Notes"}
                value={booking.note || (lang === "VN" ? "Không có ghi chú" : "No notes")}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab("payments")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wider text-[#124757] transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-base">payments</span>
            {lang === "VN" ? "Mở tab thanh toán" : "Open payments tab"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
          <h2 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
            {lang === "VN" ? "Tàu yêu cầu & đã gán" : "Requested vs assigned boats"}
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {lang === "VN" ? "So sánh nhanh từng tàu theo yêu cầu khách" : "Quick comparison per requested boat"}
          </p>
        </div>

        <div className="space-y-3 px-6 py-6 md:px-8">
          {boatRows.length > 0 ? boatRows.map(({ requested, assigned, index }) => {
            const requestedText = requested
              ? formatDeckCount(getRequestedDeckCount(requested), lang) || pick(requested, ["requiredSeatSetupType", "seatSetupType"], "--")
              : "--";
            const assignedName = assigned
              ? `${assigned.code ? `${assigned.code} · ` : ""}${assigned.name || pick(assigned, ["boatName"], "--")}`
              : null;
            const assignedMeta = assigned
              ? `${formatDeckCount(getBoatDeckCount(assigned), lang) || getBoatSeatSetupType(assigned) || "--"} · ${getBoatSeatCount(assigned)} ${lang === "VN" ? "ghế" : "seats"}`
              : null;

            return (
              <div
                key={`boat-row-${index}`}
                className="grid gap-3 rounded-2xl border border-slate-200/80 bg-[#F8FBFC] p-4 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[56px_1fr_1fr]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#124757] font-headline text-lg font-black text-white dark:bg-yellow-400 dark:text-slate-900">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Yêu cầu" : "Requested"}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">{requestedText}</p>
                </div>
                <div className="min-w-0 md:border-l md:border-slate-200 md:pl-4 dark:md:border-slate-700">
                  <p className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Đã gán" : "Assigned"}</p>
                  {assignedName ? (
                    <>
                      <p className="mt-1 text-sm font-bold text-[#124757] dark:text-yellow-400">{assignedName}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">{assignedMeta}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm font-bold text-slate-400">{lang === "VN" ? "Chưa gán tàu" : "Not assigned yet"}</p>
                  )}
                </div>
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
  rentalUnits,
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
  getRequestedDeckCount,
  getBoatDeckCount,
  getBoatSeatSetupType,
  getBoatId,
  getBoatSeatCount,
  getBoatPrice,
  isActiveBoat,
  showBookingHoldCountdown,
  bookingHoldRemainingMs,
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
  onStatusChange,
  onNavigateTab,
}) {
  if (phase === "quote") {
    return (
      <section className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <form onSubmit={onSubmitQuote} className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
                  {lang === "VN" ? "Gán tàu & chốt giá" : "Assign Boats & Quote"}
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {lang === "VN" ? "Bước 1: chọn tàu và xác nhận giá cho khách." : "Step 1: assign boats and confirm pricing."}
                </p>
              </div>
              <span className={`w-max rounded-xl border px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider ${statusInfo.classes}`}>
                {statusInfo.label}
              </span>
            </div>

            {!canManageQuote && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                {hasBlockingPayment
                  ? (lang === "VN" ? "Booking đã có giao dịch đang chờ hoặc đã thanh toán. Không thể đổi tàu hay báo giá." : "This booking has a pending or paid transaction. Boats and pricing can no longer be changed.")
                  : (lang === "VN" ? "Trạng thái hiện tại không cho phép cập nhật báo giá." : "The current status does not allow quote changes.")}
              </div>
            )}

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
                      <select
                        value={quoteBoat.boatId}
                        onChange={(event) => onQuoteBoatChange(quoteBoat.boatOrder, event.target.value)}
                        required
                        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">{lang === "VN" ? "Chọn tàu" : "Select boat"}</option>
                        {availableBoats.map((boat) => {
                          const boatId = getBoatId(boat);
                          const deckText = formatDeckCount(getBoatDeckCount(boat), lang);
                          return (
                            <option key={boatId} value={boatId}>
                              {boat.code ? `${boat.code} - ` : ""}{boat.name} ({getBoatSeatCount(boat)} {lang === "VN" ? "ghế" : "seats"}{deckText ? `, ${deckText}` : ""}) - {currencyFormatter.format(getBoatPrice(boat, quoteForm.rentalUnit || booking.rentalUnit || "Day"))}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="block">
                  <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Đơn vị" : "Unit"}</span>
                  <select value={quoteForm.rentalUnit} onChange={(event) => setQuoteForm((prev) => ({ ...prev, rentalUnit: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                    <option value="">{lang === "VN" ? "Giữ nguyên" : "Keep current"}</option>
                    {rentalUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Thời lượng" : "Duration"}</span>
                  <input type="number" min="1" max="60" value={quoteForm.durationValue} onChange={(event) => setQuoteForm((prev) => ({ ...prev, durationValue: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Tổng giá thủ công" : "Manual total"}</span>
                  <input type="number" min="0" value={quoteForm.subtotalAmount} onChange={(event) => setQuoteForm((prev) => ({ ...prev, subtotalAmount: event.target.value }))} placeholder={lang === "VN" ? "Để trống = tự tính" : "Empty = auto"} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                </label>
                <label className="block md:col-span-4">
                  <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Mã khuyến mãi" : "Promo code"}</span>
                  <input value={quoteForm.promotionCode} onChange={(event) => setQuoteForm((prev) => ({ ...prev, promotionCode: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                </label>
              </div>

              <button type="submit" disabled={isSubmitting || !isQuoteBoatSelectionComplete || !canManageQuote} className="w-full rounded-xl bg-[#124757] px-6 py-3 text-xs font-headline font-black uppercase tracking-widest text-white disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900">
                {isSubmitting ? (lang === "VN" ? "Đang xử lý..." : "Submitting...") : (lang === "VN" ? "Chốt giá" : "Submit Quote")}
              </button>
            </fieldset>
          </form>

          <QuotePreviewPanel
            lang={lang}
            currencyFormatter={currencyFormatter}
            isPreviewLoading={isPreviewLoading}
            quotePreviewError={quotePreviewError}
            quotePreview={quotePreview}
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

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: lang === "VN" ? "Lộ trình" : "Route", value: booking.route },
              { label: lang === "VN" ? "Lịch thuê" : "Schedule", value: `${formatDate(booking.departureDate)} ${String(booking.startTime).slice(0, 5)} · ${formatDuration(booking.durationValue, booking.rentalUnit, lang)}` },
              { label: lang === "VN" ? "Giá chốt" : "Quote", value: quoteTotal > 0 ? currencyFormatter.format(quoteTotal) : "--" },
              { label: lang === "VN" ? "Đã thu" : "Paid", value: bookingPaidAmount > 0 ? currencyFormatter.format(bookingPaidAmount) : "--" },
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
                {lang === "VN" ? "Hạn thanh toán sau chấp nhận" : "Payment deadline"}
              </p>
              <p className="mt-1 font-headline text-2xl font-black tabular-nums text-sky-700 dark:text-sky-300">
                {bookingHoldRemainingMs > 0 ? formatCountdown(bookingHoldRemainingMs) : (lang === "VN" ? "Hết hạn" : "Expired")}
              </p>
              <p className="mt-1 text-xs font-bold text-sky-600/80 dark:text-sky-200">{formatDateTime(booking.bookingHoldExpiresAt)}</p>
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
  formatDateTime,
  formatPassengerSummary,
  getPaymentStatusInfo,
}) {
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState("");

  const ticketRows = tickets.map((ticket, index) => {
    const ticketId = getTicketId(ticket);
    const ticketCode = pick(ticket, ["ticketCode", "code", "ticketNumber"], "");
    const fullName = pick(ticket, ["fullName", "passengerName", "name", "contactName"], "");
    const passengerType = pick(ticket, ["passengerType", "type"], "");
    const dateOfBirth = formatCharterTicketDate(pick(ticket, ["dateOfBirth", "dob", "birthDate"], ""));
    const status = pick(ticket, ["attendanceStatus", "ticketStatus", "status"], "Active");

    return {
      ticket,
      index,
      ticketId,
      ticketCode: ticketCode || (ticketId ? `ID ···${String(ticketId).slice(-8)}` : `#${index + 1}`),
      fullName: fullName || (lang === "VN" ? "Chưa có tên" : "No name"),
      passengerType: formatCharterPassengerType(passengerType, lang),
      dateOfBirth,
      status,
      hasTicketId: Boolean(ticketId),
    };
  });

  const selectableTicketIds = ticketRows.filter((row) => row.hasTicketId).map((row) => row.ticketId);
  const canViewTickets = canShowCharterTickets(booking);
  const canExportTickets = canViewTickets && ticketRows.length > 0;
  const isFullyPaid = isCharterFullyPaid(booking);
  const hasManifest = hasCharterPassengerManifest(booking);
  const paymentMeta = getPaymentStatusInfo?.(booking?.paymentStatus, lang);

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
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[#F8FBFC] shadow-sm dark:border-slate-700/70 dark:bg-slate-900">
        <div className="grid gap-3 px-6 py-5 md:grid-cols-2 xl:grid-cols-4 md:px-8">
          {[
            { icon: "person", label: lang === "VN" ? "Khách đặt" : "Booker", value: booking.customerName },
            { icon: "call", label: lang === "VN" ? "Liên hệ" : "Contact", value: `${booking.phone || "--"}${booking.email ? ` · ${booking.email}` : ""}` },
            { icon: "groups", label: lang === "VN" ? "Hành khách" : "Passengers", value: formatPassengerSummary?.(booking, lang) || `${booking.passengerCount || 0}` },
            { icon: "event", label: lang === "VN" ? "Chuyến đi" : "Trip", value: `${booking.route} · ${formatDate(booking.departureDate)} ${String(booking.startTime || "").slice(0, 5)}` },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="material-symbols-outlined text-base">{item.icon}</span>
                <p className="text-[11px] font-bold">{item.label}</p>
              </div>
              <p className="mt-2 break-words text-sm font-bold text-slate-800 dark:text-white">{item.value || "--"}</p>
            </div>
          ))}
        </div>
        {paymentMeta && (
          <div className="border-t border-slate-200/80 px-6 py-3 dark:border-slate-700 md:px-8">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${paymentMeta.classes}`}>
              {paymentMeta.label}
            </span>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
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
              <p className="text-xs font-bold text-slate-400">
                {selectedTicketIds.length > 0
                  ? (lang === "VN" ? `Đã chọn ${selectedTicketIds.length}/${ticketRows.length} vé` : `${selectedTicketIds.length}/${ticketRows.length} selected`)
                  : (lang === "VN" ? "Không chọn = xử lý toàn bộ vé" : "No selection = all tickets")}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
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
                        {row.dateOfBirth && (
                          <span>{lang === "VN" ? "Ngày sinh" : "DOB"}: {row.dateOfBirth}</span>
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
