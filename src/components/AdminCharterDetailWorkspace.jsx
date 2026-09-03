import { useCallback, useEffect, useState } from "react";
import { FormSelect } from "./FormSelect";
import { AdminCharterRouteDrawPanel } from "./AdminCharterRouteDrawPanel";
import {
  downloadAllCharterBookingTickets,
  downloadCharterBookingTicketsPdf,
  downloadCharterBookingTicketsPdfByQrToken,
  downloadSelectedCharterBookingTickets,
  fetchCharterBookingQrImage,
  approveCharterPassengerAddRequest,
  rejectCharterPassengerAddRequest,
} from "../services/charterBookingService";
import {
  canShowCharterTickets,
  formatCharterPassengerType,
  getCharterTicketCount,
  getPassengerBirthYear,
  getCharterTicketId,
  hasCharterPassengerManifest,
  hasCharterPassengerName,
  isApprovedCharterPassenger,
  isCharterFullyPaid,
} from "../utils/charterBookingTickets";
import { extractCharterAdditionalPaymentMeta } from "../utils/charterPayOs";
import {
  formatPassengerApprovalStatus,
  getPassengerAddRequestBatches,
  getPassengerApprovalTone,
  listBookingPassengers,
} from "../utils/charterPassengerAdd";
import { getApiErrorMessage } from "../utils/apiError";
import { buildConfirmBodyHtml, showConfirmDialog, showToast } from "../utils/swalToast";
import {
  DEFAULT_BOAT_IMAGE,
  getBoatCode,
  getBoatImageUrl,
  getBoatNameOnly,
  getBoatStatusLabel,
  getCharterRoutePricingWarning,
  getRouteCandidateLegKey,
  hasEmptyRouteCandidateLegs,
  isCharterRoutePricingBlocked,
  isRescueBoat,
  normalizeRouteEstimateLegs,
  buildCharterRoutePlan,
} from "../utils/charterBookingAdmin";
import { getRouteKindLabel, getRouteShortLabel } from "../utils/routeTypes";
import { CharterRouteMapPanel } from "./CharterRouteMapPanel";
import { CharterInsuranceInfo } from "./CharterInsuranceInfo";
import { CharterQuotePreviewPanel, CharterQuotePreviewTable } from "./CharterQuotePreviewTable";
import {
  buildBookingQuotePreview,
  formatQuoteHumanDuration,
  formatQuoteRentalUnit,
  formatQuoteUnitPriceLabel,
} from "../utils/charterQuotePreview";
import { getCharterDepositAmount } from "../utils/charterBookingActions";

const BOAT_STATUS_LABELS_VN = {
  active: "Hoạt động",
  undermaintenance: "Bảo trì",
  inactive: "Chưa hoạt động",
};

function translateBoatStatus(status, lang) {
  if (!status) return status;
  if (lang !== "VN") return status;
  const key = String(status).toLowerCase().replace(/[_-\s]/g, "");
  return BOAT_STATUS_LABELS_VN[key] || status;
}

const formatRequestTerminology = (value) => String(value || "").replace(/\bcharter\b/gi, "Request");

function resolveItineraryStructureLegs(booking) {
  if (Array.isArray(booking?.routeLegs) && booking.routeLegs.length > 0) {
    return booking.routeLegs;
  }
  return normalizeRouteEstimateLegs(booking?.routeEstimate);
}

function buildDraftSelectedLegs(routeCandidateLegs = [], selections = {}) {
  if (!Array.isArray(routeCandidateLegs) || routeCandidateLegs.length === 0) return [];
  return routeCandidateLegs.map((leg) => {
    const legKey = getRouteCandidateLegKey(leg);
    const selectedId = String(selections[legKey] || "").trim();
    const candidate = (Array.isArray(leg.candidates) ? leg.candidates : [])
      .find((item) => String(item.routeId) === selectedId) || null;
    return {
      legOrder: leg.legOrder,
      fromStationName: leg.fromStationName || "--",
      toStationName: leg.toStationName || "--",
      selected: Boolean(candidate),
      routeId: candidate?.routeId || "",
      routeCode: candidate?.routeCode || "",
      routeName: candidate?.routeName || "",
      routeType: candidate?.routeType || "",
      distanceKm: candidate?.distanceKm ?? null,
      travelMinutes: candidate?.estimatedDurationMin ?? null,
    };
  });
}

/**
 * Hiện chặng ước tính để admin xem là OK.
 * Sai chỉ khi FE tự lấy matchedRouteId / cho chốt giá mà không chọn candidates.
 */
function AdminCharterRouteInfoPanel({
  lang,
  booking,
  formatDate,
  compact = false,
  draftRouteCandidateLegs = null,
  draftRoutePlanSelections = null,
}) {
  const fromName = booking?.fromStationName || "--";
  const toName = booking?.toStationName || "--";
  const stops = Array.isArray(booking?.itineraryStops) ? booking.itineraryStops : [];
  const finalizedRoute = booking?.selectedRoute?.routeId ? booking.selectedRoute : null;
  const draftLegs = Array.isArray(draftRouteCandidateLegs) && draftRouteCandidateLegs.length > 0
    ? buildDraftSelectedLegs(draftRouteCandidateLegs, draftRoutePlanSelections || {})
    : [];
  const estimateLegs = resolveItineraryStructureLegs(booking);
  const showDraftSelection = draftLegs.length > 0;
  const allDraftSelected = showDraftSelection && draftLegs.every((leg) => leg.selected);
  const draftRoutePlan = Array.isArray(draftRouteCandidateLegs)
    ? buildCharterRoutePlan(draftRouteCandidateLegs, draftRoutePlanSelections || {})
      .filter((row) => row.routeId)
    : [];

  const finalizedRouteLabel = (() => {
    if (!finalizedRoute) return "";
    const code = String(finalizedRoute.routeCode || "").trim();
    const typeLabel = finalizedRoute.routeType
      ? getRouteKindLabel(finalizedRoute.routeType, lang)
      : "";
    // Chỉ mã + loại — không lặp tên chứa lại bến / mã booking.
    return [code || null, typeLabel || null].filter(Boolean).join(" · ")
      || String(finalizedRoute.routeId || "").trim();
  })();

  const panelTone = finalizedRoute
    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/10"
    : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900";

  return (
    <div className={`flex h-full min-h-0 flex-col rounded-3xl border ${panelTone} ${compact ? "p-4" : "p-5"}`}>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
            {lang === "VN" ? "Thông tin lộ trình" : "Route information"}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
            {fromName} → {toName}
          </p>
          {finalizedRoute ? (
            finalizedRouteLabel ? (
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-300">
                {finalizedRouteLabel}
              </p>
            ) : null
          ) : !showDraftSelection ? (
            <p className="mt-1 text-xs font-medium text-slate-400">
              {lang === "VN"
                ? "Chưa chọn tuyến — km/thời gian hiện sau khi chọn ở form chốt giá."
                : "No route yet — km/duration appear after selection in the quote form."}
            </p>
          ) : null}
        </div>
        <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
          {lang === "VN" ? "Khởi hành" : "Depart"}{" "}
          {formatDate(booking?.departureDate)} · {String(booking?.startTime || "--").slice(0, 5)}
        </span>
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
      ) : null}

      {/* Overview: skeleton chặng — chỉ khi chưa chọn / chưa chốt, và có nhiều chặng hơn cặp từ→đến */}
      {!finalizedRoute && !showDraftSelection && estimateLegs.length > 1 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Chặng lộ trình" : "Itinerary legs"}
          </p>
          {estimateLegs.map((leg) => (
            <div
              key={`estimate-leg-${leg.legOrder}`}
              className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {lang === "VN" ? `Chặng ${leg.legOrder}` : `Leg ${leg.legOrder}`}
                  {": "}
                  {leg.fromStationName || "--"} → {leg.toStationName || "--"}
                </p>
                <p className="text-[11px] font-medium text-slate-400">
                  {lang === "VN" ? "Chưa chọn" : "Not selected"}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Trong form quote: hiện trạng thái đã chọn từ candidates */}
      {showDraftSelection ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Tuyến đã chọn theo chặng" : "Selected route per leg"}
          </p>
          {draftLegs.map((leg) => {
            const hasMetrics = leg.selected && leg.distanceKm != null && leg.travelMinutes != null;
            const routeCode = String(leg.routeCode || "").trim();
            const typeLabel = leg.routeType || leg.routeLabel
              ? getRouteShortLabel(leg, lang)
              : "";
            const routeMeta = [routeCode || null, typeLabel || null].filter(Boolean).join(" · ");
            return (
              <div
                key={`draft-leg-${leg.legOrder}`}
                className={`rounded-xl border px-3 py-2.5 ${leg.selected
                  ? "border-emerald-200/80 bg-white dark:border-emerald-500/20 dark:bg-slate-800"
                  : "border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {lang === "VN" ? `Chặng ${leg.legOrder}` : `Leg ${leg.legOrder}`}
                    {draftLegs.length > 1 || leg.fromStationName !== fromName || leg.toStationName !== toName
                      ? `: ${leg.fromStationName} → ${leg.toStationName}`
                      : ""}
                  </p>
                  <p className={`text-[11px] font-medium ${leg.selected ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400"}`}>
                    {hasMetrics
                      ? `${leg.distanceKm} km · ${leg.travelMinutes} ${lang === "VN" ? "phút" : "min"}`
                      : leg.selected
                        ? (lang === "VN" ? "Đã chọn" : "Selected")
                        : (lang === "VN" ? "Chưa chọn" : "Not selected")}
                  </p>
                </div>
                {leg.selected && routeMeta ? (
                  <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">
                    {routeMeta}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Tổng km/phút sau khi chọn đủ — ẩn nếu chỉ trùng với từng chặng đơn */}
      {allDraftSelected && draftLegs.length > 1 ? (
        <div className="mt-4 rounded-xl border border-emerald-200/80 bg-white px-3 py-2.5 dark:border-emerald-500/20 dark:bg-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Tổng tuyến đã chọn" : "Selected routes total"}
          </p>
          <p className="mt-1 text-sm font-bold leading-snug text-slate-700 dark:text-slate-200">
            {(() => {
              const totalKm = draftLegs.reduce((sum, leg) => sum + (Number(leg.distanceKm) || 0), 0);
              const totalMin = draftLegs.reduce((sum, leg) => sum + (Number(leg.travelMinutes) || 0), 0);
              const hasAny = draftLegs.some((leg) => leg.distanceKm != null || leg.travelMinutes != null);
              return hasAny
                ? `${Number(totalKm.toFixed(2))} km · ${totalMin} ${lang === "VN" ? "phút" : "min"}`
                : (lang === "VN" ? "Đã chọn đủ tuyến theo chặng." : "All leg routes selected.");
            })()}
          </p>
        </div>
      ) : null}

      {finalizedRoute && (finalizedRoute.distanceKm != null || finalizedRoute.estimatedDurationMin != null) ? (
        <div className="mt-4 rounded-xl border border-emerald-200/80 bg-white px-3 py-2.5 dark:border-emerald-500/20 dark:bg-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Ước tính" : "Estimate"}
          </p>
          <p className="mt-1 text-sm font-bold leading-snug text-slate-700 dark:text-slate-200">
            {[
              finalizedRoute.distanceKm != null ? `${finalizedRoute.distanceKm} km` : "",
              finalizedRoute.estimatedDurationMin != null
                ? `${finalizedRoute.estimatedDurationMin} ${lang === "VN" ? "phút" : "min"}`
                : "",
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <CharterRouteMapPanel
          lang={lang}
          booking={booking}
          draftRoutePlan={draftRoutePlan}
          className="flex h-full min-h-72 flex-1 flex-col"
          heightClassName="min-h-72 flex-1"
        />
      </div>
    </div>
  );
}

/** Picker charter: ưu tiên mã tuyến + chuỗi bến thật của route (không lấy tên chặng booking). */
function formatRouteCandidateOptionLabel(candidate, lang, leg = null) {
  if (!candidate) return "";
  const short = getRouteShortLabel(candidate, lang);
  const code = String(candidate.routeCode || "").trim();
  const routeName = String(candidate.routeName || "").trim();

  // Ưu tiên mã tuyến để phân biệt (VD: BD-TNC) — tránh mọi option đều giống "GPS · chặng booking".
  if (code) {
    const title = routeName && !routeName.includes(code) ? `${code} · ${routeName}` : (code || routeName);
    return short && short !== "—" ? `${short} · ${title}` : title;
  }

  const fromName = String(
    candidate.fromStationName
    || leg?.fromStationName
    || "",
  ).trim();
  const toName = String(
    candidate.toStationName
    || leg?.toStationName
    || "",
  ).trim();
  if (fromName && toName) {
    return `${short} · ${fromName} → ${toName}`;
  }
  const meta = [
    short !== "—" ? short : "",
    routeName,
    candidate.distanceKm != null ? `${candidate.distanceKm} km` : "",
    candidate.estimatedDurationMin != null
      ? `${candidate.estimatedDurationMin} ${lang === "VN" ? "phút" : "min"}`
      : "",
  ].filter(Boolean).join(" · ");
  return meta || getRouteKindLabel(candidate, lang);
}

function AdminCharterRoutePlanPicker({
  lang,
  legs = [],
  selections = {},
  isLoading = false,
  loaded = false,
  error = "",
  disabled = false,
  onChange,
  onLoad,
}) {
  if (!loaded && !isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
        <span className="material-symbols-outlined text-xl text-slate-400">route</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {lang === "VN"
              ? "Đang chuẩn bị tải tuyến theo chặng..."
              : "Preparing to load routes per leg..."}
          </p>
        </div>
        {onLoad ? (
          <button
            type="button"
            onClick={() => onLoad?.()}
            disabled={disabled}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-400"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            {lang === "VN" ? "Tải lại" : "Reload"}
          </button>
        ) : null}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
        <span className="material-symbols-outlined animate-spin text-xl text-slate-400">progress_activity</span>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
          {lang === "VN" ? "Đang tải tuyến theo chặng..." : "Loading routes per leg..."}
        </p>
      </div>
    );
  }

  if (!Array.isArray(legs) || legs.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <span className="material-symbols-outlined">alt_route</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {lang === "VN" ? "Chưa có chặng để chọn tuyến" : "No legs to select routes for"}
            </p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {error || (lang === "VN"
                ? "Kiểm tra bến đón / trả trên booking, rồi tải lại."
                : "Check pickup / drop-off on the booking, then reload.")}
            </p>
            {onLoad ? (
              <button
                type="button"
                onClick={() => onLoad()}
                disabled={disabled}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-400"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                {lang === "VN" ? "Tải lại" : "Reload"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Chọn tuyến theo chặng" : "Select route per leg"}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-400">
            {lang === "VN"
              ? "Mỗi chặng chọn một tuyến có sẵn"
              : "Pick one available route for each leg."}
          </p>
        </div>
        {onLoad ? (
          <button
            type="button"
            onClick={() => onLoad()}
            disabled={disabled || isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {lang === "VN" ? "Tải lại" : "Reload"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {error}
        </div>
      ) : null}

      {legs.map((leg) => {
        const legKey = getRouteCandidateLegKey(leg);
        const candidates = Array.isArray(leg.candidates) ? leg.candidates : [];
        const selectedId = selections[legKey] || "";
        const emptyCandidates = candidates.length === 0;
        const selectedCandidate = candidates.find((c) => String(c.routeId) === String(selectedId)) || null;
        const fromLabel = leg.fromStationName || "--";
        const toLabel = leg.toStationName || "--";

        return (
          <div
            key={legKey}
            className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3F5] font-headline text-xs font-black text-[#124757] dark:bg-slate-800 dark:text-yellow-400">
                  {leg.legOrder}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                    {lang === "VN" ? `Chặng ${leg.legOrder}` : `Leg ${leg.legOrder}`}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-white">
                    {fromLabel}
                    <span className="mx-1.5 font-medium text-slate-300 dark:text-slate-600">→</span>
                    {toLabel}
                  </p>
                </div>
              </div>
              <span
                className={`text-[9px] font-headline font-black uppercase tracking-wider ${emptyCandidates
                  ? "text-slate-500 dark:text-slate-400"
                  : selectedCandidate
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-slate-500 dark:text-slate-300"
                  }`}
              >
                {emptyCandidates
                  ? (lang === "VN" ? "Không khớp" : "No match")
                  : selectedCandidate
                    ? (lang === "VN" ? "Đã chọn" : "Selected")
                    : `${candidates.length} ${lang === "VN" ? "lựa chọn" : "options"}`}
              </span>
            </div>

            {emptyCandidates ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-xl text-slate-400">link_off</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {lang === "VN"
                        ? "Chưa có tuyến GPS khớp cặp bến này"
                        : "No GPS route matches this station pair"}
                    </p>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {lang === "VN"
                        ? "Cần tạo hoặc chỉnh tuyến GPS / vòng tham quan chứa đúng hai bến theo chiều chặng."
                        : "Create or edit a GPS / sightseeing route that includes both stations in the correct order."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <FormSelect
                value={selectedId}
                onChange={(value) => onChange?.(legKey, value)}
                disabled={disabled}
                searchable
                placeholder={lang === "VN" ? "Chọn tuyến..." : "Select route..."}
                searchPlaceholder={lang === "VN" ? "Tìm theo mã / tên..." : "Search code / name..."}
                emptyLabel={lang === "VN" ? "Không có kết quả" : "No results"}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                options={candidates.map((candidate) => ({
                  value: candidate.routeId,
                  label: formatRouteCandidateOptionLabel(candidate, lang, leg),
                  searchText: [
                    getRouteShortLabel(candidate, lang),
                    leg.fromStationName,
                    leg.toStationName,
                    candidate.routeCode,
                    candidate.routeName,
                    candidate.routeId,
                  ]
                    .filter(Boolean)
                    .join(" "),
                }))}
              />
            )}
          </div>
        );
      })}
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

    return {
      dayLabel,
      hourLabel,
      dayPrice,
      hourPrice,
      activeLabel: activeUnit === "Hour" ? hourLabel : dayLabel,
    };
  };

  const renderBoatLabel = (boat) => {
    const code = getBoatCode(boat);
    const name = getBoatNameOnly(boat);
    const { activeLabel } = formatBoatPrices(boat);
    return (
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-800 dark:text-white">
          {code ? <span className="text-[#124757] dark:text-yellow-400">{code}</span> : null}
          {code && name ? <span className="text-slate-400"> · </span> : null}
          {name || code || "--"}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
          {formatBoatMeta(boat)}
        </p>
        <p className="mt-0.5 text-[11px] font-headline font-black text-[#124757] dark:text-yellow-400">
          {activeLabel}
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
        className={`flex w-full items-center gap-3 rounded-2xl border bg-white px-3 py-2.5 text-left outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 ${isOpen
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
            {renderBoatLabel(selectedBoat)}
          </>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
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
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${isSelected
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

function OverviewField({ icon, label, value, hint, action }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3F5] text-[#124757] dark:bg-slate-800 dark:text-yellow-400">
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-slate-400">{label}</p>
        <p className="mt-0.5 wrap-break-word text-sm font-bold leading-snug text-slate-800 dark:text-white">{value || "--"}</p>
        {hint ? <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

export function AdminBookingPassengersTab({ booking, lang }) {
  const passengers = listBookingPassengers(booking).filter((passenger) => (
    isApprovedCharterPassenger(passenger) && hasCharterPassengerName(passenger)
  ));
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  if (passengers.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Danh sách hành khách" : "Passenger manifest"}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {lang === "VN"
            ? "Khách chưa nhập danh sách hành khách. Danh sách sẽ xuất hiện ở đây khi khách lưu."
            : "No passenger list yet. It will appear here once the customer saves it."}
        </p>
      </section>
    );
  }

  const typeLabel = (row) => {
    const type = String(pick(row, ["passengerType", "type"], "") || "").toLowerCase();
    if (type === "adult" || type === "người lớn") return lang === "VN" ? "Người lớn" : "Adult";
    if (type === "child" || type === "trẻ em") return lang === "VN" ? "Trẻ em" : "Child";
    return lang === "VN" ? "Hành khách" : "Guest";
  };

  const typeTone = (row) => {
    const type = String(pick(row, ["passengerType", "type"], "") || "").toLowerCase();
    if (type === "adult") return "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20";
    if (type === "child") return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20";
    return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  };

  const counts = passengers.reduce(
    (acc, row) => {
      const type = String(pick(row, ["passengerType", "type"], "") || "").toLowerCase();
      if (type === "child" || type === "trẻ em") acc.child += 1;
      else acc.adult += 1;
      return acc;
    },
    { adult: 0, child: 0 },
  );

  const filtered = passengers.filter((row) => {
    if (typeFilter !== "all") {
      const t = String(pick(row, ["passengerType", "type"], "") || "").toLowerCase();
      const wantChild = typeFilter === "child";
      const isChild = t === "child" || t === "trẻ em";
      if (wantChild !== isChild) return false;
    }
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const name = String(pick(row, ["fullName", "passengerName", "name", "contactName"], "")).toLowerCase();
    const idNumber = String(pick(row, ["idNumber", "identityNumber", "nationalId", "citizenId", "passport"], "")).toLowerCase();
    const note = String(pick(row, ["note", "specialNote", "remarks"], "")).toLowerCase();
    return name.includes(q) || idNumber.includes(q) || note.includes(q);
  });

  const sizeText = "text-sm";
  const padY = "py-1.5";
  const padX = "px-3";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">
            {lang === "VN" ? "Danh sách hành khách" : "Passenger manifest"}
          </p>
          <p className={`mt-1 ${sizeText} font-bold text-slate-700 dark:text-slate-200`}>
            {passengers.length} {lang === "VN" ? "khách" : "guests"}
            <span className="ml-2 text-slate-400">·</span>
            <span className="ml-2 text-slate-500 dark:text-slate-400">
              {counts.adult} {lang === "VN" ? "lớn" : "adult"} · {counts.child} {lang === "VN" ? "trẻ em" : "child"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-slate-400">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === "VN" ? "Tìm tên" : "Search name"}
              className="w-44 rounded-full border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:border-[#124757] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 sm:w-56"
            />
          </div>
          <div className="flex rounded-full border border-slate-200 bg-white p-0.5 text-[10px] font-headline font-black uppercase tracking-wider dark:border-slate-600 dark:bg-slate-900">
            {[
              { id: "all", label: lang === "VN" ? "Tất cả" : "All" },
              { id: "adult", label: lang === "VN" ? "Người lớn" : "Adult" },
              { id: "child", label: lang === "VN" ? "Trẻ em" : "Child" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                className={`rounded-full px-3 py-1 transition ${
                  typeFilter === opt.id
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`items-center gap-4 rounded-xl bg-slate-50 ${padX} py-2 font-headline text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900/60 dark:text-slate-400`}
        style={{ display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) 72px 96px 88px" }}
      >
        <span className="flex h-6 items-center justify-center">#</span>
        <span className="min-w-0">{lang === "VN" ? "Họ tên" : "Full name"}</span>
        <span className="text-center">{lang === "VN" ? "Ghế" : "Seat"}</span>
        <span className="text-right">{lang === "VN" ? "Năm sinh" : "Birth year"}</span>
        <span className="text-center">{lang === "VN" ? "Loại" : "Type"}</span>
      </div>

      <ol className="mt-1.5 grid gap-1">
        {filtered.map((row, idx) => {
          const name = pick(row, ["fullName", "passengerName", "name", "contactName"], "");
          const birthYear = getPassengerBirthYear(row);
          const seatCode = pick(row, ["seatCode", "seatNumber", "seat"], "");
          return (
            <li
              key={`${name}-${idx}`}
              className={`items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/60 ${padX} ${padY} transition hover:border-slate-200 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600 dark:hover:bg-slate-900`}
              style={{ display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) 72px 96px 88px" }}
            >
              <span className="flex h-8 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                {idx + 1}
              </span>
              <div className={`min-w-0 flex-1 ${sizeText} font-bold text-slate-800 dark:text-white`}>
                <p className="truncate">{name}</p>
              </div>
              <div
                className={`text-center ${sizeText} font-headline font-black ${seatCode ? "text-[#124757] dark:text-yellow-400" : "text-slate-400 dark:text-slate-500"}`}
              >
                {seatCode || "--"}
              </div>
              <div
                className={`text-right ${sizeText} font-bold text-slate-800 dark:text-white`}
              >
                {birthYear || "—"}
              </div>
              <span
                className={`inline-flex w-full items-center justify-center rounded-full border px-2.5 py-0.5 text-center text-[10px] font-headline font-black uppercase tracking-wide ${typeTone(row)}`}
              >
                {typeLabel(row)}
              </span>
            </li>
          );
        })}
      </ol>

      {filtered.length === 0 ? (
        <p className="mt-3 text-center text-xs font-medium text-slate-400">
          {lang === "VN" ? "Không có khách phù hợp bộ lọc." : "No passengers match the filter."}
        </p>
      ) : null}
    </section>
  );
}

function OverviewStat({ label, value, tone = "default" }) {
  const tones = {
    default: "border-slate-200/80 bg-[#F8FBFC] dark:border-slate-700 dark:bg-slate-900",
    accent: "border-[#D8E7EA] bg-[#F7FAFB] dark:border-slate-700 dark:bg-slate-900",
    warn: "border-rose-100 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10",
    success: "border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10",
  };
  const valueTone = tone === "warn"
    ? "text-rose-600 dark:text-rose-300"
    : tone === "success"
      ? "text-emerald-600 dark:text-emerald-300"
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
  formatPassengerSummary,
  formatDeckCount,
  getRequestedDeckCount,
  getBoatDeckCount,
  getBoatSeatSetupType,
  getBoatSeatCount,
  currencyFormatter,
  quoteTotal,
  bookingPaidAmount,
  remainingAmount,
  requestedBoats,
  selectedBoats,
  routeDrawRequest = null,
  isRouteDrawSubmitting = false,
  canRequestRouteDraw = false,
  hasMissingRouteLegs = false,
  hasEnoughRouteCodes = false,
  onRequestRouteDraw,
  canRescheduleDeparture = false,
  isReschedulingDeparture = false,
  onRescheduleDeparture,
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

  const isReleasedAssignment = ["Cancelled", "Expired", "Refunded"].includes(String(booking.status || ""));
  const bookingQuotePreview = buildBookingQuotePreview(booking);
  const depositAmount = getCharterDepositAmount(quoteTotal, booking.depositAmount);
  const rentalUnitLabel = booking.rentalUnit
    ? formatQuoteRentalUnit(booking.rentalUnit, lang)
    : (lang === "VN" ? "Chưa chọn" : "Not set");
  const estimatedDurationMinutes = Number(booking.routeEstimate?.estimatedDurationMinutes);
  const chargeableDurationMinutes = Number(booking.routeEstimate?.chargeableDurationMinutes);
  const rentalDurationHint = (() => {
    if (booking.rentalUnit === "Hour") {
      const parts = [];
      if (Number.isFinite(estimatedDurationMinutes) && estimatedDurationMinutes > 0) {
        parts.push(lang === "VN"
          ? `Hành trình dự kiến: ${formatQuoteHumanDuration(estimatedDurationMinutes, lang)}`
          : `Estimated trip: ${formatQuoteHumanDuration(estimatedDurationMinutes, lang)}`);
      }
      if (Number.isFinite(chargeableDurationMinutes) && chargeableDurationMinutes > 0) {
        parts.push(lang === "VN"
          ? `Tính tiền: ${formatQuoteHumanDuration(chargeableDurationMinutes, lang)}`
          : `Chargeable: ${formatQuoteHumanDuration(chargeableDurationMinutes, lang)}`);
      }
      return parts.join(" · ") || undefined;
    }

    if (booking.rentalUnit === "Day" && Number(booking.durationValue) > 0) {
      return lang === "VN"
        ? `Thời lượng thuê: ${booking.durationValue} ngày`
        : `Rental duration: ${booking.durationValue} day(s)`;
    }
    return undefined;
  })();
  const createdAtLabel = booking.createdAt
    ? (typeof formatDateTime === "function" ? formatDateTime(booking.createdAt) : formatDate(booking.createdAt))
    : "--";

  return (
    <div className="space-y-5">
      {showBookingHoldCountdown ? (
        <section className="overflow-hidden rounded-4xl border border-sky-200/80 bg-sky-50 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-sky-500/20 dark:bg-sky-500/10">
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
              value={quoteTotal > 0 ? currencyFormatter.format(bookingPaidAmount) : "--"}
              tone={bookingPaidAmount > 0 ? "success" : "default"}
            />
            <OverviewStat
              label={lang === "VN" ? "Còn lại" : "Remaining"}
              value={quoteTotal > 0 ? currencyFormatter.format(remainingAmount) : "--"}
              tone={remainingAmount > 0 ? "warn" : "default"}
            />
          </div>

          {bookingQuotePreview?.boats?.length > 0 ? (
            <CharterQuotePreviewTable
              preview={bookingQuotePreview}
              booking={booking}
              lang={lang}
              currencyFormatter={currencyFormatter}
            />
          ) : null}

          <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
            <div className="flex min-h-0 flex-col gap-3">
              <p className="shrink-0 text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">
                {lang === "VN" ? "Chuyến đi" : "Trip"}
              </p>
              <AdminCharterRouteInfoPanel lang={lang} booking={booking} formatDate={formatDate} />
              <AdminCharterRouteDrawPanel
                lang={lang}
                booking={booking}
                routeDrawRequest={routeDrawRequest}
                canRequest={canRequestRouteDraw}
                hasMissingRouteLegs={hasMissingRouteLegs}
                hasEnoughRouteCodes={hasEnoughRouteCodes}
                isSubmitting={isRouteDrawSubmitting}
                onRequestDraw={onRequestRouteDraw}
              />
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">
                {lang === "VN" ? "Thông tin khách" : "Customer info"}
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
                icon="groups"
                label={lang === "VN" ? "Hành khách" : "Passengers"}
                value={formatPassengerSummary(booking, lang)}
               
              />
              <OverviewField
                icon="event_available"
                label={lang === "VN" ? "Ngày giờ khởi hành" : "Departure date & time"}
                value={`${formatDate(booking.departureDate)} · ${String(booking.startTime || "--").slice(0, 5)}`}
                action={canRescheduleDeparture ? (
                  <button
                    type="button"
                    disabled={isReschedulingDeparture}
                    onClick={onRescheduleDeparture}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#124757] transition hover:border-[#124757]/30 hover:bg-white disabled:cursor-wait disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-400"
                    title={lang === "VN" ? "Đổi ngày giờ khởi hành" : "Change departure date and time"}
                    aria-label={lang === "VN" ? "Đổi ngày giờ khởi hành" : "Change departure date and time"}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isReschedulingDeparture ? "animate-pulse" : ""}`}>
                      edit_calendar
                    </span>
                  </button>
                ) : null}
              />
              <OverviewField
                icon="schedule"
                label={lang === "VN" ? "Hình thức thuê" : "Rental type"}
                value={rentalUnitLabel}
                hint={rentalDurationHint}
              />
              <OverviewField
                icon="payments"
                label={lang === "VN" ? "Đặt cọc 50%" : "Deposit 50%"}
                value={depositAmount > 0 ? currencyFormatter.format(depositAmount) : "--"}
              />
              {booking.promotionCode ? (
                <OverviewField
                  icon="sell"
                  label={lang === "VN" ? "Mã khuyến mãi" : "Promotion"}
                  value={booking.promotionCode}
                  hint={booking.discountAmount > 0
                    ? `-${currencyFormatter.format(booking.discountAmount)}`
                    : undefined}
                />
              ) : null}
              <OverviewField
                icon="event"
                label={lang === "VN" ? "Ngày tạo yêu cầu" : "Request created"}
                value={createdAtLabel}
              />
              <OverviewField
                icon="sticky_note_2"
                label={lang === "VN" ? "Ghi chú đặc biệt" : "Special requests"}
                value={booking.specialRequests || (lang === "VN" ? "Không có" : "None")}
              />
              {booking.assignedManagerId ? (
                <OverviewField
                  icon="supervisor_account"
                  label={lang === "VN" ? "Quản lý phụ trách" : "Assigned manager"}
                  value={booking.assignedManagerName || (lang === "VN" ? "Chưa gán" : "Not assigned")}
                />
              ) : null}
              <CharterInsuranceInfo
                booking={booking}
                lang={lang}
                currencyFormatter={currencyFormatter}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-4xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
          <h2 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
            {lang === "VN" ? "Tàu yêu cầu & đã gán" : "Requested vs assigned boats"}
          </h2>
        </div>

        <div className="space-y-4 px-6 py-6 md:px-8">
          {boatRows.length > 0 ? boatRows.map(({ requested, assigned, index }) => {
            const totalRequested = requestedBoats.length;
            const isFirstRow = index === 0;
            const deckText = requested
              ? formatDeckCount(getRequestedDeckCount(requested), lang) || pick(requested, ["requiredSeatSetupType", "seatSetupType"], "--")
              : "--";
            const countLabel = lang === "VN" ? "tàu" : "boat(s)";
            const requestedText = isFirstRow && totalRequested > 0
              ? `${totalRequested} ${countLabel} · ${deckText}`
              : deckText;
            const assignedCode = assigned ? getBoatCode(assigned) : "";
            const assignedName = assigned ? getBoatNameOnly(assigned, lang === "VN" ? `Tàu ${index + 1}` : `Boat ${index + 1}`) : "";
            const assignedDeckText = assigned
              ? formatDeckCount(getBoatDeckCount(assigned), lang) || getBoatSeatSetupType(assigned) || "--"
              : "";
            const assignedSeatCount = assigned ? getBoatSeatCount(assigned) : 0;
            const assignedStatus = assigned ? translateBoatStatus(getBoatStatusLabel(assigned), lang) : "";
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
                    <div className={`relative aspect-4/3 overflow-hidden rounded-2xl bg-slate-200 shadow-inner dark:bg-slate-800 md:h-full md:min-h-42 md:aspect-auto ${isReleasedAssignment ? "grayscale" : ""}`}>
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
                      <span className={`absolute bottom-3 left-3 rounded-lg px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wider shadow-sm ${isReleasedAssignment
                        ? "bg-slate-800/95 text-white"
                        : "bg-white/95 text-[#124757] dark:bg-slate-900/95 dark:text-yellow-400"
                        }`}
                      >
                        {(() => {
                          if (!isReleasedAssignment) {
                            return lang === "VN" ? "Đã gán" : "Assigned";
                          }
                          const status = String(booking.status || "");
                          if (status === "Cancelled") return lang === "VN" ? "Đã hủy" : "Cancelled";
                          if (status === "Expired") return lang === "VN" ? "Hết hạn" : "Expired";
                          if (status === "Refunded") return lang === "VN" ? "Đã hoàn tiền" : "Refunded";
                          return lang === "VN" ? "Đã hủy" : "Cancelled";
                        })()}
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
                          <div className={`rounded-2xl border px-3 py-2.5 ${isReleasedAssignment
                            ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                            : "border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                            }`}
                          >
                            <p className={`text-[10px] font-bold uppercase tracking-wide ${isReleasedAssignment
                              ? "text-slate-400"
                              : "text-emerald-600/80 dark:text-emerald-300"
                              }`}
                            >
                              {lang === "VN" ? "Trạng thái tàu" : "Boat status"}
                            </p>
                            <p className={`mt-1 text-sm font-headline font-black ${isReleasedAssignment
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
  boats,
  occupiedBoatIds = [],
  quoteForm,
  canManageQuote,
  hasBlockingPayment,
  isSubmitting,
  isQuoteBoatSelectionComplete,
  isRoutePlanComplete = false,
  routeCandidateLegs = [],
  routePlanSelections = {},
  routeCandidatesLoaded = false,
  isRouteCandidatesLoading = false,
  routeCandidatesError = "",
  isPreviewLoading,
  quotePreviewError,
  quotePreview,
  currencyFormatter,
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
  onSubmitQuote,
  onQuoteBoatChange,
  onRoutePlanChange,
  onLoadRouteCandidates,
  onPreviewQuote,
  onNavigateTab,
  onCreateTrip,
  canCreateTrip = false,
  createTripBlockers = [],
  linkedTripIds = [],
  canManageTripCreate = false,
  routeDrawRequest = null,
  isRouteDrawSubmitting = false,
  canRequestRouteDraw = false,
  hasMissingRouteLegs = false,
  hasEnoughRouteCodes = false,
  onRequestRouteDraw,
}) {
  const routeQuoteOptions = {
    routeCandidateLegs: routeCandidatesLoaded ? routeCandidateLegs : undefined,
    routePlanComplete: routeCandidatesLoaded && isRoutePlanComplete,
    routeCandidatesLoaded,
  };
  const routePricingWarning = getCharterRoutePricingWarning(booking, lang, routeQuoteOptions);
  const quoteRentalUnit = quoteForm?.rentalUnit === "Day" ? "Day" : "Hour";
  const canPreviewQuote = canManageQuote
    && isQuoteBoatSelectionComplete
    && routeCandidatesLoaded
    && isRoutePlanComplete
    && !hasEmptyRouteCandidateLegs(routeCandidateLegs)
    && !isCharterRoutePricingBlocked(booking, routeQuoteOptions)
    && !isPreviewLoading
    && !isSubmitting;
  const canSubmitQuote = canPreviewQuote
    && Boolean(quotePreview)
    && !isSubmitting;
  if (phase === "quote") {
    return (
      <section className="space-y-6">
        <AdminCharterRouteDrawPanel
          lang={lang}
          booking={booking}
          routeDrawRequest={routeDrawRequest}
          canRequest={canRequestRouteDraw}
          hasMissingRouteLegs={hasMissingRouteLegs}
          hasEnoughRouteCodes={hasEnoughRouteCodes}
          isSubmitting={isRouteDrawSubmitting}
          onRequestDraw={onRequestRouteDraw}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <form onSubmit={onSubmitQuote} className="min-w-0 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
                  {lang === "VN" ? "Gán tuyến và tàu" : "Assign route & boats"}
                </h3>
              </div>
            </div>

            {/* <div className="mt-4">
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Hình thức thuê (khách chọn)" : "Rental type (customer choice)"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-xl bg-[#124757] px-3 py-2 text-[11px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900">
                  {quoteRentalUnit === "Hour"
                    ? (lang === "VN" ? "Theo giờ" : "Hourly")
                    : (lang === "VN" ? "Theo ngày" : "Daily")}
                </span>
              </div>
            </div> */}

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

            {routePricingWarning
              && !(routeCandidatesLoaded && hasEmptyRouteCandidateLegs(routeCandidateLegs)) ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                  {routePricingWarning}
                </p>
              </div>
            ) : null}

            <fieldset disabled={!canManageQuote || isSubmitting} className="mt-5 space-y-5 disabled:opacity-60">
              <AdminCharterRoutePlanPicker
                lang={lang}
                legs={routeCandidateLegs}
                selections={routePlanSelections}
                loaded={routeCandidatesLoaded}
                isLoading={isRouteCandidatesLoading}
                error={routeCandidatesError}
                disabled={!canManageQuote || isSubmitting}
                onChange={onRoutePlanChange}
                onLoad={onLoadRouteCandidates}
              />

              <div className="grid gap-4 xl:grid-cols-2">
                {quoteForm.boats.map((quoteBoat) => {
                  const selectedBoatIds = quoteForm.boats
                    .filter((boat) => boat.boatOrder !== quoteBoat.boatOrder && boat.boatId)
                    .map((boat) => boat.boatId);
                  const availableBoats = boats.filter((boat) => {
                    const boatId = String(getBoatId(boat) || "").trim();
                    const requiredDecks = Number(quoteBoat.requiredNumberOfDecks) || 0;
                    const matchesDeck = !requiredDecks || getBoatDeckCount(boat) === requiredDecks;
                    const matchesSeatSetup = requiredDecks
                      ? true
                      : (!quoteBoat.requiredSeatSetupType || getBoatSeatSetupType(boat) === quoteBoat.requiredSeatSetupType);
                    const occupiedSet = new Set(
                      (Array.isArray(occupiedBoatIds) ? occupiedBoatIds : [])
                        .map((id) => String(id || "").trim())
                        .filter(Boolean),
                    );
                    const isOccupiedElsewhere =
                      occupiedSet.has(boatId) && boatId !== String(quoteBoat.boatId || "").trim();
                    return isActiveBoat(boat)
                      && !isRescueBoat(boat)
                      && matchesDeck
                      && matchesSeatSetup
                      && !isOccupiedElsewhere
                      && (!selectedBoatIds.includes(boatId) || boatId === quoteBoat.boatId);
                  });

                  return (
                    <div key={quoteBoat.boatOrder} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                      <div className="mb-3 flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                          {lang === "VN" ? `Tàu ${quoteBoat.boatOrder}` : `Boat ${quoteBoat.boatOrder}`}
                        </p>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {lang === "VN" ? "Loại:" : "Type:"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#124757]/10 px-2 py-0.5 text-[10px] font-bold text-[#124757] ring-1 ring-[#124757]/20 dark:bg-yellow-400/10 dark:text-yellow-400 dark:ring-yellow-400/30">
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

              <p className="text-[11px] font-medium leading-relaxed text-slate-400">
                {lang === "VN"
                  ? `Báo giá ${quoteRentalUnit === "Hour" ? "theo giờ" : "theo ngày"}: chọn tuyến & tàu, xem trước rồi chốt giá.`
                  : `Quoting ${quoteRentalUnit === "Hour" ? "hourly" : "daily"}: select routes and boats, preview, then submit.`}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onPreviewQuote?.()}
                  disabled={!canPreviewQuote}
                  className="w-full rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-headline font-black uppercase tracking-widest text-[#124757] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
                >
                  {isPreviewLoading
                    ? (lang === "VN" ? "Đang tính..." : "Calculating...")
                    : (lang === "VN" ? "Xem trước giá" : "Preview quote")}
                </button>
                <button type="submit" disabled={!canSubmitQuote} className="w-full rounded-xl bg-[#124757] px-6 py-3 text-xs font-headline font-black uppercase tracking-widest text-white disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900">
                  {isSubmitting ? (lang === "VN" ? "Đang xử lý..." : "Submitting...") : (lang === "VN" ? "Chốt giá" : "Submit Quote")}
                </button>
              </div>
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
                {lang === "VN"
                  ? "Chi tiết giá/lộ trình xem ở Tổng quan. Theo dõi giao dịch ở Thanh toán."
                  : "See price/route details on Overview. Track transactions on the Payments."}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                {lang === "VN" ? "Giá chốt" : "Quote"}
              </p>
              <p className="mt-1 text-sm font-headline font-black text-[#124757] dark:text-yellow-400">
                {quoteTotal > 0 ? currencyFormatter.format(quoteTotal) : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                {lang === "VN" ? "Đã thu" : "Paid"}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                {bookingPaidAmount > 0 ? currencyFormatter.format(bookingPaidAmount) : "--"}
              </p>
            </div>
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

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab("overview")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
            >
              {lang === "VN" ? "Xem tổng quan" : "Open overview"}
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("payments")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#124757] px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
            >
              {lang === "VN" ? "Xem thanh toán" : "Open payments"}
            </button>
          </div>
        </div>

      </section>
    );
  }

  if (phase === "operate") {
    const hasLinkedTrips = Array.isArray(linkedTripIds) && linkedTripIds.length > 0;
    const showCreateTrip = Boolean(canManageTripCreate) && !hasLinkedTrips;
    return (
      <section className="space-y-6">
        <div className={`rounded-4xl border p-6 ${hasLinkedTrips
          ? "border-sky-100 bg-sky-50 dark:border-sky-500/20 dark:bg-sky-500/10"
          : "border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div>
                <h3 className={`font-headline font-black uppercase tracking-wide ${hasLinkedTrips
                  ? "text-sky-800 dark:text-sky-300"
                  : "text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  {hasLinkedTrips
                    ? (lang === "VN" ? "Đã có chuyến" : "Trip created")
                    : (lang === "VN" ? "Sẵn sàng vận hành" : "Ready for operation")}
                </h3>
                <p className={`mt-1 text-sm font-bold ${hasLinkedTrips
                  ? "text-sky-700/80 dark:text-sky-200"
                  : "text-emerald-700/80 dark:text-emerald-200"
                  }`}
                >
                  {formatPassengerSummary(booking, lang)} · {formatRequestTerminology(booking.route)}
                </p>
                {hasLinkedTrips && (
                  <p className="mt-2 text-xs font-bold text-sky-700 dark:text-sky-200">
                    {lang === "VN" ? "Đã tạo chuyến." : "Trip created."}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {showCreateTrip && (
                <button
                  type="button"
                  disabled={!canCreateTrip || isSubmitting || hasLinkedTrips}
                  onClick={onCreateTrip}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-70 ${hasLinkedTrips
                    ? "border border-sky-200 bg-white text-sky-800 dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-200"
                    : "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 disabled:opacity-50"
                    }`}
                >
                  {hasLinkedTrips
                    ? (lang === "VN" ? "Đã có chuyến" : "Trip exists")
                    : (lang === "VN" ? "Tạo chuyến" : "Create trip")}
                </button>
              )}
            </div>
          </div>

          {showCreateTrip && createTripBlockers.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {createTripBlockers.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          )}
        </div>

      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-4xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div>
              <h3 className="font-headline font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {lang === "VN" ? "Booking đã đóng" : "Booking closed"}
              </h3>
              <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">
                {lang === "VN"
                  ? "Chi tiết xem Tổng quan / Thanh toán / Vé."
                  : "See details on Overview / Payments / Tickets."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigateTab("overview")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {lang === "VN" ? "Tổng quan" : "Overview"}
            </button>
            <button type="button" onClick={() => onNavigateTab("payments")} className="rounded-xl bg-[#124757] px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900">
              {lang === "VN" ? "Thanh toán" : "Payments"}
            </button>
            {booking.status === "Completed" && (
              <button type="button" onClick={() => onNavigateTab("tickets")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {lang === "VN" ? "Vé/khách" : "Tickets"}
              </button>
            )}
          </div>
        </div>
      </div>
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
  canReviewPassengerAdds = false,
  onRefresh,
}) {
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewingBatchId, setReviewingBatchId] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [isQrEnlarged, setIsQrEnlarged] = useState(false);

  const ticketRows = tickets.map((ticket, index) => {
    const ticketId = getTicketId(ticket);
    const ticketCode = pick(ticket, ["ticketCode", "code", "ticketNumber"], "");
    const fullName = pick(ticket, ["fullName", "passengerName", "name", "contactName"], "");
    const passengerType = pick(ticket, ["passengerType", "type"], "");
    const birthYear = getPassengerBirthYear(ticket);
    const status = pick(ticket, ["attendanceStatus", "ticketStatus", "status"], "Active");
    const approvalStatus = pick(ticket, ["approvalStatus", "passengerApprovalStatus", "addRequestStatus"], "");
    const reviewNote = pick(ticket, ["reviewNote", "rejectNote", "note"], "");
    const seatCode = pick(ticket, ["seatCode", "seatNumber", "seat"], "");

    return {
      ticket,
      index,
      ticketId,
      ticketCode: ticketCode || (ticketId ? `ID ···${String(ticketId).slice(-8)}` : `#${index + 1}`),
      fullName: fullName || (lang === "VN" ? "Chưa có tên" : "No name"),
      passengerType: formatCharterPassengerType(passengerType, lang),
      birthYear,
      status,
      approvalStatus,
      reviewNote,
      seatCode,
      hasTicketId: Boolean(ticketId),
    };
  });

  const addRequestBatches = getPassengerAddRequestBatches(
    Array.isArray(booking?.passengers) && booking.passengers.length > 0
      ? booking.passengers
      : tickets,
  );

  const selectableTicketIds = ticketRows.filter((row) => row.hasTicketId).map((row) => row.ticketId);
  const canViewTickets = canShowCharterTickets(booking);
  const reportedTicketCount = getCharterTicketCount(booking);
  const canExportTickets = canViewTickets && reportedTicketCount > 0;
  const isFullyPaid = isCharterFullyPaid(booking);
  const hasManifest = hasCharterPassengerManifest(booking);

  const ticketGateMessage = (() => {
    if (!canViewTickets && !isFullyPaid) {
      return {
        tone: "amber",
        title: lang === "VN" ? "Chưa thanh toán đủ" : "Not fully paid",
        text: lang === "VN"
          ? "Vé chỉ phát hành sau khi khách thanh toán đủ"
          : "Tickets are issued only after the booking is fully paid",
      };
    }
    if (!canViewTickets && !hasManifest) {
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
    const popup = action === "view" ? window.open("", "_blank") : null;

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
      } else if (action === "view") {
        // Xem vé: mở PDF trong tab mới (không dùng luồng in riêng).
        try {
          response = await downloadCharterBookingTicketsPdf(booking.id, targetTicketIds);
        } catch (pdfError) {
          if (targetTicketIds || !booking.qrToken) throw pdfError;
          response = await downloadCharterBookingTicketsPdfByQrToken(booking.qrToken);
        }
        const url = URL.createObjectURL(response.data);
        if (popup) popup.location.href = url;
        else openBlobInNewTab(response);
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        throw new Error(lang === "VN" ? "Thao tác vé không hỗ trợ." : "Unsupported ticket action.");
      }
    } catch (error) {
      if (popup) popup.close();
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không thể xuất vé" : "Unable to export tickets",
        text: getApiErrorMessage(
          error,
          lang === "VN"
            ? "Không thể tải PDF vé. Vui lòng thử lại sau khi khách đã lưu danh sách hành khách."
            : "Unable to download ticket PDF. Please try again after the passenger list is saved.",
        ),
        timer: 4500,
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

  const handleApproveBatch = async (batch) => {
    if (!booking?.id || !batch?.requestBatchId) return;
    const result = await showConfirmDialog({
      tone: "brand",
      icon: "question",
      title: lang === "VN" ? "Duyệt yêu cầu thêm?" : "Approve add request?",
      html: buildConfirmBodyHtml({
        code: booking.bookingCode,
        text: lang === "VN"
          ? `Duyệt ${batch.passengers.length} hành khách trong yêu cầu này.`
          : `Approve ${batch.passengers.length} passenger(s) in this request.`,
      }),
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Duyệt" : "Approve",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!result.isConfirmed) return;

    try {
      setReviewingBatchId(batch.requestBatchId);
      const response = await approveCharterPassengerAddRequest(booking.id, batch.requestBatchId);
      const paymentMeta = extractCharterAdditionalPaymentMeta(response);
      await onRefresh?.();

      const needsExtraPayment = paymentMeta.requiresAdditionalPayment === true
        || paymentMeta.remainingAmount > 0;
      const extraAmount = paymentMeta.remainingAmount;
      const extraAmountLabel = extraAmount > 0
        ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(extraAmount)
        : "";

      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã duyệt" : "Approved",
        text: needsExtraPayment
          ? (lang === "VN"
            ? `Phí bảo hiểm phát sinh${extraAmountLabel ? ` ${extraAmountLabel}` : ""}. Khách cần thanh toán phần còn lại (Remaining). Vé/boarding pass chỉ phát sau khi Paid.`
            : `Extra insurance due${extraAmountLabel ? ` (${extraAmountLabel})` : ""}. Customer must pay Remaining. Boarding pass only after Paid.`)
          : undefined,
        timer: needsExtraPayment ? 4500 : 1800,
      });
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không duyệt được" : "Unable to approve",
        text: getApiErrorMessage(error),
        timer: 4000,
      });
    } finally {
      setReviewingBatchId("");
    }
  };

  const handleRejectBatch = async (batch) => {
    if (!booking?.id || !batch?.requestBatchId) return;
    const result = await showConfirmDialog({
      tone: "danger",
      icon: "warning",
      title: lang === "VN" ? "Từ chối yêu cầu?" : "Reject request?",
      html: buildConfirmBodyHtml({
        code: booking.bookingCode,
        text: lang === "VN"
          ? "Hành khách trong yêu cầu này sẽ không được thêm vào booking."
          : "Passengers in this request will not be added to the booking.",
      }),
      input: "textarea",
      inputLabel: lang === "VN" ? "Lý do từ chối (bắt buộc)" : "Rejection note (required)",
      inputPlaceholder: lang === "VN" ? "Nhập lý do..." : "Enter reason...",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Từ chối" : "Reject",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
      inputValidator: (value) => {
        if (!String(value || "").trim()) {
          return lang === "VN" ? "Bắt buộc nhập lý do." : "A note is required.";
        }
        return undefined;
      },
    });
    if (!result.isConfirmed) return;

    try {
      setReviewingBatchId(batch.requestBatchId);
      await rejectCharterPassengerAddRequest(
        booking.id,
        batch.requestBatchId,
        String(result.value || "").trim(),
      );
      await onRefresh?.();
      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã từ chối" : "Rejected",
        timer: 1800,
      });
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không từ chối được" : "Unable to reject",
        text: getApiErrorMessage(error),
        timer: 4000,
      });
    } finally {
      setReviewingBatchId("");
    }
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
                  ? "Xem hoặc tải PDF vé — khách in từ file PDF nếu cần"
                  : "View or download ticket PDFs — customers print from the PDF if needed"}
              </p>
            </div>
            {qrImageUrl && (
              <button
                type="button"
                onClick={() => setIsQrEnlarged(true)}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left dark:border-slate-700 dark:bg-slate-900"
              >
                <img src={qrImageUrl} alt={lang === "VN" ? "QR tổng booking" : "Booking group QR"} className="h-20 w-20 rounded-xl bg-white object-contain p-1" />
                <div>
                  <p className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "QR booking" : "Booking QR"}</p>
                  <p className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">{booking.bookingCode}</p>
                </div>
              </button>
            )}

            {isQrEnlarged && qrImageUrl && (
              <div
                className="fixed inset-0 z-120 flex items-center justify-center bg-black/50 p-4"
                onClick={() => setIsQrEnlarged(false)}
                onKeyDown={(e) => { if (e.key === "Escape") setIsQrEnlarged(false); }}
                role="presentation"
              >
                <div
                  className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800"
                  onClick={(event) => event.stopPropagation()}
                  role="dialog"
                  aria-label={lang === "VN" ? "QR booking" : "Booking QR"}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400">
                      {lang === "VN" ? "QR booking" : "Booking QR"}
                    </span>
                    <button type="button" onClick={() => setIsQrEnlarged(false)} className="text-slate-400 hover:text-slate-600">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <img src={qrImageUrl} alt={lang === "VN" ? "QR tổng booking" : "Booking group QR"} className="h-60 w-60 rounded-xl bg-white object-contain p-2" />
                  </div>
                  <p className="mt-4 break-all text-center font-mono text-[11px] text-slate-500">{booking.bookingCode}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 px-6 py-6 md:px-8">
          {ticketGateMessage && (
            <div className={`rounded-2xl border px-4 py-4 ${ticketGateMessage.tone === "sky"
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
                onClick={() => handleTicketAction("pdf")}
                disabled={isSubmitting || !canExportTickets}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#124757] px-4 py-3 text-xs font-headline font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
              >
                <span className="material-symbols-outlined text-base">download</span>
                {lang === "VN" ? "Tải vé PDF" : "Download PDF tickets"}
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

        <details className="group border-t border-slate-100 dark:border-slate-700/70">
          <summary className="cursor-pointer list-none px-6 py-5 marker:content-none md:px-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
                  {lang === "VN" ? "Danh sách vé" : "Ticket list"}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {reportedTicketCount} {lang === "VN" ? "vé" : "ticket(s)"}
                </p>
              </div>
              <span className="material-symbols-outlined shrink-0 text-slate-400 transition group-open:rotate-180">expand_more</span>
            </div>
          </summary>

          <div className="space-y-3 px-6 pb-6 md:px-8">
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
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-headline font-black uppercase tracking-wider ${statusMeta.classes
                            .split(" ")
                            .filter((cls) => cls.includes("text-"))
                            .join(" ")
                          }`}>
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
                        {row.seatCode && (
                          <span>{lang === "VN" ? "Ghế" : "Seat"}: {row.seatCode}</span>
                        )}
                        {row.approvalStatus ? (
                          <span className={`px-1.5 py-0.5 text-[10px] font-black uppercase ${getPassengerApprovalTone(row.approvalStatus)
                              .split(" ")
                              .filter((cls) => cls.includes("text-"))
                              .join(" ")
                            }`}>
                            {formatPassengerApprovalStatus(row.approvalStatus, lang, row.reviewNote)}
                          </span>
                        ) : null}
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
                      onClick={() => handleTicketAction("pdf", row.hasTicketId ? [row.ticketId] : null)}
                      disabled={isSubmitting || !row.hasTicketId}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#124757] px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      {lang === "VN" ? "PDF" : "PDF"}
                    </button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-slate-700">
              <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
                {!canViewTickets
                  ? (lang === "VN" ? "Chưa có vé để hiển thị." : "No tickets to display yet.")
                  : reportedTicketCount > 0
                    ? (lang === "VN" ? "API đã ghi nhận vé nhưng chưa trả chi tiết vé." : "The API reported tickets but did not include ticket details.")
                    : (lang === "VN" ? "Đã đủ điều kiện nhưng hệ thống chưa trả vé." : "Eligible, but the system has not returned tickets yet.")}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {!canViewTickets
                  ? (lang === "VN"
                    ? "Cần thanh toán đủ & khách đã lưu danh sách hành khách."
                    : "Requires full payment & saved passenger manifest.")
                  : (lang === "VN"
                    ? "Tải lại trang để nhận chi tiết vé mới nhất."
                    : "Reload the page to fetch the latest ticket details.")}
              </p>
            </div>
          )}
          </div>
        </details>
      </section>

      {canReviewPassengerAdds && addRequestBatches.length > 0 ? (
        <section className="overflow-hidden rounded-4xl border border-slate-200/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700/70 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
            <h3 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
              {lang === "VN" ? "Yêu cầu thêm hành khách" : "Passenger add requests"}
            </h3>
          </div>
          <div className="space-y-4 px-6 py-6 md:px-8">
            {addRequestBatches.map((batch) => {
              const busy = reviewingBatchId === batch.requestBatchId;
              return (
                <div
                  key={batch.requestBatchId}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-slate-400">
                        {lang === "VN" ? "Thời gian gửi" : "Submitted"}: {batch.requestedAt ? formatDate(batch.requestedAt) : "—"}
                      </p>
                      <span className={`inline-flex self-start px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${getPassengerApprovalTone(batch.status)
                          .split(" ")
                          .filter((cls) => cls.includes("text-"))
                          .join(" ")
                        }`}>
                        {formatPassengerApprovalStatus(batch.status, lang, batch.reviewNote)}
                      </span>
                    </div>
                    {batch.status === "Pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleApproveBatch(batch)}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50"
                        >
                          {busy ? "…" : (lang === "VN" ? "Duyệt" : "Approve")}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRejectBatch(batch)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-rose-700 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                        >
                          {lang === "VN" ? "Từ chối" : "Reject"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {batch.passengers.map((passenger, index) => (
                      <li key={`${batch.requestBatchId}-${index}`} className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {passenger.fullName || "—"}
                        {passenger.birthYear ? ` · ${passenger.birthYear}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
