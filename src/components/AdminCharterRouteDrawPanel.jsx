import {
  bookingNeedsGpsRouteDraw,
  isActiveRouteDrawStatus,
  labelRouteDrawStatus,
  normalizeRouteDrawRequest,
  routeDrawStatusBadgeClass,
  ROUTE_DRAW_STATUS,
} from "../utils/routeDrawRequest";

/**
 * Charter FE — gửi / theo dõi yêu cầu GPS vẽ tuyến.
 * Nhận định đủ tuyến bằng mã tuyến (routeCode) đã chọn từng chặng.
 * Đủ mã / đã chốt selectedRoute → ẩn. Thiếu mã hoặc thiếu ứng viên → hiện nút (cho gửi lại).
 */
export function AdminCharterRouteDrawPanel({
  lang = "VN",
  booking,
  routeDrawRequest = null,
  canRequest = true,
  hasMissingRouteLegs = false,
  hasEnoughRouteCodes = false,
  isSubmitting = false,
  onRequestDraw,
}) {
  const needsDraw = bookingNeedsGpsRouteDraw(booking);
  // Đã có tuyến chốt trên booking → ẩn.
  if (!needsDraw) return null;
  // Đã chọn đủ mã tuyến cho mọi chặng → ẩn (không cần gửi GPS nữa).
  if (hasEnoughRouteCodes) return null;

  const request = normalizeRouteDrawRequest(routeDrawRequest || booking?.routeDrawRequest);
  const status = String(request?.status || "").trim();
  const isActive = isActiveRouteDrawStatus(status);
  const isDone = status === ROUTE_DRAW_STATUS.DONE;
  const hasExistingRequest = Boolean(request?.requestId || status);

  // Chưa thiếu ứng viên và chưa có request → không hiện panel.
  if (!hasMissingRouteLegs && !hasExistingRequest) return null;

  const showRequestButton = Boolean(canRequest);
  const buttonLabel = hasExistingRequest
    ? (lang === "VN" ? "Gửi lại GPS vẽ tuyến" : "Resend GPS route draw")
    : (lang === "VN" ? "Gửi GPS vẽ tuyến" : "Request GPS route draw");
  const buttonIcon = hasExistingRequest ? "replay" : "route";

  return (
    <div className="rounded-3xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-headline font-black uppercase tracking-widest text-amber-700/80 dark:text-amber-300">
            {lang === "VN" ? "GPS vẽ tuyến" : "GPS route draw"}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
            {hasMissingRouteLegs
              ? (lang === "VN"
                ? "Có chặng chưa có mã tuyến GPS — gửi yêu cầu để admin GPS vẽ."
                : "Some legs have no GPS route code — request GPS admin to draw one.")
              : (lang === "VN"
                ? "Chưa chọn đủ mã tuyến cho mọi chặng — có thể gửi / gửi lại yêu cầu GPS."
                : "Route codes are incomplete — you can send / resend a GPS request.")}
          </p>
          {request?.notes ? (
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-300">{request.notes}</p>
          ) : null}
        </div>

        {status ? (
          <span
            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider ring-1 ${routeDrawStatusBadgeClass(status)}`}
          >
            {labelRouteDrawStatus(status, lang)}
          </span>
        ) : null}
      </div>

      {isActive ? (
        <p className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
          {lang === "VN"
            ? "Đang chờ GPS xử lý — có thể gửi lại nếu nghi request bị mất."
            : "Waiting for GPS — you can resend if the request seems lost."}
        </p>
      ) : null}

      {isDone ? (
        <p className="mt-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          {lang === "VN"
            ? "GPS đã hoàn tất — đang đồng bộ lại booking…"
            : "GPS marked done — syncing booking…"}
        </p>
      ) : null}

      {showRequestButton ? (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onRequestDraw}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#124757] px-4 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white shadow-sm transition hover:opacity-95 disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
        >
          {isSubmitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <span className="material-symbols-outlined text-base">{buttonIcon}</span>
          )}
          {buttonLabel}
        </button>
      ) : null}
    </div>
  );
}
